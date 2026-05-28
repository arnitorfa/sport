// Fetches sports schedule from Sýn's public EPG API.
// Endpoint: https://www.syn.is/api/epg/{channel}/{date}
// No authentication required — these are public Next.js API routes on syn.is.
// Note: Sýn Sport and Síminn Sport show the same channels; this fetcher covers both.

const EPG_BASE = 'https://www.syn.is/api/epg';

// Sports-only channels on the Sýn platform.
const SPORT_CHANNELS = [
  'synsport', 'synsport2', 'synsport3', 'synsport4',
  'synsportisland', 'synsportisland2', 'synsportisland3',
  'synsportisland4', 'synsportisland5',
  'synsportviaplay',
];

// KKI TV channels — dedicated basketball (Körfubolti Ísland) channels
const KKI_CHANNELS = ['kkitv1', 'kkitv2', 'kkitv3', 'kkitv4', 'kkitv5', 'kkitv6'];

// Map Sýn's "flokkur" comma-separated category to our sport IDs
function detectSport(flokkur, title) {
  const text = ((flokkur || '') + ' ' + (title || '')).toLowerCase();

  if (text.includes('football') || text.includes('fótbolti') ||
      text.includes('knattspyrna') || text.includes('premier league') ||
      text.includes('bundesliga') || text.includes('la liga') ||
      text.includes('serie a') || text.includes('ligue 1') ||
      text.includes('champions league') || text.includes('europa') ||
      text.includes('conference league') || text.includes('urvalsdeild') ||
      text.includes('besta deild') || text.includes('meistaradeild') ||
      text.includes('sambandsdeildin') || text.includes('lengjudeild') ||
      text.includes('allsvenskan') || text.includes('eliteserien'))
    return 'fb';

  if (text.includes('golf')) return 'golf';

  if (text.includes('tennis') || text.includes('wimbledon') ||
      text.includes('roland garros') || text.includes('us open') ||
      text.includes('australian open') || text.includes('atp') ||
      text.includes('wta'))
    return 'tennis';

  if (text.includes('basketball') || text.includes('körfubolti') ||
      text.includes('nba') || text.includes('euroleague'))
    return 'kb';

  if (text.includes('handball') || text.includes('handbolti')) return 'hb';

  if (text.includes('hockey') || text.includes('íshokkí') || text.includes('nhl')) return 'hockey';

  if (text.includes('formula') || text.includes(' f1') ||
      text.includes('grand prix') || text.includes('motogp') ||
      text.includes('indycar'))
    return 'f1';

  if (text.includes('mma') || text.includes('ufc') ||
      text.includes('boxing') || text.includes('boksíþróttir'))
    return 'mma';

  if (text.includes('ski') || text.includes('slalom') ||
      text.includes('biathlon') || text.includes('langrenn') ||
      text.includes('skíð'))
    return 'ski';

  if (text.includes('snooker') || text.includes('snóker')) return 'snooker';

  return 'fb'; // default to football icon for unrecognised sports
}

function buildSubjects(ev, sport) {
  const subjects = [];
  const matchTitle = ev.isltitill || ev.undirtitill || '';
  // "Team A - Team B" → extract both teams
  const vsMatch = matchTitle.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (vsMatch) {
    for (const name of [vsMatch[1].trim(), vsMatch[2].trim()]) {
      const slug = name.toLowerCase().replace(/[^a-záðéíóúýþæö0-9]+/g, '-').replace(/^-|-$/g, '');
      subjects.push({ key: `t:${slug}`, label: name, type: 'team' });
    }
  }
  if (ev.titill && ev.titill !== matchTitle) {
    const slug = ev.titill.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    subjects.push({ key: `c:syn-${slug}`, label: ev.titill, type: 'comp' });
  }
  return subjects;
}

function normalizeEvent(ev, channel, isKki = false) {
  if (!ev.upphaf) return null;

  const start = new Date(ev.upphaf);
  const now = new Date();
  // slott = duration in minutes
  const end = ev.slott
    ? new Date(start.getTime() + ev.slott * 60 * 1000)
    : new Date(start.getTime() + 90 * 60 * 1000); // fallback 90 min

  let status = 'upcoming';
  if (start <= now && now < end) status = 'live';
  else if (end < now) status = 'done';

  const timeStr = start.toLocaleTimeString('is-IS', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Atlantic/Reykjavik',
  });
  const endTimeStr = end.toLocaleTimeString('is-IS', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Atlantic/Reykjavik',
  });

  const sport = isKki ? 'kb' : detectSport(ev.flokkur, ev.titill);

  // Use isltitill as the main display title (it's usually the match title)
  const matchTitle = ev.isltitill || ev.undirtitill || ev.titill || '';
  const compTitle = (ev.isltitill && ev.titill && ev.isltitill !== ev.titill)
    ? ev.titill : '';

  return {
    id: `syn-${channel}-${ev.seria || ''}-${ev.thattur || ''}-${start.getTime()}`,
    time: timeStr,
    endTime: endTimeStr,
    startIso: ev.upphaf,
    endIso: end.toISOString(),
    sport,
    station: 'syn',
    title: matchTitle,
    sub: compTitle,
    comp: compTitle,
    status,
    live: ev.beint === 1,
    subjects: buildSubjects(ev, sport),
    image: null,
    sourceUrl: 'https://www.syn.is/sjonvarp/dagskra',
    channelName: ev.midill_heiti || channel,
  };
}

export async function fetchSynSchedule(date, fetch) {
  const dateStr = date.toISOString().slice(0, 10);
  const allEvents = [];

  await Promise.allSettled(
    [...SPORT_CHANNELS, ...KKI_CHANNELS].map(async (channel) => {
      try {
        const resp = await fetch(`${EPG_BASE}/${channel}/${dateStr}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ithrottir-framundan/1.0)' },
        });
        if (!resp.ok) {
          console.warn(`Sýn EPG failed for ${channel}: HTTP ${resp.status}`);
          return;
        }
        const events = await resp.json();
        if (!Array.isArray(events)) return;
        const isKki = channel.startsWith('kkitv');
        // The API returns a full month from the given date — filter to the
        // exact requested date using the dagsetning (YYYY-MM-DDT00:00:00Z) field.
        const filtered = events.filter(ev => (ev.dagsetning || '').slice(0, 10) === dateStr);
        console.log(`Sýn ${channel}: ${filtered.length}/${events.length} events on ${dateStr}`);
        for (const ev of filtered) {
          const normalized = normalizeEvent(ev, channel, isKki);
          if (normalized) allEvents.push(normalized);
        }
      } catch (err) {
        console.error(`Sýn fetch error for ${channel}:`, err.message);
      }
    })
  );

  // Deduplicate: same match can air on multiple channels simultaneously
  const seen = new Set();
  const unique = allEvents.filter(ev => {
    const key = ev.title.toLowerCase().replace(/\s+/g, '') + '|' + ev.startIso;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`Sýn sports events: ${unique.length} (deduped from ${allEvents.length})`);
  return unique;
}
