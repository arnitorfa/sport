// Fetches sports schedule for Swedish linear TV channels from tv.nu's public API.
// Endpoint: https://web-api.tv.nu/channels/{slug}/schedule?date=YYYY-MM-DD&fullDay=true
// No authentication required. Response: { data: { broadcasts: [...] } } where each
// broadcast has { title, description, genres: [{name}], broadcast: { startTime, endTime } }.
//
// Covers: SVT (SVT1/SVT2/SVT24), TV4-family (TV4, Sjuan, TV12, TV4 Fotboll,
// TV4 Hockey, TV4 Motor, TV4 Tennis, TV4 Sportkanalen, TV4 Sport Live 1–4),
// Eurosport 1/2 + Kanal 5/9 (Max/WBD) and ATG Live.
//
// V Sport channels are NOT part of the main channel list — Viaplay content
// comes from the Viaplay SE API (fetchers/viaplay.js) with richer metadata.
// If that API returns nothing (e.g. geo-blocked from the deployment region),
// fetchViaplaySeWithFallback() below falls back to the V Sport linear
// channels via tv.nu instead.

import { fetchViaplaySeSchedule } from './viaplay.js';

const BASE_URL = 'https://web-api.tv.nu/channels';
const TZ = 'Europe/Stockholm';

// Browser-like headers — some CDNs reject bare bot-ish requests.
const HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Referer': 'https://www.tv.nu/',
  'Origin': 'https://www.tv.nu',
};

// slug → { name: display channel name, station: station group id in data.js,
//          allSport: every broadcast is sport (dedicated sports channel) }
const CHANNELS = {
  // SVT — free-to-air (sport mixed with general programming)
  'svt1':             { name: 'SVT1',              station: 'svt',  allSport: false },
  'svt2':             { name: 'SVT2',              station: 'svt',  allSport: false },
  'svt24':            { name: 'SVT24',             station: 'svt',  allSport: false },
  // TV4-family
  'tv4':              { name: 'TV4',               station: 'tv4',  allSport: false },
  'sjuan':            { name: 'Sjuan',             station: 'tv4',  allSport: false },
  'tv12':             { name: 'TV12',              station: 'tv4',  allSport: false },
  'tv4-fotboll':      { name: 'TV4 Fotboll',       station: 'tv4',  allSport: true },
  'tv4-hockey':       { name: 'TV4 Hockey',        station: 'tv4',  allSport: true },
  'tv4-motor':        { name: 'TV4 Motor',         station: 'tv4',  allSport: true },
  'tv4-tennis':       { name: 'TV4 Tennis',        station: 'tv4',  allSport: true },
  'tv4-sportkanalen': { name: 'Sportkanalen',      station: 'tv4',  allSport: true },
  'tv4-sport-live-1': { name: 'TV4 Sport Live 1',  station: 'tv4',  allSport: true },
  'tv4-sport-live-2': { name: 'TV4 Sport Live 2',  station: 'tv4',  allSport: true },
  'tv4-sport-live-3': { name: 'TV4 Sport Live 3',  station: 'tv4',  allSport: true },
  'tv4-sport-live-4': { name: 'TV4 Sport Live 4',  station: 'tv4',  allSport: true },
  // Warner Bros. Discovery (Max) — Eurosport linear + Kanal 5/9
  'eurosport-1':      { name: 'Eurosport 1',       station: 'max',  allSport: true },
  'eurosport-2':      { name: 'Eurosport 2',       station: 'max',  allSport: true },
  'kanal-5':          { name: 'Kanal 5',           station: 'max',  allSport: false },
  'kanal-9':          { name: 'Kanal 9',           station: 'max',  allSport: false },
  // ATG Live — horse racing, free
  'atg-live':         { name: 'ATG Live',          station: 'atg',  allSport: true },
};

// V Sport linear channels — used only as a fallback when the Viaplay SE API
// returns nothing (see fetchViaplaySeWithFallback).
const V_SPORT_CHANNELS = {
  'v-sport-1':               { name: 'V Sport 1',               station: 'viaplay', allSport: true },
  'v-sport-extra':           { name: 'V Sport Extra',           station: 'viaplay', allSport: true },
  'v-sport-premium':         { name: 'V Sport Premium',         station: 'viaplay', allSport: true },
  'v-sport-football':        { name: 'V Sport Football',        station: 'viaplay', allSport: true },
  'v-sport-football-live-1': { name: 'V Sport Football Live 1', station: 'viaplay', allSport: true },
  'v-sport-football-live-2': { name: 'V Sport Football Live 2', station: 'viaplay', allSport: true },
  'v-sport-football-live-3': { name: 'V Sport Football Live 3', station: 'viaplay', allSport: true },
  'v-sport-live-1':          { name: 'V Sport Live 1',          station: 'viaplay', allSport: true },
  'v-sport-live-2':          { name: 'V Sport Live 2',          station: 'viaplay', allSport: true },
  'v-sport-live-3':          { name: 'V Sport Live 3',          station: 'viaplay', allSport: true },
  'v-sport-live-4':          { name: 'V Sport Live 4',          station: 'viaplay', allSport: true },
  'v-sport-live-5':          { name: 'V Sport Live 5',          station: 'viaplay', allSport: true },
  'v-sport-golf':            { name: 'V Sport Golf',            station: 'viaplay', allSport: true },
  'v-sport-motor':           { name: 'V Sport Motor',           station: 'viaplay', allSport: true },
  'v-sport-vinter':          { name: 'V Sport Vinter',          station: 'viaplay', allSport: true },
};

// ── Sport detection (Swedish genre names + title keywords) ──────────────────
const GENRE_MAP = {
  'fotboll':            'fb',
  'ishockey':           'hockey',
  'handboll':           'hb',
  'basket':             'kb',
  'motorsport':         'f1',
  'golf':               'golf',
  'tennis':             'tennis',
  'vintersport':        'ski',
  'friidrott':          'athletics',
  'cykling':            'cycling',
  'kampsport':          'mma',
  'trav':               'hesta',
  'galopp':             'hesta',
  'ridsport':           'hesta',
  'hastsport':          'hesta',
  'amerikansk fotboll': 'amfb',
  'baseboll':           'baseball',
  'snooker':            'snooker',
  'biljard':            'pool',
  'dart':               'darts',
  'simning':            'swimming',
  'volleyboll':         'volleyball',
  'gymnastik':          'gym',
  'schack':             'chess',
  'padel':              'padel',
  'rugby':              'rowing',
};

// Ordered keyword → sport id fallback for titles/descriptions.
const KEYWORDS = [
  [/formel ?1|formula 1|motogp|moto2|moto3|speedway|nascar|indycar|rally|dtm|superbike/i, 'f1'],
  [/fotboll|allsvenskan|superettan|premier league|champions league|bundesliga|la liga|serie a|damallsvenskan|landskamp|vm.?kval|em.?kval/i, 'fb'],
  [/ishockey|hockey|shl|nhl|hockeyallsvenskan/i, 'hockey'],
  [/handboll|handbolls/i, 'hb'],
  [/\bbasket|nba|euroleague/i, 'kb'],
  [/golf|pga|lpga|ryder cup/i, 'golf'],
  [/tennis|atp|wta|wimbledon|us open|french open|australian open/i, 'tennis'],
  [/langdskidor|längdskidor|skidskytte|alpint|vasaloppet|skidor|vinterstudion|backhoppning|snowboard|freeski|skicross/i, 'ski'],
  [/friidrott|maraton|diamond league/i, 'athletics'],
  [/cykel|cykling|tour de france|giro d|vuelta/i, 'cycling'],
  [/ufc|mma|boxning|kampsport/i, 'mma'],
  [/trav|galopp|v75|v86|ridsport|hoppning|dressyr/i, 'hesta'],
  [/amerikansk fotboll|\bnfl\b/i, 'amfb'],
  [/baseboll|\bmlb\b/i, 'baseball'],
  [/snooker/i, 'snooker'],
  [/biljard|\bpool\b/i, 'pool'],
  [/\bdart|pilkastning/i, 'darts'],
  [/simning|sim-vm|sim-em/i, 'swimming'],
  [/volleyboll|beachvolley/i, 'volleyball'],
  [/gymnastik/i, 'gym'],
  [/schack/i, 'chess'],
  [/padel/i, 'padel'],
  [/rugby/i, 'rowing'],
  [/esport|e-sport/i, 'other'],
];

function detectSport(title, description, genres, channel) {
  const genreNames = (genres || []).map(g => (g.name || '').toLowerCase());
  for (const g of genreNames) {
    if (GENRE_MAP[g]) return GENRE_MAP[g];
  }
  const text = `${title || ''} ${description || ''}`;
  for (const [re, sport] of KEYWORDS) {
    if (re.test(text)) return sport;
  }
  // Dedicated channels give a strong hint when nothing else matches
  if (channel.name.includes('Fotboll')) return 'fb';
  if (channel.name.includes('Hockey')) return 'hockey';
  if (channel.name.includes('Motor')) return 'f1';
  if (channel.name.includes('Tennis')) return 'tennis';
  if (channel.station === 'atg') return 'hesta';
  return 'other';
}

function isSportBroadcast(item, channel) {
  if (channel.allSport) return true;
  const genreNames = (item.genres || []).map(g => (g.name || '').toLowerCase());
  if (genreNames.some(g => g.includes('sport') || GENRE_MAP[g])) return true;
  return false;
}

// Slugify with Swedish/Nordic transliteration so "Djurgården" → "djurgarden".
function slugify(s) {
  return s.toLowerCase()
    .replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/é/g, 'e')
    .replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildSubjects(title) {
  const subjects = [];
  // "Lag A - Lag B" / "Lag A – Lag B"
  const vsMatch = (title || '').match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (vsMatch) {
    for (const teamName of [vsMatch[1].trim(), vsMatch[2].trim()]) {
      if (!teamName || teamName.length > 40) continue;
      const slug = slugify(teamName);
      if (slug) subjects.push({ key: `t:${slug}`, label: teamName, type: 'team' });
    }
  }
  return subjects;
}

function normalizeBroadcast(item, slug, channel, dateStr) {
  const b = item.broadcast || {};
  if (!b.startTime) return null;

  const start = new Date(b.startTime);
  const end = b.endTime ? new Date(b.endTime) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  if (isNaN(start)) return null;

  // Keep only broadcasts that start on the requested date (Stockholm time) —
  // fullDay=true can include late-night spillover from adjacent days.
  const evDate = start.toLocaleDateString('sv-SE', { timeZone: TZ });
  if (evDate !== dateStr) return null;

  const now = new Date();
  let status = 'upcoming';
  if (start <= now && now < end) status = 'live';
  else if (end < now) status = 'done';

  const title = item.title || 'Sportevenemang';
  const description = item.description || '';
  const sport = detectSport(title, description, item.genres, channel);
  // Prefer a specific genre ("Fotboll") over the generic "Sport" umbrella.
  const genreNames = (item.genres || []).map(g => g.name).filter(Boolean);
  const specificGenre = genreNames.find(g => g.toLowerCase() !== 'sport');

  return {
    id: `tvnu-${slug}-${item.id || start.toISOString()}`,
    time: start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: TZ }),
    endTime: end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: TZ }),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    sport,
    station: channel.station,
    channelName: channel.name,
    title,
    sub: description ? description.slice(0, 140) : '',
    comp: specificGenre || genreNames[0] || '',
    status,
    subjects: buildSubjects(title),
    image: null,
    sourceUrl: `https://www.tv.nu/kanal/${slug}`,
  };
}

async function fetchChannels(channels, date, fetch, label) {
  const dateStr = date.toISOString().slice(0, 10);

  const results = await Promise.allSettled(
    Object.entries(channels).map(async ([slug, channel]) => {
      const url = `${BASE_URL}/${slug}/schedule?date=${dateStr}&fullDay=true`;
      const resp = await fetch(url, { headers: HEADERS });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const broadcasts = data?.data?.broadcasts || [];
      const events = [];
      for (const item of broadcasts) {
        if (!isSportBroadcast(item, channel)) continue;
        const normalized = normalizeBroadcast(item, slug, channel, dateStr);
        if (normalized) events.push(normalized);
      }
      return events;
    })
  );

  const allEvents = [];
  const slugs = Object.keys(channels);
  const failures = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      allEvents.push(...r.value);
    } else {
      failures.push(`${slugs[i]}: ${r.reason?.message}`);
    }
  });
  if (failures.length) console.warn(`tv.nu(${label}) failures:`, failures.join(' | '));

  console.log(`tv.nu(${label}) sports events: ${allEvents.length} (${failures.length}/${slugs.length} channels failed)`);
  // If literally every channel failed, surface it as an error so the API's
  // debug mode shows the real cause instead of a silent empty list.
  if (failures.length === slugs.length) {
    throw new Error(`all ${slugs.length} channels failed — first: ${failures[0]}`);
  }
  return allEvents;
}

// Main tv.nu fetcher: SVT + TV4-family + Max/Eurosport + ATG.
export async function fetchTvnuSchedule(date, fetch) {
  return fetchChannels(CHANNELS, date, fetch, 'linear');
}

// Viaplay SE with fallback: try the Viaplay API first (richer metadata,
// includes streaming-only events); if it yields nothing, fall back to the
// V Sport linear channels via tv.nu.
export async function fetchViaplaySeWithFallback(date, fetch) {
  try {
    const evs = await fetchViaplaySeSchedule(date, fetch);
    if (evs.length > 0) return evs;
    console.warn('Viaplay SE API returned 0 events — falling back to V Sport via tv.nu');
  } catch (err) {
    console.warn('Viaplay SE API failed — falling back to V Sport via tv.nu:', err.message);
  }
  return fetchChannels(V_SPORT_CHANNELS, date, fetch, 'v-sport');
}
