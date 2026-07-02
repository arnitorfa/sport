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

// ── Rate limiting ────────────────────────────────────────────────────────────
// tv.nu returns HTTP 429 when hammered with 30+ parallel requests. A module-
// level semaphore caps TOTAL concurrency across all fetchers in this module
// (linear + v-sport fallback run in parallel), and 429/5xx responses are
// retried with backoff.
const MAX_CONCURRENT = 2;
const REQUEST_SPACING_MS = 250; // pause per slot after each request — caps the sustained rate at ~4 req/s
let _active = 0;
const _waiters = [];

async function withSlot(fn) {
  if (_active >= MAX_CONCURRENT) {
    await new Promise((resolve) => _waiters.push(resolve));
  }
  _active++;
  try { return await fn(); }
  finally {
    // Hold the slot briefly so the overall request rate stays gentle
    await sleep(REQUEST_SPACING_MS);
    _active--;
    const next = _waiters.shift();
    if (next) next();
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Circuit breaker ──────────────────────────────────────────────────────────
// When tv.nu rate-limits us hard (429 on everything), continuing to fire
// requests only extends the penalty window. After CIRCUIT_THRESHOLD
// consecutive final 429 failures the circuit "opens": every call fails
// instantly (no HTTP traffic) for CIRCUIT_COOLDOWN_MS, then one request is
// let through to probe; a success closes the circuit again.
const CIRCUIT_THRESHOLD = 4;
const CIRCUIT_COOLDOWN_MS = 60 * 1000;
let _consecutive429 = 0;
let _circuitOpenUntil = 0;
let _probing = false;

function circuitOpen() {
  return Date.now() < _circuitOpenUntil;
}

function noteFailure429() {
  _consecutive429++;
  if (_consecutive429 >= CIRCUIT_THRESHOLD) {
    _circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
  }
}

function noteSuccess() {
  _consecutive429 = 0;
  _circuitOpenUntil = 0;
  _probing = false;
}

async function fetchJsonWithRetry(url, fetch, attempts = 4, deadline = Infinity) {
  // Circuit open → fail fast without touching tv.nu (allow one probe through)
  if (circuitOpen()) {
    if (_probing) throw new Error('HTTP 429 (circuit open)');
    _probing = true; // this call becomes the probe
  }
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      // Give up retrying when the overall time budget is spent — better to
      // return partial results than to blow the serverless maxDuration.
      if (Date.now() > deadline) break;
      if (circuitOpen() && !_probing) break;
      await sleep(700 * i + Math.random() * 400); // backoff + jitter
    }
    try {
      const resp = await fetch(url, { headers: HEADERS });
      if (resp.ok) { noteSuccess(); return resp.json(); }
      lastErr = new Error(`HTTP ${resp.status}`);
      // Retry only on rate limiting / server errors
      if (resp.status !== 429 && resp.status < 500) throw lastErr;
      // Honor Retry-After (seconds) when the server provides it
      const ra = resp.headers && resp.headers.get && parseInt(resp.headers.get('retry-after'), 10);
      if (ra > 0 && ra <= 10) await sleep(ra * 1000);
    } catch (err) {
      lastErr = err;
      if (!/HTTP (429|5\d\d)/.test(err.message)) throw err;
    }
  }
  if (/HTTP 429/.test(lastErr?.message || '')) noteFailure429();
  if (_probing) _probing = false;
  throw lastErr;
}

// In-memory response cache + single-flight, keyed by URL. Spares warm lambdas
// from re-fetching the same channel/date (e.g. v-sport fallback right after
// the linear pass, or repeated invocations within the TTL).
const CACHE_TTL_MS = 4 * 60 * 1000;
const _cache = new Map();

function cachedFetchJson(url, fetch, deadline) {
  const hit = _cache.get(url);
  if (hit && Date.now() - hit.t < CACHE_TTL_MS) return hit.p;
  const p = withSlot(() => fetchJsonWithRetry(url, fetch, 4, deadline));
  _cache.set(url, { t: Date.now(), p });
  // Drop failed promises from the cache so the next call retries fresh
  p.catch(() => { if (_cache.get(url)?.p === p) _cache.delete(url); });
  // Opportunistic pruning
  if (_cache.size > 600) {
    const cutoff = Date.now() - CACHE_TTL_MS;
    for (const [k, v] of _cache) { if (v.t < cutoff) _cache.delete(k); }
  }
  return p;
}

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
  // Warner Bros. Discovery (Max) — Eurosport linear
  // (Kanal 5/9 dropped: sport is rare there and every extra channel costs a
  //  request against tv.nu's tight rate limit)
  'eurosport-1':      { name: 'Eurosport 1',       station: 'max',  allSport: true },
  'eurosport-2':      { name: 'Eurosport 2',       station: 'max',  allSport: true },
  // ATG Live — horse racing, free
  'atg-live':         { name: 'ATG Live',          station: 'atg',  allSport: true },
};

// V Sport linear channels — used only as a fallback when the Viaplay SE API
// returns nothing (see fetchViaplaySeWithFallback). Core channels only:
// every extra channel is a request against tv.nu's tight rate limit.
const V_SPORT_CHANNELS = {
  'v-sport-1':               { name: 'V Sport 1',               station: 'viaplay', allSport: true },
  'v-sport-extra':           { name: 'V Sport Extra',           station: 'viaplay', allSport: true },
  'v-sport-premium':         { name: 'V Sport Premium',         station: 'viaplay', allSport: true },
  'v-sport-football':        { name: 'V Sport Football',        station: 'viaplay', allSport: true },
  'v-sport-live-1':          { name: 'V Sport Live 1',          station: 'viaplay', allSport: true },
  'v-sport-live-2':          { name: 'V Sport Live 2',          station: 'viaplay', allSport: true },
  'v-sport-golf':            { name: 'V Sport Golf',            station: 'viaplay', allSport: true },
  'v-sport-motor':           { name: 'V Sport Motor',           station: 'viaplay', allSport: true },
  'v-sport-vinter':          { name: 'V Sport Vinter',          station: 'viaplay', allSport: true },
};

// ── Sport detection (Swedish genre names + title keywords) ──────────────────
const GENRE_MAP = {
  'fotboll':            'fb',
  'ishockey':           'hockey',
  'hockey':             'hockey',
  'handboll':           'hb',
  'basket':             'kb',
  'motorsport':         'f1',
  'motor':              'f1',
  'golf':               'golf',
  'tennis':             'tennis',
  'vintersport':        'ski',
  'skidor':             'ski',
  'friidrott':          'athletics',
  'cykling':            'cycling',
  'kampsport':          'mma',
  'trav':               'hesta',
  'galopp':             'hesta',
  'ridsport':           'hesta',
  'hästsport':          'hesta',
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
  [/trav|galopp|v75|v86|v64|ridsport|hoppning|dressyr|stjärnkusken|kusk/i, 'hesta'],
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

// Non-events that shouldn't appear in the schedule (broadcast pauses etc.)
const SKIP_TITLES = /sändningsuppehåll|programuppehåll|end of programmes|testbild/i;

// Clean up tv.nu titles: "Grand Slam Wimbledon, | | 2026-07-01" →
// "Grand Slam Wimbledon". Strips pipe runs, trailing ISO dates and dangling
// punctuation.
function cleanTitle(raw) {
  return (raw || '')
    .replace(/\s*\|+\s*/g, ' ')                    // pipe separators → space
    .replace(/[,\s]*\d{4}-\d{2}-\d{2}\s*$/, '')    // trailing ISO date
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,·:–-]+|[\s,·:–-]+$/g, '')
    .trim();
}

// A plausible team/participant name: short, not just a number/date fragment.
function looksLikeTeam(s) {
  if (!s || s.length < 2 || s.length > 32) return false;
  if (/^[\d\s:.\/-]+$/.test(s)) return false;       // pure numbers/dates
  return true;
}

// tv.nu uses BOTH "Lag A - Lag B" and "Lag A: Lag B" (often with a
// competition prefix: "Superettan, Sundsvall: Öster"). Returns
// { teams: [a, b] | null, comp: 'Superettan' | null, displayTitle }.
function parseMatchup(title) {
  // Colon form — "left: right" (single colon)
  const colon = title.match(/^([^:]+):\s*([^:]+)$/);
  if (colon) {
    let left = colon[1].trim();
    const right = colon[2].trim();
    let comp = null;
    // Competition prefix before the last comma: "Superettan, Sundsvall"
    const lastComma = left.lastIndexOf(',');
    if (lastComma > 0) {
      comp = left.slice(0, lastComma).trim();
      left = left.slice(lastComma + 1).trim();
    }
    if (looksLikeTeam(left) && looksLikeTeam(right)) {
      return { teams: [left, right], comp, displayTitle: `${left} - ${right}` };
    }
  }
  // Dash form — require spaces around the dash so "2026-07-01" never splits
  const dash = title.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (dash) {
    const a = dash[1].trim(), b = dash[2].trim();
    if (looksLikeTeam(a) && looksLikeTeam(b)) {
      return { teams: [a, b], comp: null, displayTitle: title };
    }
  }
  return { teams: null, comp: null, displayTitle: title };
}

function buildSubjects(teams) {
  if (!teams) return [];
  const subjects = [];
  for (const teamName of teams) {
    const slug = slugify(teamName);
    if (slug) subjects.push({ key: `t:${slug}`, label: teamName, type: 'team' });
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

  const rawTitle = cleanTitle(item.title) || 'Sportevenemang';
  if (SKIP_TITLES.test(rawTitle)) return null;
  const description = item.description || '';
  const sport = detectSport(rawTitle, description, item.genres, channel);
  const { teams, comp: titleComp, displayTitle } = parseMatchup(rawTitle);

  // comp priority: prefix from the title ("Superettan") → a genre that maps to
  // a sport ("Fotboll") → first non-generic genre → ''.
  const genreNames = (item.genres || []).map(g => g.name).filter(Boolean);
  const mappedGenre = genreNames.find(g => GENRE_MAP[g.toLowerCase()]);
  const specificGenre = genreNames.find(g => g.toLowerCase() !== 'sport');
  const comp = titleComp || mappedGenre || specificGenre || '';

  return {
    id: `tvnu-${slug}-${item.id || start.toISOString()}`,
    time: start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: TZ }),
    endTime: end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: TZ }),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    sport,
    station: channel.station,
    channelName: channel.name,
    title: displayTitle,
    sub: description ? description.slice(0, 140) : '',
    comp,
    status,
    subjects: buildSubjects(teams),
    image: null,
    sourceUrl: `https://www.tv.nu/kanal/${slug}`,
  };
}

async function fetchChannels(channels, date, fetch, label) {
  const dateStr = date.toISOString().slice(0, 10);
  // Overall time budget for this pass — retries stop once it's spent, so the
  // serverless function (maxDuration 30s) always returns what it has.
  const deadline = Date.now() + 20000;

  const results = await Promise.allSettled(
    Object.entries(channels).map(async ([slug, channel]) => {
      const url = `${BASE_URL}/${slug}/schedule?date=${dateStr}&fullDay=true`;
      const data = await cachedFetchJson(url, fetch, deadline);
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
  // Partial-failure metadata for the API layer (non-JSON property on the
  // array — invisible in the response, visible to fetchAllEvents).
  allEvents.failedChannels = failures.length;
  allEvents.totalChannels = slugs.length;
  return allEvents;
}

// The in-flight linear pass — the v-sport fallback waits for it so the two
// passes never compete for the rate-limited budget at the same time (and the
// prioritised SVT/TV4 channels always go first).
let _linearPass = null;

// Main tv.nu fetcher: SVT + TV4-family + Eurosport + ATG.
export async function fetchTvnuSchedule(date, fetch) {
  _linearPass = fetchChannels(CHANNELS, date, fetch, 'linear');
  try { return await _linearPass; }
  finally { _linearPass = null; }
}

// Viaplay SE with fallback: try the Viaplay API first (richer metadata,
// includes streaming-only events); if it yields nothing, fall back to the
// V Sport linear channels via tv.nu — but only after the linear pass is done.
export async function fetchViaplaySeWithFallback(date, fetch) {
  let vpReason = '0 events';
  try {
    const evs = await fetchViaplaySeSchedule(date, fetch);
    if (evs.length > 0) return evs;
    console.warn('Viaplay SE API returned 0 events — falling back to V Sport via tv.nu');
  } catch (err) {
    vpReason = err.message;
    console.warn('Viaplay SE API failed — falling back to V Sport via tv.nu:', err.message);
  }
  // Let the linear channels finish first — they matter more than the fallback
  if (_linearPass) await _linearPass.catch(() => {});
  try {
    return await fetchChannels(V_SPORT_CHANNELS, date, fetch, 'v-sport');
  } catch (err) {
    throw new Error(`viaplay api: ${vpReason}; v-sport fallback: ${err.message}`);
  }
}
