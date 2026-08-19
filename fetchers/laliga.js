// La Liga (Spanish top flight) — from the 2026/27 season Disney+ holds the
// exclusive Nordic rights (all 380 matches, streamed via ESPN on Disney+) in
// Iceland, Sweden, Denmark and Finland, so every fixture is attributed to the
// Disney+ station.
//
// Data sources, in priority order (first one with a key wins):
//   1. API-Football (api-football.com) — the user's Pro subscription. Rich,
//      reliable, not IP-blocked. Env: API_FOOTBALL_KEY. La Liga = league 140.
//   2. football-data.org (free tier, competition PD). Env: FOOTBALL_DATA_API_KEY.
//   3. ESPN soccer scoreboard — no key, but ESPN HARD-BLOCKS datacenter IPs
//      (Vercel) with HTTP 403, so this only works from the Docker/NAS
//      deployment or locally.

const AF_URL = 'https://v3.football.api-sports.io/fixtures';
const AF_LEAGUE = 140; // La Liga (Primera División)
const FD_URL = 'https://api.football-data.org/v4/competitions/PD/matches';
const ESPN_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard';
const TZ = 'Europe/Stockholm';
const MATCH_DURATION_MS = 2 * 60 * 60 * 1000;

// api-football status codes → skip these (not actually broadcast)
const AF_SKIP = new Set(['PST', 'CANC', 'ABD', 'AWD', 'WO']);

// European season = start year. Aug 2026 → 2026; Mar 2027 → 2026.
function seasonForDate(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  return m >= 7 ? y : y - 1;
}

const ESPN_HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Referer': 'https://www.espn.com/soccer/',
  'Origin': 'https://www.espn.com',
};

function slugify(s) {
  return s.toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éè]/g, 'e').replace(/[íì]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildEvent(id, startIso, homeName, awayName) {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + MATCH_DURATION_MS);
  const now = new Date();
  let status = 'upcoming';
  if (start <= now && now < end) status = 'live';
  else if (end < now) status = 'done';

  return {
    id: `laliga-${id}`,
    time: start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: TZ }),
    endTime: end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: TZ }),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    sport: 'fb',
    station: 'disney',
    channelName: 'Disney+',
    title: `${homeName} - ${awayName}`,
    sub: '',
    comp: 'La Liga',
    status,
    subjects: [
      { key: 'c:laliga', label: 'La Liga', type: 'comp' },
      { key: `t:${slugify(homeName)}`, label: homeName, type: 'team' },
      { key: `t:${slugify(awayName)}`, label: awayName, type: 'team' },
    ],
    image: null,
    sourceUrl: 'https://www.disneyplus.com/',
  };
}

// ── API-Football (primary) — fixtures for one date ───────────────────────────
async function fetchFromApiFootball(dateStr, fetch, apiKey) {
  const season = seasonForDate(dateStr);
  const url = `${AF_URL}?league=${AF_LEAGUE}&season=${season}&date=${dateStr}&timezone=UTC`;
  const resp = await fetch(url, { headers: { 'x-apisports-key': apiKey } });
  if (!resp.ok) throw new Error(`API-Football HTTP ${resp.status}`);
  const data = await resp.json();
  // api-football reports request errors in a 200 body's `errors` field
  if (data.errors && (Array.isArray(data.errors) ? data.errors.length : Object.keys(data.errors).length)) {
    throw new Error(`API-Football error: ${JSON.stringify(data.errors)}`);
  }
  const events = [];
  for (const it of data.response || []) {
    const fx = it.fixture || {};
    const short = fx.status && fx.status.short;
    if (AF_SKIP.has(short)) continue;
    if (!fx.date) continue;
    if (fx.date.slice(0, 10) !== dateStr) continue; // timezone=UTC → date is UTC
    const home = it.teams && it.teams.home && it.teams.home.name;
    const away = it.teams && it.teams.away && it.teams.away.name;
    events.push(buildEvent(fx.id, fx.date, home || 'TBD', away || 'TBD'));
  }
  return events;
}

// ── football-data.org — full-season fetch, indexed by UTC date, cached 6h ────
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let _index = null;
let _indexAt = 0;
let _inflight = null;

function teamName(t) {
  // Prefer the short marketing name ("Real Madrid" over "Real Madrid CF")
  return (t && (t.shortName || t.name)) || 'TBD';
}

async function loadFdIndex(fetch, apiKey) {
  if (_index && Date.now() - _indexAt < CACHE_TTL_MS) return _index;
  if (_inflight) return _inflight;
  _inflight = (async () => {
    const resp = await fetch(FD_URL, { headers: { 'X-Auth-Token': apiKey } });
    if (!resp.ok) throw new Error(`football-data HTTP ${resp.status}`);
    const data = await resp.json();
    const index = new Map();
    for (const m of data.matches || []) {
      if (!m.utcDate) continue;
      const start = new Date(m.utcDate);
      if (isNaN(start)) continue;
      const key = start.toISOString().slice(0, 10);
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(buildEvent(m.id, m.utcDate, teamName(m.homeTeam), teamName(m.awayTeam)));
    }
    _index = index;
    _indexAt = Date.now();
    console.log(`La Liga (football-data): ${data.matches?.length || 0} matches indexed`);
    return index;
  })();
  try { return await _inflight; }
  finally { _inflight = null; }
}

async function fetchFromFootballData(dateStr, fetch, apiKey) {
  const index = await loadFdIndex(fetch, apiKey);
  const events = (index.get(dateStr) || []).map((e) => ({ ...e,
    // recompute status fresh (index may be up to 6h old)
    status: (() => {
      const s = new Date(e.startIso).getTime(), en = new Date(e.endIso).getTime(), n = Date.now();
      return n < s ? 'upcoming' : n < en ? 'live' : 'done';
    })(),
  }));
  return events;
}

// ── ESPN fallback (works off-Vercel) ─────────────────────────────────────────
async function fetchFromEspn(dateStr, fetch) {
  const ds = dateStr.replace(/-/g, '');
  const resp = await fetch(`${ESPN_URL}?dates=${ds}`, { headers: ESPN_HEADERS });
  if (!resp.ok) throw new Error(`ESPN La Liga HTTP ${resp.status}`);
  const data = await resp.json();
  const events = [];
  for (const ev of data?.events || []) {
    const comp = ev.competitions && ev.competitions[0];
    if (!comp || !ev.date) continue;
    if (ev.date.slice(0, 10) !== dateStr) continue;
    const competitors = comp.competitors || [];
    const home = competitors.find((c) => c.homeAway === 'home')?.team;
    const away = competitors.find((c) => c.homeAway === 'away')?.team;
    events.push(buildEvent(ev.id, ev.date, home?.displayName || 'TBD', away?.displayName || 'TBD'));
  }
  return events;
}

export async function fetchLaLigaSchedule(date, fetch) {
  const dateStr = date.toISOString().slice(0, 10);

  // 1) API-Football (user's Pro subscription) — preferred
  const afKey = process.env.API_FOOTBALL_KEY;
  if (afKey) {
    try {
      const events = await fetchFromApiFootball(dateStr, fetch, afKey);
      console.log(`La Liga (Disney+/API-Football): ${events.length} matches on ${dateStr}`);
      return events;
    } catch (err) {
      console.warn('API-Football failed, trying next source:', err.message);
    }
  }

  // 2) football-data.org
  const fdKey = process.env.FOOTBALL_DATA_API_KEY;
  if (fdKey) {
    try {
      const events = await fetchFromFootballData(dateStr, fetch, fdKey);
      console.log(`La Liga (Disney+/football-data): ${events.length} matches on ${dateStr}`);
      return events;
    } catch (err) {
      console.warn('football-data failed, trying ESPN:', err.message);
    }
  }

  // 3) ESPN (works off-Vercel only)
  const events = await fetchFromEspn(dateStr, fetch);
  console.log(`La Liga (Disney+/ESPN): ${events.length} matches on ${dateStr}`);
  return events;
}
