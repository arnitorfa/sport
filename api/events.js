// Vercel serverless function — aggregates sports schedule per country.
//
// API:
//   GET /api/events?date=YYYY-MM-DD&country=is|se
//   GET /api/events                   — events for today, Iceland (default)
//
// Uses native fetch (Node 18+, no node-fetch needed).
// Edge caching via Cache-Control: s-maxage=300 (Vercel CDN caches for 5 minutes).

import { fetchRuvSchedule }    from '../fetchers/ruv.js';
import { fetchViaplaySchedule } from '../fetchers/viaplay.js';
import { fetchSynSchedule }    from '../fetchers/syn.js';
import { fetchSiminnSchedule } from '../fetchers/siminn.js';
import { fetchLiveySchedule }  from '../fetchers/livey.js';
import { fetchTvnuSchedule, fetchViaplaySeWithFallback } from '../fetchers/tvnu.js';

// ── Country → fetcher registry ─────────────────────────────────────────────
const COUNTRY_FETCHERS = {
  is: [
    { name: 'RÚV',        fn: fetchRuvSchedule },
    { name: 'Viaplay',    fn: fetchViaplaySchedule },
    { name: 'Sýn',        fn: fetchSynSchedule },
    { name: 'Síminn',     fn: fetchSiminnSchedule },
    { name: 'Lívey',      fn: fetchLiveySchedule },
  ],
  se: [
    { name: 'Viaplay SE', fn: fetchViaplaySeWithFallback },
    { name: 'tv.nu',      fn: fetchTvnuSchedule },
  ],
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
const CACHE_FRESH_PARTIAL_MS = 10 * 60 * 1000; // incomplete fetches retry sooner

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
    // Payload is either a bare events array (v1) or { events, partial } (v2)
    const raw = rows[0].payload;
    const events = Array.isArray(raw) ? raw : (raw?.events || []);
    const partial = Array.isArray(raw) ? false : !!raw?.partial;
    return {
      events,
      partial,
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
    const meta = { cacheHit: false, cacheAgeMin: null, servedStale: false };

    // 1) Durable cache — fresh entry short-circuits the upstream fan-out
    const cached = await cacheRead(country, dateStr);
    let events = null;
    let sources = null;
    // Complete fetches stay fresh for 45 min; partial ones retry after 10
    const freshMs = cached && cached.partial ? CACHE_FRESH_PARTIAL_MS : CACHE_FRESH_MS;
    if (cached && cached.ageMs < freshMs) {
      events = recomputeStatus(cached.events);
      meta.cacheHit = true;
      meta.cacheAgeMin = Math.round(cached.ageMs / 60000);
      console.log(`schedule_cache hit for ${country}/${dateStr} (${meta.cacheAgeMin} min old${cached.partial ? ', partial' : ''})`);
    } else {
      // 2) Upstream fan-out
      console.log(`Fetching events for ${dateStr} (${country})...`);
      const date = new Date(dateStr + 'T00:00:00Z');
      const result = await fetchAllEvents(date, country);
      sources = result.sources;
      const allFailed = sources.every((s) => s.error);
      const partial = sources.some((s) => s.error || s.failedChannels);

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

    console.log(`Total events for ${dateStr} (${country}): ${events.length}`);

    const payload = { date: dateStr, country, events, cached: meta.cacheHit || meta.servedStale };
    if (debug) {
      payload.sources = sources;
      payload.cacheInfo = meta;
      payload.region = process.env.VERCEL_REGION || 'unknown';
      // debug always bypasses the edge cache so the numbers are fresh
      res.setHeader('Cache-Control', 'no-store');
    } else if (events.length === 0 && sources && sources.every((s) => s.error)) {
      // Total failure with nothing to fall back on — never cache an empty answer
      res.setHeader('Cache-Control', 'no-store');
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
