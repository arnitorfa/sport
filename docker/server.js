// Íþróttir framundan — Docker/NAS backend server
// Runs as a standalone Express app inside the container.
// The Dockerfile copies:
//   fetchers/  → /app/fetchers/
//   public/    → /app/public/
//   docker/server.js → /app/server.js
//
// API:
//   GET /api/events?date=YYYY-MM-DD   — all sports events for a given date
//   GET /api/events                   — events for today
//   GET /health                       — health check

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Import fetchers (relative to /app/ inside the container)
import { fetchRuvSchedule }    from './fetchers/ruv.js';
import { fetchViaplaySchedule } from './fetchers/viaplay.js';
import { fetchSynSchedule }    from './fetchers/syn.js';
import { fetchSiminnSchedule } from './fetchers/siminn.js';
import { fetchLiveySchedule }  from './fetchers/livey.js';
import { fetchTvnuSchedule, fetchViaplaySeWithFallback } from './fetchers/tvnu.js';

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

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static frontend
const frontendPath = join(__dirname, 'public');
app.use(express.static(frontendPath));

// ── Simple in-memory cache ──────────────────────────────────────────────────
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached(dateStr) {
  const entry = cache.get(dateStr);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) { cache.delete(dateStr); return null; }
  return entry.data;
}

function setCached(dateStr, data) {
  cache.set(dateStr, { data, fetchedAt: Date.now() });
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
async function fetchAllEvents(date, country = 'is') {
  const f = globalThis.fetch; // Node 18+ native fetch
  const fetchers = COUNTRY_FETCHERS[country] || COUNTRY_FETCHERS.is;

  const results = await Promise.allSettled(fetchers.map(({ fn }) => fn(date, f)));

  const allEvents = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      console.log(`${fetchers[i].name}: ${result.value.length} events`);
      allEvents.push(...result.value);
    } else {
      console.error(`${fetchers[i].name} failed:`, result.reason?.message);
    }
  }

  return sortEvents(deduplicateEvents(allEvents));
}

// ── Routes ──────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Country pages — same SPA, country detected client-side from the URL path
app.get('/se', (req, res) => {
  res.sendFile(join(frontendPath, 'index.html'));
});

app.get('/api/events', async (req, res) => {
  try {
    let dateStr = req.query.date;
    if (!dateStr) {
      dateStr = new Date().toISOString().slice(0, 10);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    const country = COUNTRY_FETCHERS[req.query.country] ? req.query.country : 'is';
    const cacheKey = `${country}:${dateStr}`;

    const cached = getCached(cacheKey);
    if (cached) {
      console.log(`Cache hit for ${cacheKey}`);
      return res.json({ date: dateStr, country, events: cached, cached: true });
    }

    console.log(`Fetching events for ${dateStr} (${country})...`);
    const date = new Date(dateStr + 'T00:00:00Z');
    const events = await fetchAllEvents(date, country);

    setCached(cacheKey, events);
    console.log(`Total events for ${dateStr} (${country}): ${events.length}`);

    res.json({ date: dateStr, country, events, cached: false });
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'Failed to fetch schedule', message: err.message });
  }
});

// ── Prefetch tomorrow in the background ────────────────────────────────────
async function prefetchTomorrow() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().slice(0, 10);
  if (!getCached(dateStr)) {
    console.log(`Background prefetch: ${dateStr}`);
    const events = await fetchAllEvents(tomorrow);
    setCached(dateStr, events);
  }
}

// ── Start server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Íþróttir framundan server running on http://localhost:${PORT}`);
  console.log(`Frontend: http://localhost:${PORT}/`);
  console.log(`API:      http://localhost:${PORT}/api/events?date=YYYY-MM-DD`);
  setTimeout(prefetchTomorrow, 10_000);
});
