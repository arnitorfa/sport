// Shared data + sport icons + station logo helpers.
// Events are fetched live from the backend API — this file only holds the
// static reference data (sports, stations, dates) and utility functions.

window.IF_DATA = (function () {
  const sports = [
    // ── Primary row (always visible) ─────────────────────────────────────────
    { id: 'all',       name: 'Allt' },
    { id: 'fav',       name: 'Uppáhalds' },
    { id: 'fb',        name: 'Fótbolti' },
    { id: 'hb',        name: 'Handbolti' },
    { id: 'kb',        name: 'Körfubolti' },
    { id: 'amfb',      name: 'Ameríska' },
    { id: 'f1',        name: 'Akstursiþróttir' },
    { id: 'golf',      name: 'Golf' },
    { id: 'mma',       name: 'Bardagaíþróttir' },
    // ── Secondary row (Fleiri) ────────────────────────────────────────────────
    { id: 'hockey',    name: 'Íshokkí',          secondary: true },
    { id: 'ski',       name: 'Vetraríþróttir',   secondary: true },
    { id: 'snooker',   name: 'Snóker',           secondary: true },
    { id: 'baseball',  name: 'Hafnabolti',       secondary: true },
    { id: 'darts',     name: 'Pílukast',         secondary: true },
    { id: 'pool',      name: 'Pool',             secondary: true },
    { id: 'gym',       name: 'Fimleikar',        secondary: true },
    { id: 'chess',     name: 'Skák',             secondary: true },
    { id: 'padel',     name: 'Padel',            secondary: true },
    { id: 'rowing',    name: 'Ruðningur',        secondary: true },
    { id: 'volleyball',name: 'Blak',             secondary: true },
    { id: 'swimming',  name: 'Sund',             secondary: true },
    { id: 'athletics', name: 'Frjálsar',         secondary: true },
    { id: 'tennis',    name: 'Tennis',            secondary: true },
    { id: 'cycling',   name: 'Hjólreiðar',        secondary: true },
    { id: 'other',     name: 'Óflokkað',          secondary: true },
  ];

  const stations = [
    { id: 'ruv',     name: 'RÚV',          short: 'RÚV',     bg: '#0B5FFF', fg: '#FFFFFF',
      mark: { kind: 'serif',  text: 'RÚV' },
      defaultLogos: { forLight: 'assets/logos/ruv-black.svg', forDark: 'assets/logos/ruv-black.svg' } },
    { id: 'syn',     name: 'Sýn Sport',    short: 'SÝN',     bg: '#E63946', fg: '#FFFFFF',
      mark: { kind: 'stack',  top: 'Sýn', bot: 'Sport' },
      defaultLogos: { forLight: 'assets/logos/syn-black.svg', forDark: 'assets/logos/syn-black.svg' },
      logoScale: 0.78 },
    { id: 'siminn',  name: 'Síminn Sport', short: 'SÍMINN',  bg: '#00B5A1', fg: '#FFFFFF',
      mark: { kind: 'thin',   text: 'Síminn' },
      defaultLogos: { forLight: 'assets/logos/siminn-black.svg', forDark: 'assets/logos/siminn-black.svg' } },
    { id: 'viaplay', name: 'Viaplay',      short: 'VIAPLAY', bg: '#0F0F12', fg: '#FFFFFF',
      mark: { kind: 'italic', text: 'viaplay' },
      defaultLogos: { forLight: 'assets/logos/viaplay-black.svg', forDark: 'assets/logos/viaplay-black.svg' } },
    { id: 'livey',   name: 'Lívey',        short: 'LÍVEY',   bg: '#7B3FE4', fg: '#FFFFFF',
      mark: { kind: 'mono',   text: 'lívey' },
      defaultLogos: { forLight: 'assets/logos/livey-black.svg', forDark: 'assets/logos/livey-black.svg' },
      logoScale: 0.68 },
  ];

  // Build 10 dates: yesterday + today + 8 ahead, based on real current date.
  function buildDates() {
    const out = [];
    const base = new Date();
    // Reset to midnight in Iceland time (UTC+0)
    base.setUTCHours(0, 0, 0, 0);
    const weekdays = ['Sun', 'Mán', 'Þri', 'Mið', 'Fim', 'Fös', 'Lau'];
    for (let i = -1; i <= 8; i++) {
      const d = new Date(base);
      d.setUTCDate(base.getUTCDate() + i);
      out.push({
        offset: i,
        weekday: weekdays[d.getUTCDay()],
        day: d.getUTCDate(),
        month: d.getUTCMonth() + 1,
        year: d.getUTCFullYear(),
        isoDate: d.toISOString().slice(0, 10),
        label: i === 0 ? 'Í dag' : i === 1 ? 'Á morgun' : i === -1 ? 'Í gær' : null,
      });
    }
    return out;
  }
  const dates = buildDates();

  // ── Icelandic date formatter (no browser locale dependency) ──────────────
  const _weekdaysFull = ['Sunnudagur','Mánudagur','Þriðjudagur','Miðvikudagur','Fimmtudagur','Föstudagur','Laugardagur'];
  const _monthsFull   = ['janúar','febrúar','mars','apríl','maí','júní','júlí','ágúst','september','október','nóvember','desember'];

  // Returns e.g. "Mánudagur, 27. maí" or "Í dag" / "Á morgun" / "Í gær"
  function formatDateIs(isoDate) {
    // Check if it matches a known relative date
    const known = dates.find((d) => d.isoDate === isoDate);
    if (known && known.label) {
      // label is 'Í dag' / 'Á morgun' / 'Í gær' — append weekday for clarity
      const d = new Date(isoDate + 'T00:00:00Z');
      return `${known.label} — ${_weekdaysFull[d.getUTCDay()]}, ${d.getUTCDate()}. ${_monthsFull[d.getUTCMonth()]}`;
    }
    const d = new Date(isoDate + 'T00:00:00Z');
    return `${_weekdaysFull[d.getUTCDay()]}, ${d.getUTCDate()}. ${_monthsFull[d.getUTCMonth()]}`;
  }

  // ── Sport icon (monoline outline) ──────────────────────────────────────────
  function sportIcon(id, size = 22, strokeWidth = 1.5) {
    const wrap = (inner) => (
      `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`
    );
    switch (id) {
      case 'fb':
        return wrap(`
          <circle cx="11.98" cy="11.91" r="9.4"/>
          <polygon points="11.98 8.01 8.27 10.7 9.69 15.06 14.27 15.06 15.69 10.7"/>
          <line x1="11.98" y1="5.2"   x2="11.98" y2="8.01"/>
          <line x1="5.6"   y1="9.83"  x2="8.27"  y2="10.7"/>
          <line x1="15.69" y1="10.7"  x2="18.36" y2="9.83"/>
          <line x1="14.27" y1="15.06" x2="15.91" y2="17.34"/>
          <line x1="8.05"  y1="17.34" x2="9.69"  y2="15.06"/>
          <polyline points="8.96 3 11.98 5.2 15 3"/>
          <polyline points="19.64 17.35 15.91 17.34 14.74 20.89"/>
          <polyline points="19.52 6.29 18.36 9.83 21.38 12.03"/>
          <polyline points="4.32 17.35 8.06 17.34 9.22 20.89"/>
          <polyline points="4.44 6.29 5.6 9.83 2.58 12.03"/>
        `);
      case 'hb':
        return wrap(`
          <path d="M5.84,21.5l3.1-3.42c.33-.36.51-.84.51-1.33,0-.86.35-1.69.96-2.3l3.91-3.83c.35-.34.91-.34,1.25,0,.34.35.34.91,0,1.25,0,0,0,0-.01.01l-1.67,1.69c-.1.09-.11.25-.01.35.05.05.11.08.18.08h.33c.94,0,1.84-.34,2.54-.97l1.5-1.33.73-2.44c.08-.25.34-.4.6-.32.2.06.34.25.34.46v1.07c0,1.25-.48,2.46-1.34,3.37l-7.38,7.67"/>
          <path d="M19.16,9.23c0-3.73-3.02-6.75-6.75-6.75-3.73,0-6.75,3.02-6.75,6.75,0,2.71,1.62,5.15,4.11,6.21"/>
          <polyline points="15.77 11.67 17.48 10.69 17.48 7.76 14.94 6.3 12.41 7.76 9.87 6.3 7.34 7.76 7.34 10.69 9.87 12.15 12.41 10.69 13.52 11.37"/>
          <polyline points="9.87 6.3 10.93 3.61 13.89 3.61 14.94 6.3"/>
          <line x1="9.87" y1="12.09" x2="10.67" y2="14.14"/>
          <line x1="7.34" y1="7.76" x2="6.09" y2="6.82"/>
          <line x1="6.13" y1="11.68" x2="7.34" y2="10.69"/>
          <line x1="17.48" y1="10.69" x2="18.44" y2="11.46"/>
          <line x1="18.69" y1="6.79" x2="17.48" y2="7.76"/>
          <line x1="10.93" y1="3.63" x2="10.12" y2="2.95"/>
          <line x1="14.73" y1="2.89" x2="13.88" y2="3.63"/>
        `);
      case 'kb':
        return wrap(`
          <circle cx="12.1" cy="12.02" r="9.49"/>
          <path d="M4.85,18.14c-.91-2.41-.89-5.09.07-7.49h0c.36-.91.86-1.78,1.48-2.58.25-.32.53-.63.82-.93.4-.4.82-.76,1.26-1.08,2.86-2.07,6.54-2.5,9.74-1.29"/>
          <path d="M21.51,10.84c-2.57-2.38-4.15-2.68-5.92-2.71-1.88-.04-5.96.21-7.09-2.03-.07-.14-.12-.27-.16-.41-.31-1.05.19-1.98.74-2.63"/>
          <path d="M10.42,21.36c-2.19-1.79-2.68-3.13-2.98-4.67-.32-1.6-.72-4.94-2.51-6.05h0c-.18-.11-.37-.2-.58-.26-.15-.05-.29-.08-.43-.09-.43-.05-.82.03-1.16.19"/>
          <path d="M19.39,18.1c-3.19-1.16-6.86-3.57-10.22-6.93-1.01-1.01-1.94-2.05-2.77-3.1-.57-.71-1.09-1.43-1.57-2.14"/>
        `);
      case 'f1':
        // Motorsport: steering wheel
        return wrap(`
          <circle cx="12" cy="12" r="9"/>
          <circle cx="12" cy="12" r="3"/>
          <line x1="12" y1="3"  x2="12" y2="9"/>
          <line x1="3"  y1="12" x2="9"  y2="12"/>
          <line x1="21" y1="12" x2="15" y2="12"/>
          <line x1="5.6" y1="5.6"  x2="9.9" y2="9.9"/>
          <line x1="18.4" y1="5.6" x2="14.1" y2="9.9"/>
        `);
      case 'tennis':
        return wrap(`
          <circle cx="12" cy="12" r="9"/>
          <path d="M4 8 Q12 12 4 16 M20 8 Q12 12 20 16"/>
        `);
      case 'golf':
        return wrap(`
          <path d="M13.37,13.38c2.24-.69,3.87-2.81,3.87-5.31,0-3.07-2.45-5.56-5.47-5.56s-5.47,2.49-5.47,5.56c0,2.5,1.63,4.62,3.87,5.31"/>
          <path d="M13.23,11.37c.3,0,.55.25.55.56"/>
          <path d="M11.47,11.59c.3,0,.55.25.55.56"/>
          <path d="M10.38,9.71c.3,0,.55.25.55.56"/>
          <path d="M8.17,9.64c.3,0,.55.25.55.56"/>
          <path d="M7.63,7.67c.3,0,.55.25.55.56"/>
          <path d="M9.62,7.67c.3,0,.55.25.55.56"/>
          <path d="M8.12,5.87c.3,0,.55.25.55.56"/>
          <path d="M9.41,4.61c.3,0,.55.25.55.56"/>
          <path d="M9.58,11.31c.3,0,.55.25.55.56"/>
          <path d="M15.29,13.96c0,.75-.6,1.36-1.34,1.36h-.51l-.59.93c-.17.26-.27.56-.3.87l-.45,4.13c-.04.41-.63.41-.67,0l-.45-4.13c-.03-.31-.14-.61-.3-.87l-.59-.93h-.51c-.37,0-.71-.15-.95-.4-.24-.25-.39-.59-.39-.96,0-.32.25-.58.57-.58h5.92c.31,0,.57.26.57.58z"/>
          <line x1="10.09" y1="15.32" x2="11.77" y2="15.32"/>
          <line x1="13.44" y1="15.32" x2="12.94" y2="15.32"/>
        `);
      case 'hockey':
        return wrap(`
          <path d="M9.32,17.24c.91.39,2.45.65,4.21.65,1.66,0,3.13-.23,4.05-.58"/>
          <path d="M8.48,16.44c0-.8,2.26-1.45,5.05-1.45s5.06.65,5.06,1.45"/>
          <path d="M8.48,19.79c0,.8,2.26,1.45,5.05,1.45s5.06-.65,5.06-1.45"/>
          <line x1="18.59" y1="19.79" x2="18.59" y2="16.44"/>
          <line x1="8.48" y1="19.79" x2="8.48" y2="16.44"/>
          <line x1="21.55" y1="3.23" x2="16.73" y2="15.31"/>
          <path d="M8.48,17.88h-2c-2.08,0-3.8-1.62-3.91-3.7h0c-.08-1.39,1.03-2.55,2.41-2.55h8.81c.51,0,.98-.29,1.21-.74l3.93-7.67"/>
        `);
      case 'ski':
        return wrap(`
          <path d="M7 4 Q5 4 4.5 6 L9.5 20"/>
          <path d="M11 4 Q9 4 8.5 6 L13.5 20"/>
          <line x1="4" y1="20" x2="15" y2="20"/>
        `);
      case 'snooker':
        return wrap(`
          <line x1="20.5" y1="3.5" x2="10" y2="14"/>
          <circle cx="7" cy="17" r="4"/>
          <circle cx="5.5" cy="15.5" r="0.6" fill="currentColor"/>
        `);
      case 'mma':
        return wrap(`
          <path d="M5 12.5 C5 8 7.5 5 12 5 C14.5 5 16.5 6.2 17 8.2 V11 C18.2 11.2 19 12 19 13.1 C19 14.3 18.1 15.1 17 15.1 H15.5 C14.7 15.1 14.1 15.7 14.1 16.5 V18.2 H5 Z"/>
          <rect x="4.4" y="18.2" width="10.3" height="3.2" rx="0.7"/>
          <line x1="5.4" y1="19.8" x2="13.7" y2="19.8"/>
          <path d="M17 11.2 C16.2 11.2 15.6 10.6 15.6 9.7 V8.2"/>
          <line x1="8" y1="11.5" x2="12.5" y2="11.5"/>
        `);
      case 'baseball':
        // Ball with stitching curves
        return wrap(`
          <circle cx="12" cy="12" r="9"/>
          <path d="M9.5 4.8 C8.2 7 9.8 9.5 9 12 C8.2 14.5 9.5 17 9.5 19.2"/>
          <path d="M14.5 4.8 C15.8 7 14.2 9.5 15 12 C15.8 14.5 14.5 17 14.5 19.2"/>
        `);
      case 'darts':
        // Dartboard with bullseye + cross hairs
        return wrap(`
          <circle cx="12" cy="12" r="9"/>
          <circle cx="12" cy="12" r="5.5"/>
          <circle cx="12" cy="12" r="2.5"/>
          <line x1="12" y1="3"  x2="12" y2="6.5"/>
          <line x1="12" y1="21" x2="12" y2="17.5"/>
          <line x1="3"  y1="12" x2="6.5" y2="12"/>
          <line x1="21" y1="12" x2="17.5" y2="12"/>
        `);
      case 'pool':
        // Pool cue striking a ball, triangle of balls
        return wrap(`
          <line x1="3" y1="21" x2="13.5" y2="10.5"/>
          <circle cx="16" cy="8"  r="3"/>
          <circle cx="10" cy="16" r="2.2"/>
          <circle cx="16" cy="16" r="2.2"/>
          <circle cx="13" cy="20" r="2.2"/>
        `);
      case 'gym':
        // Gymnast doing a split / handstand pose
        return wrap(`
          <circle cx="12" cy="4"  r="2"/>
          <line x1="12" y1="6" x2="12" y2="11"/>
          <path d="M6 8.5 L12 11 L18 8.5"/>
          <line x1="12" y1="11" x2="12" y2="16"/>
          <path d="M8 20 L12 16 L16 20"/>
        `);
      case 'cycling':
        // Bicycle wheel + frame
        return wrap(`
          <circle cx="7"  cy="16" r="5"/>
          <circle cx="17" cy="16" r="5"/>
          <path d="M7 16 L12 7 L17 16"/>
          <path d="M12 7 L15 4"/>
          <circle cx="12" cy="7" r="1" fill="currentColor"/>
        `);
      case 'athletics':
        // Running figure
        return wrap(`
          <circle cx="15" cy="4.5" r="2"/>
          <path d="M15 6.5 L13 11 L8 13.5"/>
          <path d="M13 11 L15 15 L12 20"/>
          <path d="M15 15 L18 19"/>
        `);
      case 'rugby':
        return wrap(`
          <ellipse cx="12" cy="12" rx="9" ry="6" transform="rotate(-30 12 12)"/>
          <line x1="7.5" y1="7.5" x2="16.5" y2="16.5"/>
          <path d="M10 6.5 C9 9 10 12 9.5 14.5"/>
          <path d="M14 9.5 C13 12 14 15 13.5 17.5"/>
        `);
      case 'amfb':
        // American football — oval with laces
        return wrap(`
          <ellipse cx="12" cy="12" rx="9" ry="6" transform="rotate(-35 12 12)"/>
          <line x1="7.8" y1="7.8" x2="16.2" y2="16.2"/>
          <line x1="9.2" y1="11.3" x2="7.5" y2="12.7"/>
          <line x1="12"  y1="9.8"  x2="10.3" y2="11.2"/>
          <line x1="14.8" y1="12.8" x2="13.1" y2="14.2"/>
        `);
      case 'chess':
        // King piece — cross on top, crown body, base
        return wrap(`
          <line x1="12" y1="2.5" x2="12" y2="7"/>
          <line x1="9.5" y1="4.8" x2="14.5" y2="4.8"/>
          <path d="M8.5 7 Q8 9.5 9 11 H15 Q16 9.5 15.5 7 Z"/>
          <rect x="7.5" y="11" width="9" height="3" rx="1"/>
          <rect x="6.5" y="14" width="11" height="2.5" rx="1"/>
        `);
      case 'padel':
        // Round padel racquet + ball
        return wrap(`
          <ellipse cx="10" cy="9" rx="5.5" ry="6"/>
          <rect x="9" y="14.5" width="2" height="6" rx="1"/>
          <circle cx="17" cy="18" r="2.5"/>
        `);
      case 'rowing':
        // Two crossed oars above a wave
        return wrap(`
          <line x1="3" y1="5" x2="19" y2="16"/>
          <line x1="5" y1="16" x2="21" y2="5"/>
          <path d="M2 20 Q5 18 8 20 Q11 22 14 20 Q17 18 22 20"/>
        `);
      case 'volleyball':
        // Ball with three curved panels
        return wrap(`
          <circle cx="12" cy="12" r="9"/>
          <path d="M3.5 9 Q8 14 3.5 19"/>
          <path d="M20.5 9 Q16 14 20.5 19"/>
          <path d="M8 3.5 Q12 8 16 3.5"/>
        `);
      case 'swimming':
        // Swimmer silhouette + wave
        return wrap(`
          <circle cx="18" cy="5.5" r="2"/>
          <path d="M7 10 L11 8 L15 10 L18 7.5"/>
          <path d="M2 15 Q5 13 8 15 Q11 17 14 15 Q17 13 20 15 Q22 16 22 16"/>
          <path d="M2 19 Q5 17 8 19 Q11 21 14 19 Q17 17 22 19"/>
        `);
      case 'other':
        // Question mark
        return wrap(`
          <path d="M9.5 9 a3 3 0 1 1 4 2.8 C12 13 12 14 12 15"/>
          <circle cx="12" cy="18" r="1" fill="currentColor"/>
        `);
      case 'fav':
        return wrap(`<path d="M12 3 L14.4 9 L20.7 9.5 L15.9 13.8 L17.4 20 L12 16.7 L6.6 20 L8.1 13.8 L3.3 9.5 L9.6 9 Z"/>`);
      default:
        return wrap(`
          <circle cx="5"  cy="5"  r="1.6"/>
          <circle cx="12" cy="5"  r="1.6"/>
          <circle cx="19" cy="5"  r="1.6"/>
          <circle cx="5"  cy="12" r="1.6"/>
          <circle cx="12" cy="12" r="1.6"/>
          <circle cx="19" cy="12" r="1.6"/>
          <circle cx="5"  cy="19" r="1.6"/>
          <circle cx="12" cy="19" r="1.6"/>
          <circle cx="19" cy="19" r="1.6"/>
        `);
    }
  }

  // Real-time countdown based on actual clock.
  // eventTime: 'HH:MM', status: 'live' | 'upcoming' | 'done'
  function countdown(eventTime, status) {
    if (status === 'live') return 'Í gangi';
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const [h, m] = eventTime.split(':').map(Number);
    let diff = h * 60 + m - nowMin;
    if (diff <= 0) return 'Í gangi';
    if (diff < 60) return `í ${diff} mín`;
    const hr = Math.round(diff / 60);
    return `í ${hr} klst`;
  }

  // events starts empty — the app fetches from the backend API
  const events = [];

  // ── Supabase configuration ────────────────────────────────────────────────
  // Project: https://kbmjtondcqupdsumgyex.supabase.co
  const SUPABASE_URL  = 'https://kbmjtondcqupdsumgyex.supabase.co';
  const SUPABASE_ANON = 'sb_publishable_Ash-Au72xRzfvPTuSS4jHw_vsugN-Qz';

  return { sports, stations, dates, events, sportIcon, countdown, formatDateIs, SUPABASE_URL, SUPABASE_ANON };
})();
