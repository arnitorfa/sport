// NFL schedule — in Sweden NFL streams on DAZN (NFL Game Pass).
// Source: ESPN's public scoreboard API:
//   https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=YYYYMMDD
// The `dates` parameter is interpreted in US Eastern time, and US evening
// games start after midnight Stockholm time — so we query both the requested
// Stockholm date and the day before, then filter by actual Stockholm date.

const BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
const TZ = 'Europe/Stockholm';
const GAME_DURATION_MS = 3.25 * 60 * 60 * 1000;

// ESPN 403s bot-ish User-Agents from datacenter IPs — send full browser headers.
const HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Referer': 'https://www.espn.com/nfl/',
  'Origin': 'https://www.espn.com',
};

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function normalizeEvent(ev) {
  const comp = ev.competitions && ev.competitions[0];
  if (!comp || !ev.date) return null;
  const start = new Date(ev.date);
  if (isNaN(start)) return null;
  const end = new Date(start.getTime() + GAME_DURATION_MS);
  const now = new Date();
  let status = 'upcoming';
  if (start <= now && now < end) status = 'live';
  else if (end < now) status = 'done';

  const competitors = comp.competitors || [];
  const home = competitors.find((c) => c.homeAway === 'home')?.team;
  const away = competitors.find((c) => c.homeAway === 'away')?.team;
  const homeName = home?.displayName || 'TBD';
  const awayName = away?.displayName || 'TBD';
  const title = `${homeName} - ${awayName}`;

  // Week/round label, e.g. "Week 12" or "Super Bowl"
  const note = (comp.notes && comp.notes[0]?.headline) || '';
  const weekTxt = ev.week?.text || note || '';

  const subjects = [
    { key: 'c:nfl', label: 'NFL', type: 'comp' },
    { key: `t:${slugify(homeName)}`, label: homeName, type: 'team' },
    { key: `t:${slugify(awayName)}`, label: awayName, type: 'team' },
  ];

  return {
    id: `nfl-${ev.id}`,
    time: start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: TZ }),
    endTime: end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: TZ }),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    sport: 'amfb',
    station: 'dazn',
    channelName: 'DAZN · NFL Game Pass',
    title,
    sub: weekTxt,
    comp: weekTxt ? `NFL · ${weekTxt}` : 'NFL',
    status,
    subjects,
    image: null,
    sourceUrl: 'https://www.dazn.com/',
  };
}

export async function fetchNflSchedule(date, fetch) {
  const dateStr = date.toISOString().slice(0, 10);
  const dayBefore = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');

  const results = await Promise.allSettled(
    [fmt(dayBefore), fmt(date)].map(async (ds) => {
      const resp = await fetch(`${BASE_URL}?dates=${ds}`, { headers: HEADERS });
      if (!resp.ok) throw new Error(`ESPN NFL HTTP ${resp.status}`);
      const data = await resp.json();
      return data?.events || [];
    })
  );

  const seen = new Set();
  const events = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const ev of r.value) {
      if (seen.has(ev.id)) continue;
      seen.add(ev.id);
      const normalized = normalizeEvent(ev);
      if (!normalized) continue;
      // Keep only games that start on the requested Stockholm date
      const evDate = new Date(normalized.startIso).toLocaleDateString('sv-SE', { timeZone: TZ });
      if (evDate === dateStr) events.push(normalized);
    }
  }
  // Both queries failed → surface the error (debug mode shows it)
  if (results.every((r) => r.status === 'rejected')) {
    throw new Error(results[0].reason?.message || 'ESPN NFL fetch failed');
  }

  console.log(`NFL (DAZN): ${events.length} games on ${dateStr}`);
  return events;
}
