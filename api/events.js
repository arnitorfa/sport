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
      sources.push({ name: fetchers[i].name, count: result.value.length });
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

    console.log(`Fetching events for ${dateStr} (${country})...`);
    const date = new Date(dateStr + 'T00:00:00Z');
    const { events, sources } = await fetchAllEvents(date, country);

    // Bæta við Dr. Football YouTube þætti ef við á (aðeins Ísland)
    if (country === 'is') {
      const drFb = drFootballEvent(dateStr);
      if (drFb) events.push(drFb);
    }
    sortEvents(events);

    console.log(`Total events for ${dateStr} (${country}): ${events.length}`);

    const payload = { date: dateStr, country, events, cached: false };
    // ?debug=1 — include per-source counts/errors (bypasses the edge cache so
    // the numbers are always fresh).
    if (req.query.debug === '1') {
      payload.sources = sources;
      res.setHeader('Cache-Control', 'no-store');
    } else {
      // Cache at the Vercel CDN edge for 5 minutes; serve stale while revalidating for 60s
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    }
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(payload);
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'Failed to fetch schedule', message: err.message });
  }
}
