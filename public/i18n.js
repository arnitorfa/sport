// ── i18n — translation layer for SportZone ───────────────────────────────────
// Single source of truth for all *interface* text. Event content (match titles,
// competition names) comes from the data sources and is NOT translated here.
//
// Adding a new language:
//   1. Copy the whole `is` block below into a new key (e.g. `sv`).
//   2. Translate the values (keep the keys identical).
//   3. That's it — the app reads everything through t().
//
// Lookup order for the active language:
//   ?lang=xx URL param  →  localStorage  →  browser language  →  'is' (fallback).
// Any missing key falls back to Icelandic, then to the key name itself, so a
// half-translated language never shows blanks.

window.IF_I18N = (function () {
  const FALLBACK = 'is';
  const STORAGE_KEY = 'if_v2_lang';

  // ── Country detection ──────────────────────────────────────────────────────
  // The active country decides both the schedule (which broadcasters) and the
  // default UI language. URL layout: sportzone.is/ = Iceland, /se = Sweden.
  // ?country=xx also works (useful in dev, where /se isn't rewritten).
  const COUNTRIES = {
    is: { id: 'is', name: 'Ísland',  flag: '🇮🇸', path: '/',   lang: 'is' },
    se: { id: 'se', name: 'Sverige', flag: '🇸🇪', path: '/se', lang: 'sv' },
  };

  function detectCountry() {
    try {
      const qp = new URLSearchParams(window.location.search).get('country');
      if (qp && COUNTRIES[qp]) return qp;
      const seg = (window.location.pathname.split('/')[1] || '').toLowerCase();
      if (seg && COUNTRIES[seg]) return seg;
    } catch (e) {}
    return 'is';
  }

  const country = detectCountry();

  const dict = {
    // ── Icelandic (complete — the reference language) ───────────────────────
    is: {
      // Sport categories (keyed by sport id from data.js)
      'sport.all': 'Allt',
      'sport.fav': 'Uppáhalds',
      'sport.hm2026': 'HM 2026',
      'sport.fb': 'Fótbolti',
      'sport.hb': 'Handbolti',
      'sport.kb': 'Körfubolti',
      'sport.f1': 'Akstursíþróttir',
      'sport.golf': 'Golf',
      'sport.mma': 'Bardagaíþróttir',
      'sport.amfb': 'NFL',
      'sport.hockey': 'Íshokkí',
      'sport.ski': 'Vetraríþróttir',
      'sport.snooker': 'Snóker',
      'sport.baseball': 'Hafnabolti',
      'sport.darts': 'Pílukast',
      'sport.pool': 'Pool',
      'sport.gym': 'Fimleikar',
      'sport.chess': 'Skák',
      'sport.padel': 'Padel',
      'sport.volleyball': 'Blak',
      'sport.swimming': 'Sund',
      'sport.athletics': 'Frjálsar',
      'sport.tennis': 'Tennis',
      'sport.cycling': 'Hjólreiðar',
      'sport.hesta': 'Hestaíþróttir',
      'sport.other': 'Óflokkað',
      'sport.rowing': 'Ruðningur',

      // Dates
      'date.today': 'Í dag',
      'date.tomorrow': 'Á morgun',
      'date.yesterday': 'Í gær',
      'weekdayShort': ['Sun', 'Mán', 'Þri', 'Mið', 'Fim', 'Fös', 'Lau'],
      'weekdayFull': ['Sunnudagur', 'Mánudagur', 'Þriðjudagur', 'Miðvikudagur', 'Fimmtudagur', 'Föstudagur', 'Laugardagur'],
      'monthFull': ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'],

      // Date strip
      'datestrip.all': 'ALLAR',
      'datestrip.allLabel': 'DAGSET.',
      'unit.events': 'viðb.',

      // Sections
      'section.live': 'Í beinni núna',
      'section.upcomingToday': 'Framundan í dag',
      'section.schedule': 'Dagskrá',
      'section.done': 'Liðið',
      'section.doneLong': 'Liðnir atburðir',
      'section.stations': 'Stöðvar',

      // Status / badges
      'status.live': 'LIVE',
      'follow.youFollow': 'Þú fylgir',

      // Session types (motorsport)
      'session.practice': 'Æfing',
      'session.qualifying': 'Tímataka',
      'session.race': 'Keppni',

      // Loading / empty states
      'loading.schedule': 'Sæki dagskrá…',
      'empty.filters': 'Engir viðburðir fundust með þessum síum.',
      'empty.day': 'Engir íþróttaviðburðir fundust á þessum degi.',
      'empty.search': 'Engir viðburðir fundust fyrir „{q}".',
      'empty.mobile': 'Engir viðburðir passa við valið.',
      'empty.favs': 'Þú átt engin uppáhalds enn. Smelltu á stjörnu hjá viðburði til að bæta við.',
      'error.fetch': 'Ekki tókst að sækja dagskrá. Reyndu aftur.',

      // Search
      'search.placeholder': 'Leita að liði, íþrótt, keppni…',
      'search.clear': 'Hreinsa leit',

      // Header / nav
      'nav.reload': 'Endurhlaða síðuna',
      'nav.themeToggle': 'Skipta um þema',
      'nav.tzToggle': 'Skipta um tímabelti',
      'nav.kofi': 'Styðja SportZone á Ko-fi',
      'nav.signIn': 'Skrá inn',
      'nav.signOut': 'Skrá út',

      // Countdown (data.js)
      'countdown.live': 'Í gangi',
      'countdown.inMin': 'í {n} mín',
      'countdown.inHour': 'í {n} klst',

      // Country picker
      'country.pick': 'Veldu land',

      // Timezone toggle
      'tz.country': 'Ísland',
      'tz.local': 'Minn tími',
      'tz.localShort': 'Minn',
      'tz.countryShort': 'Ísl',
      'tz.tipToLocal': 'Sýni íslenskan dagskrártíma. Smelltu til að sýna tíma á þínu tímabelti ({city}).',
      'tz.tipToCountry': 'Sýni tíma á þínu tímabelti ({city}). Smelltu til að sýna íslenskan tíma.',

      // Sport picker (mobile + desktop "Fleiri")
      'picker.more': 'Fleiri',
      'picker.close': 'Loka',
      'picker.pickDate': 'Veldu dagsetningu',
      'picker.pickSports': 'Veldu íþróttir',
      'picker.showAll': 'Sýna allt',
      'picker.show': 'Sýna',
      'unit.sportOne': 'íþrótt',
      'unit.sportMany': 'íþróttir',
      'mobile.sportsAll': 'Íþróttir',
      'mobile.sportOne': 'Íþrótt',

      // Favorites / star popover
      'fav.team': 'Lið / einstaklingur',
      'fav.comp': 'Keppni',
      'fav.series': 'Mótaröð',
      'fav.title': 'Uppáhalds',
      'fav.autoNotePre': 'Þú færð allt sem þú fylgir sjálfkrafa í ',
      'fav.autoNotePost': '.',
      'login.sentToPre': 'Við sendum þér hlekk á ',

      // Login modal
      'login.heading': 'Skráðu þig inn',
      'login.blurb': 'Við sendum þér hlekk á tölvupóstinn þinn — ekkert lykilorð þarf. Uppáhöldin þín vistast og eru tiltæk á öllum tækjum.',
      'login.invalidEmail': 'Sláðu inn gilt netfang.',
      'login.sending': 'Sendi…',
      'login.sendLink': 'Senda hlekk',
      'login.sentHeading': 'Hlekkur sendur!',
      'login.checkEmail': 'Athugaðu tölvupóstinn þinn og smelltu á hlekkinn til að skrá þig inn.',
      'login.close': 'Loka',

      // Logo settings / misc
      'logo.own': 'Eigið',
      'logo.forDark': 'Fyrir dökkt útlit',
      'logo.forLight': 'Fyrir ljóst útlit',
      'logo.hintDark': 'Ljóst merki (oftast hvítt)',
      'logo.hintLight': 'Dökkt merki (oftast svart)',
      'logo.upload': 'Hlaða inn',
      'logo.replace': 'Skipta',
      'ad.label': 'Auglýsing',
    },

    // ── Swedish (complete) ────────────────────────────────────────────────────
    // Active by default on sportzone.is/se; also reachable via ?lang=sv.
    sv: {
      // Sport categories
      'sport.all': 'Allt',
      'sport.fav': 'Favoriter',
      'sport.hm2026': 'VM 2026',
      'sport.fb': 'Fotboll',
      'sport.hb': 'Handboll',
      'sport.kb': 'Basket',
      'sport.f1': 'Motorsport',
      'sport.golf': 'Golf',
      'sport.mma': 'Kampsport',
      'sport.amfb': 'NFL',
      'sport.hockey': 'Ishockey',
      'sport.ski': 'Vintersport',
      'sport.snooker': 'Snooker',
      'sport.baseball': 'Baseboll',
      'sport.darts': 'Dart',
      'sport.pool': 'Pool',
      'sport.gym': 'Gymnastik',
      'sport.chess': 'Schack',
      'sport.padel': 'Padel',
      'sport.volleyball': 'Volleyboll',
      'sport.swimming': 'Simning',
      'sport.athletics': 'Friidrott',
      'sport.tennis': 'Tennis',
      'sport.cycling': 'Cykling',
      'sport.hesta': 'Hästsport',
      'sport.other': 'Övrigt',
      'sport.rowing': 'Rugby',

      // Dates
      'date.today': 'Idag',
      'date.tomorrow': 'Imorgon',
      'date.yesterday': 'Igår',
      'weekdayShort': ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'],
      'weekdayFull': ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'],
      'monthFull': ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'],

      // Date strip
      'datestrip.all': 'ALLA',
      'datestrip.allLabel': 'DATUM',
      'unit.events': 'sändn.',

      // Sections
      'section.live': 'Live just nu',
      'section.upcomingToday': 'Senare idag',
      'section.schedule': 'Tablå',
      'section.done': 'Avslutat',
      'section.doneLong': 'Avslutade sändningar',
      'section.stations': 'Kanaler',

      // Status / badges
      'status.live': 'LIVE',
      'follow.youFollow': 'Du följer',

      // Session types (motorsport)
      'session.practice': 'Träning',
      'session.qualifying': 'Kval',
      'session.race': 'Lopp',

      // Countdown
      'countdown.live': 'Pågår',
      'countdown.inMin': 'om {n} min',
      'countdown.inHour': 'om {n} tim',

      // Country picker
      'country.pick': 'Välj land',

      // Loading / empty states
      'loading.schedule': 'Hämtar tablån…',
      'empty.filters': 'Inga sändningar hittades med dessa filter.',
      'empty.day': 'Inga sportsändningar hittades den här dagen.',
      'empty.search': 'Inga sändningar hittades för ”{q}”.',
      'empty.mobile': 'Inga sändningar matchar ditt val.',
      'empty.favs': 'Du har inga favoriter än. Klicka på stjärnan vid en sändning för att lägga till.',
      'error.fetch': 'Kunde inte hämta tablån. Försök igen.',

      // Search
      'search.placeholder': 'Sök lag, sport, turnering…',
      'search.clear': 'Rensa sökning',

      // Header / nav
      'nav.reload': 'Ladda om sidan',
      'nav.themeToggle': 'Byt tema',
      'nav.tzToggle': 'Byt tidszon',
      'nav.kofi': 'Stöd SportZone på Ko-fi',
      'nav.signIn': 'Logga in',
      'nav.signOut': 'Logga ut',

      // Timezone toggle
      'tz.country': 'Sverige',
      'tz.local': 'Min tid',
      'tz.localShort': 'Min',
      'tz.countryShort': 'Sve',
      'tz.tipToLocal': 'Visar svensk sändningstid. Klicka för att visa tid i din tidszon ({city}).',
      'tz.tipToCountry': 'Visar tid i din tidszon ({city}). Klicka för att visa svensk tid.',

      // Sport picker
      'picker.more': 'Fler',
      'picker.close': 'Stäng',
      'picker.pickDate': 'Välj datum',
      'picker.pickSports': 'Välj sporter',
      'picker.showAll': 'Visa allt',
      'picker.show': 'Visa',
      'unit.sportOne': 'sport',
      'unit.sportMany': 'sporter',
      'mobile.sportsAll': 'Sporter',
      'mobile.sportOne': 'Sport',

      // Favorites / star popover
      'fav.team': 'Lag / utövare',
      'fav.comp': 'Turnering',
      'fav.series': 'Serie',
      'fav.title': 'Favoriter',
      'fav.autoNotePre': 'Allt du följer hamnar automatiskt i ',
      'fav.autoNotePost': '.',
      'login.sentToPre': 'Vi har skickat en länk till ',

      // Login modal
      'login.heading': 'Logga in',
      'login.blurb': 'Vi skickar en länk till din e-post — inget lösenord behövs. Dina favoriter sparas och finns på alla enheter.',
      'login.invalidEmail': 'Ange en giltig e-postadress.',
      'login.sending': 'Skickar…',
      'login.sendLink': 'Skicka länk',
      'login.sentHeading': 'Länk skickad!',
      'login.checkEmail': 'Kolla din e-post och klicka på länken för att logga in.',
      'login.close': 'Stäng',

      // Logo settings / misc
      'logo.own': 'Egen',
      'logo.forDark': 'För mörkt läge',
      'logo.forLight': 'För ljust läge',
      'logo.hintDark': 'Ljus logotyp (oftast vit)',
      'logo.hintLight': 'Mörk logotyp (oftast svart)',
      'logo.upload': 'Ladda upp',
      'logo.replace': 'Byt',
      'ad.label': 'Annons',
    },
  };

  // Language follows the country: /se is Swedish, / is Icelandic.
  // ?lang=xx still overrides for testing.
  function detect() {
    try {
      const url = new URLSearchParams(window.location.search).get('lang');
      if (url && dict[url]) return url;
      const cl = COUNTRIES[country] && COUNTRIES[country].lang;
      if (cl && dict[cl]) return cl;
    } catch (e) {}
    return FALLBACK;
  }

  let lang = detect();

  // Keep <html lang> in sync (SEO/accessibility).
  try { document.documentElement.lang = lang; } catch (e) {}

  function getLang() { return lang; }

  function setLang(l) {
    if (!dict[l]) return;
    lang = l;
    try { localStorage.setItem(STORAGE_KEY, l); } catch (e) {}
  }

  // Translate a key. Optional `vars` does {placeholder} interpolation.
  function t(key, vars) {
    let v = dict[lang] && dict[lang][key];
    if (v == null) v = dict[FALLBACK][key];
    if (v == null) return key;
    if (vars && typeof v === 'string') {
      v = v.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    }
    return v;
  }

  // Translate a key whose value is an array (weekday/month lists).
  function arr(key) {
    const v = (dict[lang] && dict[lang][key]) || dict[FALLBACK][key];
    return Array.isArray(v) ? v : [];
  }

  return { dict, getLang, setLang, t, arr, langs: Object.keys(dict),
           country, COUNTRIES };
})();
