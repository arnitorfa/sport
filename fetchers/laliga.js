// La Liga (Spanish top flight) — from the 2026/27 season Disney+ holds the
// exclusive Nordic rights (all 380 matches, streamed via ESPN on Disney+) in
// Iceland, Sweden, Denmark and Finland. So every La Liga fixture is attributed
// to the Disney+ station.
//
// Source: ESPN's public soccer scoreboard API (same host we use for NFL):
//   https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard?dates=YYYYMMDD
// Kickoff time is event.date (UTC). We filter to the requested UTC date to
// match the app's UTC-based date buckets.

const BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard';
const TZ = 'Europe/Stockholm';
const MATCH_DURATION_MS = 2 * 60 * 60 * 1000;

function slugify(s) {
  return s.toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éè]/g, 'e').replace(/[íì]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function normalizeEvent(ev) {
  const comp = ev.competitions && ev.competitions[0];
  if (!comp || !ev.date) return null;
  const start = new Date(ev.date);
  if (isNaN(start)) return null;
  const end = new Date(start.getTime() + MATCH_DURATION_MS);

  const competitors = comp.competitors || [];
  const home = competitors.find((c) => c.homeAway === 'home')?.team;
  const away = competitors.find((c) => c.homeAway === 'away')?.team;
  const homeName = home?.displayName || home?.name || 'TBD';
  const awayName = away?.displayName || away?.name || 'TBD';
  const title = `${homeName} - ${awayName}`;

  // Status from time (recomputed again on cache reads, so this is just initial)
  const now = new Date();
  let status = 'upcoming';
  if (start <= now && now < end) status = 'live';
  else if (end < now) status = 'done';

  const subjects = [
    { key: 'c:laliga', label: 'La Liga', type: 'comp' },
    { key: `t:${slugify(homeName)}`, label: homeName, type: 'team' },
    { key: `t:${slugify(awayName)}`, label: awayName, type: 'team' },
  ];

  return {
    id: `laliga-${ev.id}`,
    time: start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: TZ }),
    endTime: end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: TZ }),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    sport: 'fb',
    station: 'disney',
    channelName: 'Disney+',
    title,
    sub: '',
    comp: 'La Liga',
    status,
    subjects,
    image: null,
    sourceUrl: 'https://www.disneyplus.com/',
  };
}

export async function fetchLaLigaSchedule(date, fetch) {
  const dateStr = date.toISOString().slice(0, 10);
  const ds = dateStr.replace(/-/g, '');

  const resp = await fetch(`${BASE_URL}?dates=${ds}`, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; sportzone/1.0)' },
  });
  if (!resp.ok) throw new Error(`ESPN La Liga HTTP ${resp.status}`);
  const data = await resp.json();

  const events = [];
  for (const ev of data?.events || []) {
    const normalized = normalizeEvent(ev);
    if (!normalized) continue;
    // Only fixtures kicking off on the requested UTC date
    if (normalized.startIso.slice(0, 10) !== dateStr) continue;
    events.push(normalized);
  }
  console.log(`La Liga (Disney+): ${events.length} matches on ${dateStr}`);
  return events;
}
