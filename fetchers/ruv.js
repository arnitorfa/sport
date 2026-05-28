// Fetches sports schedule from RÚV's public GraphQL API
// Endpoint: https://spilari.nyr.ruv.is/gql/
// No authentication required.

const GQL_ENDPOINT = 'https://spilari.nyr.ruv.is/gql/';

const SCHEDULE_QUERY = `
  query getSchedule($channel: Channels!, $date: String!) {
    Schedule(channel: $channel, date: $date) {
      events {
        id
        title
        subtitle
        start_time
        end_time
        is_live
        is_rerun
        description
        image
        scope
        slug
        programId
        episodeId
      }
    }
  }
`;

// Keywords that identify sports programmes in RÚV's schedule.
// RÚV doesn't tag events by sport — we detect from title/description.
// Be strict: only match clear sports terms to avoid false positives.
const SPORT_KEYWORDS = {
  fb:      ['fótbolti', 'knattspyrna', 'umferð · besta', 'umferð · urvalsdeild', 'premier league',
            'champions league', 'besta deild', 'urvalsdeild', 'mls', 'bundesliga', 'la liga',
            'serie a', 'ligue 1', 'allsvenskan', 'eliteserien', 'landsleikur', 'meistaradeild',
            'europa league', 'world cup', 'em í fótbolta', 'hm í fótbolta', 'íþróttaviðburður'],
  hb:      ['handbolti', 'handball', 'em í handbolti', 'hm í handbolti'],
  kb:      ['körfubolti', 'basketball', 'nba', 'euroleague', 'em í körfubolta'],
  f1:      ['formúla 1', 'formula 1', ' gp ', 'grand prix', 'motogp', 'indycar', 'f1 keppni'],
  tennis:  ['tennis', 'wimbledon', 'roland garros', 'atp keppni', 'wta keppni'],
  golf:    ['golf', 'pga tour', 'masters golf', 'ryder cup'],
  mma:     [' mma ', 'boksíþróttir', ' ufc ', 'wrestling'],
  hockey:  ['íshokkí', 'ice hockey', ' nhl '],
  ski:     ['skíðakeppni', 'skíðahlaupamaður', 'slalom', 'alpine skiing', 'biathlon', 'langrenn'],
  snooker: ['snóker', 'snooker'],
};

// Title-only patterns — stronger signal (shown in TV guide headings)
const TITLE_SPORT_KEYWORDS = {
  fb:      ['fótbolti', 'knattspyrna', 'leikurinn', 'premier league', 'besta deild', 'urvalsdeild', 'meistaradeild'],
  hb:      ['handbolti'],
  kb:      ['körfubolti', 'nba'],
  f1:      ['formúla 1', 'formula 1', 'grand prix'],
  tennis:  ['tennis', 'wimbledon', 'roland garros'],
  golf:    ['golf'],
  mma:     ['mma', 'boxing', 'ufc'],
  hockey:  ['íshokkí', 'nhl'],
  ski:     ['skíðakeppni'],
  snooker: ['snóker', 'snooker'],
};

// Exact title matches — well-known RÚV sport show names
const EXACT_SPORT_TITLES = new Set([
  'íþróttir', 'íþróttadagurinn', 'leikurinn í dag', 'beint á netinu',
  'leiðin á hm', 'leiðin á em', 'knattspyrnuþátturinn',
]);

// Non-sport blacklist — if title matches these, always skip
const NON_SPORT_BLACKLIST = [
  'fréttir', 'kastljós', 'veður', 'vikinglottó', 'krakkaruv', 'krakkafréttir',
  'dagskrárlok', 'blaðamannafundur', 'spurningastofan', 'útsvar', 'þáttur',
  'heimaleikfimi', 'svanasöngur', 'heimilisl', 'okkar á milli', 'ray rannsakar',
];

function detectSport(title, subtitle, description) {
  const titleLow = title.toLowerCase();
  const text = `${titleLow} ${(subtitle || '').toLowerCase()} ${(description || '').toLowerCase()}`;

  // Blacklist check — skip obvious non-sport shows
  if (NON_SPORT_BLACKLIST.some(bl => titleLow.includes(bl))) return null;

  // Exact title match
  if (EXACT_SPORT_TITLES.has(titleLow.trim())) return 'fb';

  // Title-only check (high confidence)
  for (const [sport, keywords] of Object.entries(TITLE_SPORT_KEYWORDS)) {
    if (keywords.some(kw => titleLow.includes(kw))) return sport;
  }

  // Full text check (title + subtitle + description)
  for (const [sport, keywords] of Object.entries(SPORT_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) return sport;
  }

  return null;
}

function buildSubjects(title, subtitle, description, sport) {
  const subjects = [];
  // Extract competition from subtitle (e.g. "8. umferð · Besta deild karla")
  if (subtitle) {
    const parts = subtitle.split('·').map(s => s.trim());
    if (parts.length > 1) {
      const comp = parts[parts.length - 1];
      const slug = comp.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      subjects.push({ key: `c:${slug}`, label: comp, type: 'comp' });
    }
  }
  // If title looks like "Team A – Team B", extract teams
  const vsMatch = title.match(/^(.+?)\s*[–—-]\s*(.+)$/);
  if (vsMatch) {
    for (const teamName of [vsMatch[1].trim(), vsMatch[2].trim()]) {
      const slug = teamName.toLowerCase().replace(/[^a-záðéíóúýþæö0-9]+/g, '-').replace(/^-|-$/g, '');
      subjects.push({ key: `t:${slug}-${sport || 'fb'}`, label: teamName, type: 'team' });
    }
  }
  return subjects;
}

function normalizeEvent(ev, channel) {
  const title = ev.title || '';
  const subtitle = ev.subtitle || '';
  const description = ev.description || '';
  const sport = detectSport(title, subtitle, description);

  if (!sport) return null; // Not a sports event

  const start = new Date(ev.start_time);
  const end = new Date(ev.end_time);
  const now = new Date();

  let status = 'upcoming';
  if (ev.is_live && start <= now && now < end) status = 'live';
  else if (end < now) status = 'done';
  else if (start <= now) status = 'live';

  const timeStr = start.toLocaleTimeString('is-IS', { hour: '2-digit', minute: '2-digit', timeZone: 'Atlantic/Reykjavik' });
  const endTimeStr = end.toLocaleTimeString('is-IS', { hour: '2-digit', minute: '2-digit', timeZone: 'Atlantic/Reykjavik' });

  return {
    id: `ruv-${ev.id}`,
    time: timeStr,
    endTime: endTimeStr,
    startIso: ev.start_time,
    endIso: ev.end_time,
    sport,
    station: channel === 'ruv' ? 'ruv' : 'ruv',
    title: ev.title,
    sub: ev.subtitle || '',
    comp: ev.subtitle ? ev.subtitle.split('·').pop().trim() : '',
    status,
    subjects: buildSubjects(title, subtitle, description, sport),
    image: ev.image || null,
    sourceUrl: `https://www.ruv.is/sjonvarp/dagskra/${channel}`,
  };
}

export async function fetchRuvSchedule(date, fetch) {
  // date: Date object
  const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
  const channels = ['ruv', 'ruv2'];
  const allEvents = [];

  for (const channel of channels) {
    try {
      const resp = await fetch(GQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://www.ruv.is',
        },
        body: JSON.stringify({
          query: SCHEDULE_QUERY,
          variables: { channel, date: dateStr },
        }),
      });
      if (!resp.ok) {
        console.warn(`RÚV fetch failed for ${channel}: HTTP ${resp.status}`);
        continue;
      }
      const data = await resp.json();
      const events = data?.data?.Schedule?.events || [];
      console.log(`RÚV ${channel}: ${events.length} events total`);

      for (const ev of events) {
        const normalized = normalizeEvent(ev, channel);
        if (normalized) allEvents.push(normalized);
      }
    } catch (err) {
      console.error(`RÚV fetch error for ${channel}:`, err.message);
    }
  }

  console.log(`RÚV sports events: ${allEvents.length}`);
  return allEvents;
}
