// Shared data + sport icons + station logo helpers.
// Events are fetched live from the backend API — this file only holds the
// static reference data (sports, stations, dates) and utility functions.

window.IF_DATA = (function () {
  const sports = [
    { id: 'all',      name: 'Allt' },
    { id: 'fav',      name: 'Uppáhalds' },
    { id: 'fb',       name: 'Fótbolti' },
    { id: 'hb',       name: 'Handbolti' },
    { id: 'kb',       name: 'Körfubolti' },
    { id: 'f1',       name: 'Mótorsport' },
    { id: 'tennis',   name: 'Tennis' },
    { id: 'golf',     name: 'Golf' },
    { id: 'mma',      name: 'MMA / Box' },
    { id: 'hockey',   name: 'Íshokkí',   secondary: true },
    { id: 'ski',      name: 'Skíði',      secondary: true },
    { id: 'snooker',  name: 'Snóker',     secondary: true },
    { id: 'baseball', name: 'Hafnabolti', secondary: true },
    { id: 'darts',    name: 'Pílukast',   secondary: true },
    { id: 'pool',     name: 'Biljard',    secondary: true },
    { id: 'gym',      name: 'Fimleikar',  secondary: true },
    { id: 'cycling',  name: 'Hjólreiðar', secondary: true },
    { id: 'athletics',name: 'Frjálsar',   secondary: true },
    { id: 'rugby',    name: 'Rugby',      secondary: true },
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

  // ── Sport icon (monoline outline) ──────────────────────────────────────────
  function sportIcon(id, size = 22, strokeWidth = 1.5) {
    const wrap = (inner) => (
      `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`
    );
    switch (id) {
      case 'fb':
        return wrap(`
          <circle cx="12" cy="12" r="9"/>
          <path d="M12 8 L15.804 10.764 L14.351 15.236 L9.649 15.236 L8.196 10.764 Z"/>
          <line x1="12"     y1="8"      x2="12"     y2="3"/>
          <line x1="15.804" y1="10.764" x2="20.560" y2="9.220"/>
          <line x1="14.351" y1="15.236" x2="17.290" y2="19.280"/>
          <line x1="9.649"  y1="15.236" x2="6.710"  y2="19.280"/>
          <line x1="8.196"  y1="10.764" x2="3.440"  y2="9.220"/>
        `);
      case 'hb':
        return wrap(`
          <circle cx="12" cy="12" r="9"/>
          <path d="M4 8.5 Q12 13.5 20 8.5 M4 15.5 Q12 10.5 20 15.5"/>
        `);
      case 'kb':
        return wrap(`
          <circle cx="12" cy="12" r="9"/>
          <line x1="12" y1="3" x2="12" y2="21"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <path d="M5.5 5.5 Q12 12 5.5 18.5 M18.5 5.5 Q12 12 18.5 18.5"/>
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
          <line x1="6" y1="3" x2="6" y2="20"/>
          <path d="M6 4 L14 6.5 L6 9 Z"/>
          <circle cx="9.5" cy="18" r="1.6"/>
          <line x1="3" y1="20" x2="15" y2="20"/>
        `);
      case 'hockey':
        return wrap(`
          <line x1="20.5" y1="3.5" x2="10" y2="13.5"/>
          <path d="M10 13.5 L3.5 15.8 L4 17.2 L10.5 14.9 Z"/>
          <ellipse cx="14" cy="20" rx="4" ry="1.5"/>
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
        // Rugby ball (oval)
        return wrap(`
          <ellipse cx="12" cy="12" rx="9" ry="6" transform="rotate(-30 12 12)"/>
          <line x1="7.5" y1="7.5" x2="16.5" y2="16.5"/>
          <path d="M10 6.5 C9 9 10 12 9.5 14.5"/>
          <path d="M14 9.5 C13 12 14 15 13.5 17.5"/>
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

  return { sports, stations, dates, events, sportIcon, countdown, SUPABASE_URL, SUPABASE_ANON };
})();
