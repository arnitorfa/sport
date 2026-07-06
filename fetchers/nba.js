// NBA schedule — every game is available on NBA League Pass in Sweden.
// Source: NBA's public CDN schedule file (full season, updated by the league):
//   https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json
// Shape: leagueSchedule.gameDates[].games[] with gameDateTimeUTC, gameLabel,
// homeTeam/awayTeam { teamCity, teamName, teamTricode }.
//
// The file covers one season (Oct–Jun). Off-season dates correctly yield no
// events; the file flips to the new season when the NBA publishes it.

const SCHEDULE_URL = 'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json';
const TZ = 'Europe/Stockholm';
const GAME_DURATION_MS = 2.5 * 60 * 60 * 1000;

// Module-level cache of the parsed schedule, indexed by Stockholm date.
// The file is ~100 KB and changes rarely — 6 h TTL is plenty.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let _index = null;      // Map<'YYYY-MM-DD', game[]>
let _indexAt = 0;
let _inflight = null;

function slugify(s) {
  return s.toLowerCase()
    .replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/é/g, 'e')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function loadIndex(fetch) {
  if (_index && Date.now() - _indexAt < CACHE_TTL_MS) return _index;
  if (_inflight) return _inflight;
  _inflight = (async () => {
    const resp = await fetch(SCHEDULE_URL, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; sportzone/1.0)' },
    });
    if (!resp.ok) throw new Error(`NBA schedule HTTP ${resp.status}`);
    const data = await resp.json();
    const gameDates = data?.leagueSchedule?.gameDates || [];
    const index = new Map();
    for (const gd of gameDates) {
      for (const game of gd.games || []) {
        if (!game.gameDateTimeUTC) continue;
        const start = new Date(game.gameDateTimeUTC);
        if (isNaN(start)) continue;
        const key = start.toLocaleDateString('sv-SE', { timeZone: TZ });
        if (!index.has(key)) index.set(key, []);
        index.get(key).push(game);
      }
    }
    _index = index;
    _indexAt = Date.now();
    console.log(`NBA schedule loaded: ${index.size} game dates`);
    return index;
  })();
  try { return await _inflight; }
  finally { _inflight = null; }
}

function normalizeGame(game) {
  const start = new Date(game.gameDateTimeUTC);
  const end = new Date(start.getTime() + GAME_DURATION_MS);
  const now = new Date();
  let status = 'upcoming';
  if (start <= now && now < end) status = 'live';
  else if (end < now) status = 'done';

  const home = game.homeTeam || {};
  const away = game.awayTeam || {};
  const homeName = home.teamName || home.teamTricode || 'TBD';
  const awayName = away.teamName || away.teamTricode || 'TBD';
  const title = `${homeName} - ${awayName}`;

  // "East Conf. Semifinals · Game 2 · DET leads 1-0"
  const subParts = [game.gameSubLabel, game.seriesText].filter(Boolean);
  const comp = game.gameLabel || 'NBA';

  const subjects = [
    { key: 'c:nba', label: 'NBA', type: 'comp' },
    { key: `t:${slugify(homeName)}`, label: homeName, type: 'team' },
    { key: `t:${slugify(awayName)}`, label: awayName, type: 'team' },
  ];

  return {
    id: `nba-${game.gameId}`,
    time: start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: TZ }),
    endTime: end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: TZ }),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    sport: 'kb',
    station: 'nba',
    channelName: 'NBA League Pass',
    title,
    sub: subParts.join(' · '),
    comp: comp === 'NBA' ? 'NBA' : `NBA · ${comp}`,
    status,
    subjects,
    image: null,
    sourceUrl: 'https://www.nba.com/schedule',
  };
}

export async function fetchNbaSchedule(date, fetch) {
  const dateStr = date.toISOString().slice(0, 10);
  const index = await loadIndex(fetch);
  const games = index.get(dateStr) || [];
  const events = games.map(normalizeGame);
  console.log(`NBA: ${events.length} games on ${dateStr}`);
  return events;
}
