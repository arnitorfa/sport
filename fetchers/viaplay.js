// Fetches sports schedule from Viaplay Iceland's public content API.
// Endpoint: https://content.viaplay.is/pcdash-is/sport/all
// No authentication required for schedule metadata.
// Note: actual streaming requires a Viaplay subscription.

const BASE_URL = 'https://content.viaplay.is/pcdash-is/sport/all';

// Map Viaplay's publicPath prefixes to our sport IDs
const VIAPLAY_SPORT_MAP = {
  'knattspyrna':  'fb',
  'football':     'fb',
  'soccer':       'fb',
  'handbolti':    'hb',
  'handball':     'hb',
  'körfubolti':   'kb',
  'basketball':   'kb',
  'motorsport':   'f1',
  'motogp':       'f1',
  'tennis':       'tennis',
  'golf':         'golf',
  'mma':          'mma',
  'boxing':       'mma',
  'ishokki':      'hockey',
  'icehockey':    'hockey',
  'hockey':       'hockey',
  'ski':          'ski',
  'skiing':       'ski',
  'snooker':      'snooker',
  'billiards':    'snooker',
  'baseball':     'fb',   // closest sport icon available
  'american-football': 'fb',
  'rugby':        'fb',
  'cycling':      'ski',
  'athletics':    'ski',
  'swimming':     'ski',
  'other':        'fb',
};

function detectViaplaySport(publicPath) {
  if (!publicPath) return 'fb';
  const prefix = publicPath.split('/')[0].toLowerCase();
  return VIAPLAY_SPORT_MAP[prefix] || 'fb';
}

function buildSubjects(title, formatTitle, sport) {
  const subjects = [];
  if (formatTitle) {
    const slug = formatTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    subjects.push({ key: `c:vp-${slug}`, label: formatTitle, type: 'comp' });
  }
  // "Team A - Team B" or "Team A – Team B"
  const vsMatch = title.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (vsMatch) {
    for (const teamName of [vsMatch[1].trim(), vsMatch[2].trim()]) {
      const slug = teamName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      subjects.push({ key: `t:${slug}`, label: teamName, type: 'team' });
    }
  }
  return subjects;
}

function normalizeProduct(product) {
  const epg = product.epg || {};
  const content = product.content || {};
  const system = product.system || {};
  const recording = product.recording || {};

  if (!epg.start) return null;

  const start = new Date(epg.start);
  const end = new Date(epg.end || epg.streamEnd || epg.start);
  const now = new Date();

  let status = 'upcoming';
  if (start <= now && now < end) status = 'live';
  else if (end < now) status = 'done';

  const timeStr = start.toLocaleTimeString('is-IS', { hour: '2-digit', minute: '2-digit', timeZone: 'Atlantic/Reykjavik' });
  const endTimeStr = end.toLocaleTimeString('is-IS', { hour: '2-digit', minute: '2-digit', timeZone: 'Atlantic/Reykjavik' });

  const publicPath = product.publicPath || '';
  const sport = detectViaplaySport(publicPath);

  // Title: use content title or derive from publicPath
  const pathParts = publicPath.split('/');
  let title = content.title || '';
  if (!title && pathParts.length >= 3) {
    // "team-a-team-b" → "Team A - Team B"
    title = pathParts[pathParts.length - 2]
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
  if (!title) title = content.seriesTitle || 'Íþróttaviðburður';

  const formatTitle = content.format?.title || content.seriesTitle || '';
  const seasonTitle = content.format?.season?.title || '';
  const sub = formatTitle ? `${formatTitle}${seasonTitle ? ' · ' + seasonTitle : ''}` : '';

  const flags = system.flags || [];
  const isLiveStream = flags.includes('liveStream') || flags.includes('isLive');
  const airingType = recording.airingType || '';

  // Get image
  const images = content.images || {};
  const imageUrl = images.landscape?.url || images.boxart?.url || null;

  return {
    id: `viaplay-${system.guid || publicPath.replace(/\//g, '-')}`,
    time: timeStr,
    endTime: endTimeStr,
    startIso: epg.start,
    endIso: epg.end || epg.streamEnd,
    sport,
    station: 'viaplay',
    title,
    sub,
    comp: formatTitle,
    status,
    subjects: buildSubjects(title, formatTitle, sport),
    image: imageUrl,
    sourceUrl: `https://viaplay.is/${publicPath}`,
  };
}

export async function fetchViaplaySchedule(date, fetch) {
  // date: Date object
  const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
  const url = `${BASE_URL}?date=${dateStr}`;

  try {
    const resp = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; ithrottir-framundan/1.0)',
      },
    });
    if (!resp.ok) {
      console.warn(`Viaplay fetch failed: HTTP ${resp.status}`);
      return [];
    }
    const data = await resp.json();
    const blocks = data?._embedded?.['viaplay:blocks'] || [];
    const allEvents = [];

    for (const block of blocks) {
      const products = block?._embedded?.['viaplay:products'] || [];
      console.log(`Viaplay block "${block.title}": ${products.length} products`);
      for (const product of products) {
        const normalized = normalizeProduct(product);
        if (normalized) allEvents.push(normalized);
      }
    }

    console.log(`Viaplay sports events: ${allEvents.length}`);
    return allEvents;
  } catch (err) {
    console.error('Viaplay fetch error:', err.message);
    return [];
  }
}
