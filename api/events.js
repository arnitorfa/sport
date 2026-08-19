// Vercel serverless function — aggregates sports schedule per country.
//
// API:
//   GET /api/events?date=YYYY-MM-DD&country=is|se
//   GET /api/events                   — events for today, Iceland (default)
//
// Uses native fetch (Node 18+, no node-fetch needed).
// Edge caching via Cache-Control: s-maxage=300 (Vercel CDN caches for 5 minutes).

import { fetchRuvSchedule }    from '../fetchers/ruv.js';
import { fetchViaplaySchedule, fetchViaplaySeSchedule } from '../fetchers/viaplay.js';
import { fetchSynSchedule }    from '../fetchers/syn.js';
import { fetchSiminnSchedule } from '../fetchers/siminn.js';
import { fetchLiveySchedule }  from '../fetchers/livey.js';
import { TVNU_POOL_ORDER, fetchTvnuChannels, isVSportSlug } from '../fetchers/tvnu.js';
import { fetchNbaSchedule } from '../fetchers/nba.js';
import { fetchNflSchedule } from '../fetchers/nfl.js';
import { fetchLaLigaSchedule } from '../fetchers/laliga.js';
import { fetchYoutubeStreams } from '../fetchers/youtube.js';

// ── Country → fetcher registry ─────────────────────────────────────────────
// Iceland uses the classic full fan-out (its upstreams are friendly).
// Sweden is handled by fetchSwedenEvents below — tv.nu rate-limits hard, so
// its channels are fetched incrementally and accumulated in the durable cache.
const COUNTRY_FETCHERS = {
  is: [
    { name: 'RÚV',        fn: fetchRuvSchedule },
    { name: 'Viaplay',    fn: fetchViaplaySchedule },
    { name: 'Sýn',        fn: fetchSynSchedule },
    { name: 'Síminn',     fn: fetchSiminnSchedule },
    { name: 'Lívey',      fn: fetchLiveySchedule },
    { name: 'Disney+',    fn: fetchLaLigaSchedule },
  ],
  se: [], // custom incremental flow — see fetchSwedenEvents
};

// ── Durable schedule cache (Supabase) ───────────────────────────────────────
// One upstream fan-out per (country, date) per CACHE_FRESH_MS — every other
// request is served from the schedule_cache table. This keeps us from
// hammering upstream APIs (tv.nu rate-limits aggressively) and gives us
// stale-but-real data to serve when an upstream is down or blocking us.
//
// Setup (once):
//   1. Run in the Supabase SQL editor:
//        create table if not exists schedule_cache (
//          country    text        not null,
//          date       date        not null,
//          payload    jsonb       not null,
//          fetched_at timestamptz not null default now(),
//          primary key (country, date)
//        );
//        alter table schedule_cache enable row level security;
//      (no policies — only the service key can touch it)
//   2. In Vercel: Settings → Environment Variables →
//        SUPABASE_SERVICE_KEY = <service_role key from Supabase → Settings → API>
//
// If the env var is missing the cache is skipped and everything works as before.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kbmjtondcqupdsumgyex.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const CACHE_FRESH_MS = 45 * 60 * 1000;        // refetch upstream after 45 minutes
const CACHE_FRESH_PARTIAL_MS = 3 * 60 * 1000;  // incomplete fetches take the next incremental step sooner
const SERVE_STALE_MAX_MS = 12 * 60 * 60 * 1000; // serve-while-refreshing window
const TVNU_BATCH_SIZE = 8;                     // max tv.nu channels per invocation

// Schedule work to continue AFTER the response is sent. On Vercel this uses
// waitUntil (keeps the lambda alive); anywhere else we just await inline.
async function runInBackground(promise) {
  try {
    const { waitUntil } = await import('@vercel/functions');
    waitUntil(promise);
  } catch (e) {
    await promise;
  }
}

function sbHeaders() {
  return {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function cacheRead(country, dateStr) {
  if (!SUPABASE_SERVICE_KEY) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/schedule_cache?country=eq.${country}&date=eq.${dateStr}&select=payload,fetched_at`;
    const resp = await fetch(url, { headers: sbHeaders() });
    if (!resp.ok) return null;
    const rows = await resp.json();
    if (!rows.length) return null;
    // Payload: bare events array (v1), { events, partial } (v2) or
    // { events, partial, okChannels, viaplayOk } (v3, incremental Sweden)
    const raw = rows[0].payload;
    const events = Array.isArray(raw) ? raw : (raw?.events || []);
    const partial = Array.isArray(raw) ? false : !!raw?.partial;
    return {
      events,
      partial,
      okChannels: (!Array.isArray(raw) && raw?.okChannels) || [],
      viaplayOk: !Array.isArray(raw) && !!raw?.viaplayOk,
      ageMs: Date.now() - new Date(rows[0].fetched_at).getTime(),
    };
  } catch (err) {
    console.warn('schedule_cache read failed:', err.message);
    return null;
  }
}

async function cacheWrite(country, dateStr, payload) {
  if (!SUPABASE_SERVICE_KEY) return;
  try {
    const url = `${SUPABASE_URL}/rest/v1/schedule_cache`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { ...sbHeaders(), 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify([{ country, date: dateStr, payload, fetched_at: new Date().toISOString() }]),
    });
    if (!resp.ok) console.warn('schedule_cache write failed: HTTP', resp.status);
  } catch (err) {
    console.warn('schedule_cache write failed:', err.message);
  }
}

// Recompute live/upcoming/done from the timestamps — cached events carry the
// status they had when fetched, which goes stale within minutes.
function recomputeStatus(events) {
  const now = Date.now();
  for (const ev of events) {
    if (!ev.startIso) continue;
    const start = new Date(ev.startIso).getTime();
    const end = ev.endIso ? new Date(ev.endIso).getTime() : start + 2 * 60 * 60 * 1000;
    if (isNaN(start)) continue;
    if (now < start) ev.status = 'upcoming';
    else if (now < end) ev.status = 'live';
    else ev.status = 'done';
  }
  return events;
}

// ── Event deduplication ─────────────────────────────────────────────────────
function deduplicateEvents(events) {
  const seen = new Set();
  return events.filter(ev => {
    const key = `${ev.title.toLowerCase().replace(/\s+/g, '')}|${ev.startIso}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Sort events by start time ───────────────────────────────────────────────
function sortEvents(events) {
  return events.sort((a, b) => {
    const aTime = new Date(a.startIso || `2000-01-01T${a.time}`);
    const bTime = new Date(b.startIso || `2000-01-01T${b.time}`);
    return aTime - bTime;
  });
}

// ── Fetch all events for a date ─────────────────────────────────────────────
// Returns { events, sources } — sources holds per-fetcher counts/errors so
// that ?debug=1 can surface exactly which data source failed and why.
async function fetchAllEvents(date, country) {
  // Use native fetch (available in Node 18+ on Vercel)
  const f = globalThis.fetch;
  const fetchers = COUNTRY_FETCHERS[country] || COUNTRY_FETCHERS.is;

  const results = await Promise.allSettled(fetchers.map(({ fn }) => fn(date, f)));

  const allEvents = [];
  const sources = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      console.log(`${fetchers[i].name}: ${result.value.length} events`);
      const src = { name: fetchers[i].name, count: result.value.length };
      // tv.nu fetchers report how many channels individually failed
      if (result.value.failedChannels > 0) {
        src.failedChannels = `${result.value.failedChannels}/${result.value.totalChannels}`;
      }
      sources.push(src);
      allEvents.push(...result.value);
    } else {
      console.error(`${fetchers[i].name} failed:`, result.reason?.message);
      sources.push({ name: fetchers[i].name, error: result.reason?.message || 'unknown' });
    }
  }

  const deduped = deduplicateEvents(allEvents);
  return { events: sortEvents(deduped), sources };
}

// ── Sweden: incremental fetch + merge ───────────────────────────────────────
// tv.nu tolerates only a handful of requests per burst, so each invocation:
//   1. tries the Viaplay SE API (1 cheap request — covers all V Sport content)
//   2. fetches the next TVNU_BATCH_SIZE un-fetched channels from the pool
//   3. merges the results into whatever the durable cache already has
// `okChannels` in the cache tracks progress; after a few 3-minute steps the
// full pool is covered and the entry behaves like a complete 45-min cache.
async function fetchSwedenEvents(date, cachedState) {
  const f = globalThis.fetch;
  const sources = [];

  let events = cachedState ? [...cachedState.events] : [];
  const ok = new Set(cachedState ? cachedState.okChannels : []);
  let viaplayOk = false;

  // 1) Direct APIs — all cheap, refreshed on every pass, run in parallel:
  //    Viaplay SE (V Sport + streaming), NBA (League Pass), NFL (DAZN),
  //    La Liga (Disney+)
  const [vpResult, nbaResult, nflResult, laligaResult] = await Promise.allSettled([
    fetchViaplaySeSchedule(date, f),
    fetchNbaSchedule(date, f),
    fetchNflSchedule(date, f),
    fetchLaLigaSchedule(date, f),
  ]);

  if (vpResult.status === 'fulfilled' && vpResult.value.length > 0) {
    viaplayOk = true;
    // Replace all previous Viaplay-sourced events (API + v-sport linear)
    events = events.filter((e) =>
      !String(e.id || '').startsWith('viaplay-') &&
      !(e.channelSlug && isVSportSlug(e.channelSlug)));
    events.push(...vpResult.value);
    sources.push({ name: 'Viaplay SE', count: vpResult.value.length });
  } else if (vpResult.status === 'fulfilled') {
    sources.push({ name: 'Viaplay SE', error: '0 events (v-sport channels via tv.nu instead)' });
  } else {
    sources.push({ name: 'Viaplay SE', error: vpResult.reason?.message });
  }

  // NBA / NFL / La Liga: replace that station's events when the fetch
  // succeeded; on failure the previously cached ones stay in place.
  for (const [result, station, name] of [
    [nbaResult, 'nba', 'NBA League Pass'],
    [nflResult, 'dazn', 'DAZN · NFL'],
    [laligaResult, 'disney', 'Disney+ · La Liga'],
  ]) {
    if (result.status === 'fulfilled') {
      events = events.filter((e) => e.station !== station);
      events.push(...result.value);
      sources.push({ name, count: result.value.length });
    } else {
      sources.push({ name, error: result.reason?.message });
    }
  }

  // 2) Next batch of tv.nu channels — v-sport slugs excluded while the
  //    Viaplay API is delivering
  const pool = TVNU_POOL_ORDER.filter((slug) => !(viaplayOk && isVSportSlug(slug)));
  const missing = pool.filter((slug) => !ok.has(slug)).slice(0, TVNU_BATCH_SIZE);

  if (missing.length > 0) {
    const r = await fetchTvnuChannels(date, f, missing);
    // Replace any stale events of the channels we just re-fetched, then merge
    const fetched = new Set(r.ok);
    events = events.filter((e) => !(e.channelSlug && fetched.has(e.channelSlug)));
    events.push(...r.events);
    r.ok.forEach((slug) => ok.add(slug));
    const remaining = pool.filter((slug) => !ok.has(slug)).length;
    sources.push({
      name: 'tv.nu',
      count: events.filter((e) => e.channelSlug).length,
      batch: `${r.ok.length}/${missing.length} ok`,
      remainingChannels: remaining,
      ...(r.firstError ? { firstError: r.firstError } : {}),
    });
  } else {
    sources.push({ name: 'tv.nu', count: events.filter((e) => e.channelSlug).length, remainingChannels: 0 });
  }

  const remaining = pool.filter((slug) => !ok.has(slug)).length;
  const partial = remaining > 0;

  return {
    events: sortEvents(deduplicateEvents(events)),
    okChannels: [...ok],
    viaplayOk,
    partial,
    sources,
  };
}

// ── Dr. Football — handvirk YouTube dagskrárfærsla ─────────────────────────
// "Góðan daginn Epic Ameríka" á YouTube rásinni Dr. Football
// Birtist á öllum virkum dögum (Mán–Fös) á meðan HM 2026 er í gangi.
const WC_START = '2026-06-11';
const WC_END   = '2026-07-20';

function drFootballEvent(dateStr) {
  // Aðeins á HM-tímabilinu
  if (dateStr < WC_START || dateStr > WC_END) return null;
  // Undanþágudagar — þættir sem falla niður
  const SKIP_DATES = new Set(['2026-06-17']);
  if (SKIP_DATES.has(dateStr)) return null;
  // Aðeins virkir dagar (1=Mán, 5=Fös)
  const dow = new Date(dateStr + 'T12:00:00Z').getUTCDay();
  if (dow === 0 || dow === 6) return null; // helgar

  const now = new Date();
  const start = new Date(dateStr + 'T10:00:00Z'); // 10:00 Íslandstími (UTC+0)
  const end   = new Date(dateStr + 'T11:00:00Z');
  let status = 'upcoming';
  if (start <= now && now < end) status = 'live';
  else if (end < now) status = 'done';

  return {
    id: `drfootball-${dateStr}`,
    time: '10:00',
    endTime: '11:00',
    startIso: start.toISOString(),
    endIso:   end.toISOString(),
    sport: 'hm2026',
    station: 'youtube',
    channelName: 'YouTube',
    title: 'Góðan daginn Epic Ameríka',
    sub: 'Dr. Football',
    comp: 'Dr. Football Podcast',
    status,
    subjects: [{ key: 'c:drfootball', label: 'Dr. Football', type: 'comp' }],
    image: null,
    sourceUrl: 'https://www.youtube.com/@Dr.FootballPodcast',
  };
}

// ── CrossFit Games — handvirk YouTube dagskrárfærsla ───────────────────────
// Streymt frítt á opinberu CrossFit Games YouTube rásinni, aðgengilegt um
// allan heim — svo við sýnum þetta í öllum löndum. Nákvæm dagskrá hvers dags
// er ekki birt fyrirfram (æfingar afhjúpaðar jafnóðum), svo við notum breiðan
// dagsglugga sem nær yfir aðal-útsendingartímann (síðdegis/kvöld ísl. tíma).
const CROSSFIT_START   = '2026-07-21';
const CROSSFIT_END     = '2026-07-26';
const CROSSFIT_CHANNEL = 'UCRs1pHnES3QDdh43xbjOmzw'; // @CrossFitGamesTV

function crossFitMeta(dateStr) {
  // Masters keppa 21.–23. júlí, einstaklingar & lið 24.–26. júlí.
  const isMasters = dateStr <= '2026-07-23';
  return {
    sport: 'crossfit',
    title: 'CrossFit Games 2026',
    sub: isMasters ? 'Masters' : 'Individuals & Teams',
    comp: 'CrossFit Games',
    subjects: [{ key: 'c:crossfitgames', label: 'CrossFit Games', type: 'comp' }],
  };
}

// Fallback: one fixed daily block (15:00–23:59 Iceland time) when we can't get
// real stream times from the YouTube API (no key configured, or the call failed).
function crossFitFallbackEvent(dateStr) {
  const meta = crossFitMeta(dateStr);
  const now = new Date();
  const start = new Date(dateStr + 'T15:00:00Z');
  const end   = new Date(dateStr + 'T23:59:00Z');
  let status = 'upcoming';
  if (start <= now && now < end) status = 'live';
  else if (end < now) status = 'done';
  return {
    id: `crossfit-${dateStr}`,
    time: '15:00', endTime: '23:59',
    startIso: start.toISOString(), endIso: end.toISOString(),
    station: 'youtube', channelName: 'YouTube', status,
    image: null, sourceUrl: 'https://www.youtube.com/@CrossFitGamesTV/streams',
    ...meta,
  };
}

// Manual global YouTube events shown in every country, added fresh to each
// response (never persisted to cache, so live/upcoming/done stays correct).
// During the CrossFit Games we pull the ACTUAL scheduled/live streams from the
// YouTube Data API (exact times, may be several per day); if that's
// unavailable we fall back to a single fixed daily block.
async function globalManualEvents(dateStr, fetch) {
  const out = [];
  if (dateStr >= CROSSFIT_START && dateStr <= CROSSFIT_END) {
    const meta = crossFitMeta(dateStr);
    let streams = null;
    try {
      streams = await fetchYoutubeStreams(
        CROSSFIT_CHANNEL, dateStr, fetch, process.env.YOUTUBE_API_KEY, meta);
    } catch (e) { /* fall back below */ }
    if (streams && streams.length > 0) {
      out.push(...streams);
    } else {
      out.push(crossFitFallbackEvent(dateStr)); // no key / no streams found
    }
  }
  return out;
}

// ── Vercel handler ──────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Parse date from query param, default to today in Iceland time (UTC+0 year-round)
    let dateStr = req.query.date;
    if (!dateStr) {
      dateStr = new Date().toISOString().slice(0, 10);
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
      return;
    }

    // Country: 'is' (default) or 'se'
    const country = COUNTRY_FETCHERS[req.query.country] ? req.query.country : 'is';

    const debug = req.query.debug === '1';
    const meta = { cacheEnabled: !!SUPABASE_SERVICE_KEY, cacheHit: false, cacheAgeMin: null, servedStale: false };

    // 1) Durable cache — fresh entry short-circuits the upstream fan-out
    const cached = await cacheRead(country, dateStr);
    let events = null;
    let sources = null;
    // Complete fetches stay fresh for 45 min; partial ones retry after 10
    const freshMs = cached && cached.partial ? CACHE_FRESH_PARTIAL_MS : CACHE_FRESH_MS;
    if (cached && cached.ageMs < freshMs) {
      events = recomputeStatus(cached.events);
      meta.cacheHit = true;
      meta.partial = cached.partial;
      meta.cacheAgeMin = Math.round(cached.ageMs / 60000);
      console.log(`schedule_cache hit for ${country}/${dateStr} (${meta.cacheAgeMin} min old${cached.partial ? ', partial' : ''})`);
    } else if (country === 'se') {
      // 2a) Sweden: incremental fetch + merge (see fetchSwedenEvents).
      // After a full freshness cycle the channel bookkeeping resets so
      // everything gets re-fetched — but the old events stay as the base
      // until each channel's fresh data replaces them.
      const refreshSe = async () => {
        const state = cached ? {
          events: cached.events,
          okChannels: cached.ageMs >= CACHE_FRESH_MS ? [] : cached.okChannels,
        } : null;
        const date = new Date(dateStr + 'T00:00:00Z');
        const result = await fetchSwedenEvents(date, state);
        const evs = recomputeStatus(result.events);
        await cacheWrite(country, dateStr, {
          v: 3, events: evs, partial: result.partial,
          okChannels: result.okChannels, viaplayOk: result.viaplayOk,
        });
        return { events: evs, sources: result.sources, partial: result.partial };
      };

      if (cached && cached.ageMs < SERVE_STALE_MAX_MS && !debug) {
        // FAST PATH: serve what we have immediately, refresh after the
        // response is sent. The upstream pass (tv.nu pacing, retries) can
        // take many seconds — the user should never wait for it.
        events = recomputeStatus(cached.events);
        meta.cacheHit = true;
        meta.servedStale = true;
        meta.partial = cached.partial;
        meta.cacheAgeMin = Math.round(cached.ageMs / 60000);
        await runInBackground(refreshSe().catch((e) =>
          console.error('SE background refresh failed:', e.message)));
      } else {
        // No cache yet (or debug mode) — fetch inline
        const result = await refreshSe();
        events = result.events;
        sources = result.sources;
        meta.partial = result.partial;
      }
    } else {
      // 2b) Full upstream fan-out (Iceland)
      console.log(`Fetching events for ${dateStr} (${country})...`);
      const date = new Date(dateStr + 'T00:00:00Z');
      const result = await fetchAllEvents(date, country);
      sources = result.sources;
      const allFailed = sources.every((s) => s.error);
      const partial = sources.some((s) => s.error || s.failedChannels);
      meta.partial = partial;

      if (!allFailed) {
        events = result.events;
        // Bæta við Dr. Football YouTube þætti ef við á (aðeins Ísland)
        if (country === 'is') {
          const drFb = drFootballEvent(dateStr);
          if (drFb) events.push(drFb);
        }
        sortEvents(events);
        // Don't overwrite a fuller cached copy with a worse partial one
        const worseThanCache = partial && cached && cached.events.length > events.length;
        if (worseThanCache) {
          events = recomputeStatus(cached.events);
          meta.servedStale = true;
          meta.cacheAgeMin = Math.round(cached.ageMs / 60000);
        } else {
          // Persist (fire and forget); partial results get a shorter freshness
          cacheWrite(country, dateStr, { v: 2, events, partial });
        }
      } else if (cached) {
        // 3) Every upstream failed → serve the stale-but-real cached copy
        events = recomputeStatus(cached.events);
        meta.servedStale = true;
        meta.cacheAgeMin = Math.round(cached.ageMs / 60000);
        console.warn(`All sources failed for ${country}/${dateStr} — serving stale cache (${meta.cacheAgeMin} min old)`);
      } else {
        events = [];
      }
    }

    // Global manual YouTube events (CrossFit Games etc.) — added fresh to every
    // response regardless of country or cache path, so their live/upcoming/done
    // status is always current and they're never persisted stale.
    const manual = await globalManualEvents(dateStr, globalThis.fetch);
    if (manual.length) {
      events = [...events, ...manual];
      sortEvents(events);
    }

    console.log(`Total events for ${dateStr} (${country}): ${events.length}`);

    const payload = { date: dateStr, country, events, cached: meta.cacheHit || meta.servedStale };
    if (debug) {
      payload.sources = sources;
      payload.cacheInfo = meta;
      payload.region = process.env.VERCEL_REGION || 'unknown';
      // Which SUPABASE* env vars the function actually sees (names only —
      // values are never exposed). Diagnoses "cacheEnabled: false" mysteries.
      payload.supabaseEnvKeys = Object.keys(process.env)
        .filter((k) => k.toUpperCase().includes('SUPABASE'));
      // debug always bypasses the edge cache so the numbers are fresh
      res.setHeader('Cache-Control', 'no-store');
    } else if (events.length === 0 && sources && sources.every((s) => s.error)) {
      // Total failure with nothing to fall back on — never cache an empty answer
      res.setHeader('Cache-Control', 'no-store');
    } else if (meta.servedStale) {
      // Served from cache while refreshing in the background — very short
      // edge cache so the refreshed data reaches users on the next request
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=600');
    } else if (meta.partial) {
      // Incomplete (incremental fill in progress) — short edge cache so the
      // next step's fuller result reaches users quickly
      res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
    } else {
      // Cache at the Vercel CDN edge for 5 minutes; serve stale for up to an
      // hour while revalidating — keeps most traffic off the upstream APIs.
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
    }
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(payload);
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'Failed to fetch schedule', message: err.message });
  }
}
