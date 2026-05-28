// Fetches sports schedule from Viaplay Iceland's public content API.
// Endpoint: https://content.viaplay.is/pcdash-is/sport/all
// No authentication required for schedule metadata.
// Note: actual streaming requires a Viaplay subscription.
// Only returns live broadcasts (system.flags includes 'liveStream').

const BASE_URL = 'https://content.viaplay.is/pcdash-is/sport/all';

// Map Viaplay's publicPath prefixes to our sport IDs
const VIAPLAY_SPORT_MAP = {
  'knattspyrna':        'fb',
  'football':           'fb',
  'soccer':             'fb',
  'handbolti':          'hb',
  'handball':           'hb',
  'körfubolti':         'kb',
  'basketball':         'kb',
  'motorsport':         'f1',
  'motogp':             'f1',
  'formula-1':          'f1',
  'formula1':           'f1',
  'rally':              'f1',
  'tennis':             'tennis',
  'golf':               'golf',
  'mma':                'mma',
  'boxing':             'mma',
  'ishokki':            'hockey',
  'icehockey':          'hockey',
  'hockey':             'hockey',
  'ski':                'ski',
  'skiing':             'ski',
  'biathlon':           'ski',
  'crosscountry':       'ski',
  'snooker':            'snooker',
  'billiards':          'pool',
  'pool':               'pool',
  'baseball':           'baseball',
  'softball':           'baseball',
  'darts':              'darts',
  'gymnastics':         'gym',
  'fimleikar':          'gym',
  'cycling':            'cycling',
  'hjolreidar':         'cycling',
  'athletics':          'athletics',
  'frjalsaridrottir':   'athletics',
  'rugby':              'rugby',
  'american-football':  'rugby',
  'nfl':                'rugby',
  'other':              'fb',
};

function detectViaplaySport(publicPath, title) {
  if (publicPath) {
    const prefix = publicPath.split('/')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    if (VIAPLAY_SPORT_MAP[prefix]) return VIAPLAY_SPORT_MAP[prefix];
  }
  // Fall back to title keyword matching
  const t = (title || '').toLowerCase();
  if (t.includes('formula') || t.includes('grand prix') || t.includes('motogp') ||
      t.includes('nascar') || t.includes('rally') || t.includes('motorsport')) return 'f1';
  if (t.includes('football') || t.includes('fótbolti') || t.includes('premier league') ||
      t.includes('champions league') || t.includes('bundesliga')) return 'fb';
  if (t.includes('tennis')) return 'tennis';
  if (t.includes('golf')) return 'golf';
  if (t.includes('hockey') || t.includes('nhl')) return 'hockey';
  if (t.includes('basketball') || t.includes('nba')) return 'kb';
  if (t.includes('handball') || t.includes('handbolti')) return 'hb';
  if (t.includes('snooker')) return 'snooker';
  if (t.includes('darts')) return 'darts';
  if (t.includes('cycling') || t.includes('tour de france')) return 'cycling';
  if (t.includes('rugby') || t.includes('nfl')) return 'rugby';
  if (t.includes('athletics') || t.includes('marathon')) return 'athletics';
  return 'fb';
}

function buildSubjects(title, formatTitle, sport) {
  const subjects = [];
  if (formatTitle) {
    const slug = formatTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    subjects.push({ key: `c:vp-${slug}`, label: formatTitle, type: 'comp' });
  }
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

  if (!epg.start) return null;

  // ── Live-only filter ──────────────────────────────────────────────────────
  // Only include programmes flagged as live streams.
  const flags = system.flags || [];
  const isLiveStream = flags.includes('liveStream') || flags.includes('isLive');
  if (!isLiveStream) return null;

  const start = new Date(epg.start);
  const end = new Date(epg.end || epg.streamEnd || epg.start);
  const now = new Date();

  let status = 'upcoming';
  if (start <= now && now < end) status = 'live';
  else if (end < now) status = 'done';

  const timeStr = start.toLocaleTimeString('is-IS', { hour: '2-digit', minute: '2-digit', timeZone: 'Atlantic/Reykjavik' });
  const endTimeStr = end.toLocaleTimeString('is-IS', { hour: '2-digit', minute: '2-digit', timeZone: 'Atlantic/Reykjavik' });

  const publicPath = product.publicPath || '';
  const pathParts = publicPath.split('/');
  let title = content.title || '';
  if (!title && pathParts.length >= 3) {
    title = pathParts[pathParts.length - 2]
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
  if (!title) title = content.seriesTitle || 'Íþróttaviðburður';

  const sport = detectViaplaySport(publicPath, title);
  const formatTitle = content.format?.title || content.seriesTitle || '';
  const seasonTitle = content.format?.season?.title || '';
  const sub = formatTitle ? `${formatTitle}${seasonTitle ? ' · ' + seasonTitle : ''}` : '';

  const images = content.images || {};
  const imageUrl = images.landscape?.url || images.boxart?.url || null;

  // Channel name: Viaplay doesn't expose a sub-channel, use the sport category
  const channelName = 'Viaplay';

  return {
    id: `viaplay-${system.guid || publicPath.replace(/\//g, '-')}`,
    time: timeStr,
    endTime: endTimeStr,
    startIso: epg.start,
    endIso: epg.end || epg.streamEnd,
    sport,
    station: 'viaplay',
    channelName,
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
  const dateStr = date.toISOString().slice(0, 10);
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

    console.log(`Viaplay live sports events: ${allEvents.length}`);
    return allEvents;
  } catch (err) {
    console.error('Viaplay fetch error:', err.message);
    return [];
  }
}
