// YouTube live/upcoming streams for a channel — via the YouTube Data API v3.
// Gives EXACT scheduled start times, live status and titles for each stream,
// which a channel can't otherwise expose (RSS only lists published videos).
//
// Requires a free API key (Google Cloud Console → YouTube Data API v3):
//   Vercel → Settings → Environment Variables → YOUTUBE_API_KEY = <key>
// Without a key this module returns null so callers can fall back gracefully.
//
// Quota: search.list costs 100 units each; we do live + upcoming = ~200 units
// per (cold) fetch, then one cheap videos.list (1 unit). The default free quota
// is 10,000 units/day — plenty given the in-memory cache below.

const API = 'https://www.googleapis.com/youtube/v3';

// Small in-memory cache (channelId+date → events). Warm lambdas reuse it so we
// don't spend quota on every request. 4-minute TTL keeps live status fresh.
const CACHE_TTL_MS = 4 * 60 * 1000;
const _cache = new Map();
const _inflight = new Map();

async function apiGet(path, fetch) {
  const resp = await fetch(`${API}/${path}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!resp.ok) throw new Error(`YouTube API HTTP ${resp.status}`);
  return resp.json();
}

// Search returns video IDs for a given eventType ('live' | 'upcoming').
async function searchVideoIds(channelId, eventType, apiKey, fetch) {
  const params = new URLSearchParams({
    part: 'id', channelId, type: 'video', eventType,
    maxResults: '20', key: apiKey,
  });
  const data = await apiGet(`search?${params}`, fetch);
  return (data.items || []).map((it) => it.id && it.id.videoId).filter(Boolean);
}

function statusFromDetails(d) {
  if (!d) return 'upcoming';
  if (d.actualEndTime) return 'done';
  if (d.actualStartTime) return 'live';
  return 'upcoming';
}

// Returns events for streams that START on `dateStr` (UTC date, matching the
// app's UTC-based date buckets). channelMeta carries the sport/station labels.
export async function fetchYoutubeStreams(channelId, dateStr, fetch, apiKey, channelMeta) {
  if (!apiKey) return null; // no key configured → let caller fall back

  const cacheKey = `${channelId}|${dateStr}`;
  const hit = _cache.get(cacheKey);
  if (hit && Date.now() - hit.t < CACHE_TTL_MS) return hit.v;
  if (_inflight.has(cacheKey)) return _inflight.get(cacheKey);

  const work = (async () => {
    // 1) Find live + upcoming video IDs
    const [live, upcoming] = await Promise.all([
      searchVideoIds(channelId, 'live', apiKey, fetch).catch(() => []),
      searchVideoIds(channelId, 'upcoming', apiKey, fetch).catch(() => []),
    ]);
    const ids = [...new Set([...live, ...upcoming])];
    if (ids.length === 0) return [];

    // 2) One videos.list call for titles + streaming details (1 quota unit)
    const params = new URLSearchParams({
      part: 'snippet,liveStreamingDetails',
      id: ids.join(','), key: apiKey,
    });
    const data = await apiGet(`videos?${params}`, fetch);

    const events = [];
    for (const v of data.items || []) {
      const d = v.liveStreamingDetails || {};
      const startStr = d.scheduledStartTime || d.actualStartTime;
      if (!startStr) continue;
      const start = new Date(startStr);
      if (isNaN(start)) continue;
      // Only streams starting on the requested UTC date
      if (start.toISOString().slice(0, 10) !== dateStr) continue;

      const end = d.actualEndTime ? new Date(d.actualEndTime)
        : new Date(start.getTime() + 3 * 60 * 60 * 1000); // assume ~3h if unknown
      const status = statusFromDetails(d);
      const sn = v.snippet || {};
      const thumb = sn.thumbnails && (sn.thumbnails.medium || sn.thumbnails.high || sn.thumbnails.default);

      events.push({
        id: `yt-${v.id}`,
        time: start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Atlantic/Reykjavik' }),
        endTime: end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Atlantic/Reykjavik' }),
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        sport: channelMeta.sport,
        station: 'youtube',
        channelName: 'YouTube',
        title: sn.title || channelMeta.title,
        sub: channelMeta.sub || '',
        comp: channelMeta.comp || '',
        status,
        subjects: channelMeta.subjects || [],
        image: thumb ? thumb.url : null,
        sourceUrl: `https://www.youtube.com/watch?v=${v.id}`,
      });
    }

    // Sort by start; there can legitimately be several streams per day
    events.sort((a, b) => new Date(a.startIso) - new Date(b.startIso));
    console.log(`YouTube ${channelId}: ${events.length} streams on ${dateStr}`);
    return events;
  })();

  _inflight.set(cacheKey, work);
  try {
    const v = await work;
    _cache.set(cacheKey, { t: Date.now(), v });
    return v;
  } catch (err) {
    console.warn(`YouTube fetch failed for ${channelId}:`, err.message);
    return null; // signal fallback
  } finally {
    _inflight.delete(cacheKey);
  }
}
