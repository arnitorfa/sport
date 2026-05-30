// HM 2026 — WorldCup app v2
// Same design system as main SportZone app (palette, fonts, card style).

const { readLS, writeLS, LS } = window.IF_COMPS;

// ── Flag emoji map ────────────────────────────────────────────────────────────
const FLAGS = {
  'Mexíkó':'🇲🇽','Suður-Afríka':'🇿🇦','Suður-Kórea':'🇰🇷','Tékkland':'🇨🇿',
  'Kanada':'🇨🇦','Bosnía og Hersegóvína':'🇧🇦','Bandaríkin':'🇺🇸','Paragvæ':'🇵🇾',
  'Katar':'🇶🇦','Sviss':'🇨🇭','Brasilía':'🇧🇷','Marokkó':'🇲🇦',
  'Haítí':'🇭🇹','Skotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','Ástralía':'🇦🇺','Tyrkland':'🇹🇷',
  'Þýskaland':'🇩🇪','Curaçao':'🇨🇼','Holland':'🇳🇱','Japan':'🇯🇵',
  'Fílabeinsströndin':'🇨🇮','Ekvador':'🇪🇨','Túnis':'🇹🇳','Svíþjóð':'🇸🇪',
  'Spánn':'🇪🇸','Grænhöfðaeyjar':'🇨🇻','Belgía':'🇧🇪','Egyptaland':'🇪🇬',
  'Sádi-Arabía':'🇸🇦','Úrúgvæ':'🇺🇾','Íran':'🇮🇷','Nýja-Sjáland':'🇳🇿',
  'Frakkland':'🇫🇷','Senegal':'🇸🇳','Noregur':'🇳🇴','Írak':'🇮🇶',
  'Argentína':'🇦🇷','Alsír':'🇩🇿','Austurríki':'🇦🇹','Jórdanía':'🇯🇴',
  'Portúgal':'🇵🇹','Kongó (DR)':'🇨🇩','England':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Króatía':'🇭🇷',
  'Gana':'🇬🇭','Panama':'🇵🇦','Úsbekistan':'🇺🇿','Kólumbía':'🇨🇴',
};

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L'];

// ── Match data (UTC; EDT = UTC−4, Reykjavik = UTC year-round) ─────────────────
const mk = (id,iso,home,away,group,venue,round) =>
  ({id,iso,home,away,group:group||null,venue,round:round||'group'});

const MATCHES = [
  // GROUP A
  mk(1, '2026-06-11T19:00:00Z','Mexíkó','Suður-Afríka','A','Mexico City'),
  mk(2, '2026-06-12T02:00:00Z','Suður-Kórea','Tékkland','A','Guadalajara'),
  mk(25,'2026-06-18T16:00:00Z','Suður-Afríka','Tékkland','A','Atlanta'),
  mk(28,'2026-06-19T01:00:00Z','Mexíkó','Suður-Kórea','A','Guadalajara'),
  mk(53,'2026-06-25T01:00:00Z','Mexíkó','Tékkland','A','Mexico City'),
  mk(54,'2026-06-25T01:00:00Z','Suður-Kórea','Suður-Afríka','A','Monterrey'),
  // GROUP B
  mk(3, '2026-06-12T19:00:00Z','Kanada','Bosnía og Hersegóvína','B','Toronto'),
  mk(5, '2026-06-13T19:00:00Z','Katar','Sviss','B','San Francisco'),
  mk(26,'2026-06-18T19:00:00Z','Sviss','Bosnía og Hersegóvína','B','Los Angeles'),
  mk(27,'2026-06-18T22:00:00Z','Kanada','Katar','B','Vancouver'),
  mk(49,'2026-06-24T19:00:00Z','Kanada','Sviss','B','Vancouver'),
  mk(50,'2026-06-24T19:00:00Z','Katar','Bosnía og Hersegóvína','B','Seattle'),
  // GROUP C
  mk(6, '2026-06-13T22:00:00Z','Brasilía','Marokkó','C','New York/NJ'),
  mk(7, '2026-06-14T01:00:00Z','Haítí','Skotland','C','Boston'),
  mk(30,'2026-06-19T19:00:00Z','Skotland','Marokkó','C','Boston'),
  mk(31,'2026-06-20T01:00:00Z','Brasilía','Haítí','C','Philadelphia'),
  mk(51,'2026-06-24T22:00:00Z','Skotland','Brasilía','C','Miami'),
  mk(52,'2026-06-24T22:00:00Z','Marokkó','Haítí','C','Atlanta'),
  // GROUP D
  mk(4, '2026-06-13T01:00:00Z','Bandaríkin','Paragvæ','D','Los Angeles'),
  mk(8, '2026-06-14T04:00:00Z','Ástralía','Tyrkland','D','Vancouver'),
  mk(29,'2026-06-19T19:00:00Z','Bandaríkin','Ástralía','D','Seattle'),
  mk(32,'2026-06-20T04:00:00Z','Paragvæ','Tyrkland','D','San Francisco'),
  mk(59,'2026-06-26T02:00:00Z','Bandaríkin','Tyrkland','D','Los Angeles'),
  mk(60,'2026-06-26T02:00:00Z','Paragvæ','Ástralía','D','San Francisco'),
  // GROUP E
  mk(9, '2026-06-14T17:00:00Z','Þýskaland','Curaçao','E','Houston'),
  mk(11,'2026-06-14T23:00:00Z','Fílabeinsströndin','Ekvador','E','Philadelphia'),
  mk(34,'2026-06-20T20:00:00Z','Þýskaland','Fílabeinsströndin','E','Toronto'),
  mk(35,'2026-06-21T00:00:00Z','Ekvador','Curaçao','E','Kansas City'),
  mk(55,'2026-06-25T20:00:00Z','Ekvador','Þýskaland','E','New York/NJ'),
  mk(56,'2026-06-25T20:00:00Z','Curaçao','Fílabeinsströndin','E','Philadelphia'),
  // GROUP F
  mk(10,'2026-06-14T20:00:00Z','Holland','Japan','F','Dallas'),
  mk(12,'2026-06-15T02:00:00Z','Túnis','Svíþjóð','F','Monterrey'),
  mk(33,'2026-06-20T17:00:00Z','Holland','Svíþjóð','F','Houston'),
  mk(36,'2026-06-21T04:00:00Z','Túnis','Japan','F','Monterrey'),
  mk(57,'2026-06-25T23:00:00Z','Túnis','Holland','F','Kansas City'),
  mk(58,'2026-06-25T23:00:00Z','Japan','Svíþjóð','F','Dallas'),
  // GROUP G
  mk(14,'2026-06-15T19:00:00Z','Belgía','Egyptaland','G','Seattle'),
  mk(16,'2026-06-16T01:00:00Z','Íran','Nýja-Sjáland','G','Los Angeles'),
  mk(38,'2026-06-21T19:00:00Z','Belgía','Íran','G','Los Angeles'),
  mk(40,'2026-06-22T01:00:00Z','Nýja-Sjáland','Egyptaland','G','Vancouver'),
  mk(65,'2026-06-27T03:00:00Z','Nýja-Sjáland','Belgía','G','Vancouver'),
  mk(66,'2026-06-27T03:00:00Z','Egyptaland','Íran','G','Seattle'),
  // GROUP H
  mk(13,'2026-06-15T16:00:00Z','Spánn','Grænhöfðaeyjar','H','Atlanta'),
  mk(15,'2026-06-15T22:00:00Z','Sádi-Arabía','Úrúgvæ','H','Miami'),
  mk(37,'2026-06-21T16:00:00Z','Spánn','Sádi-Arabía','H','Atlanta'),
  mk(39,'2026-06-21T22:00:00Z','Úrúgvæ','Grænhöfðaeyjar','H','Miami'),
  mk(63,'2026-06-27T00:00:00Z','Úrúgvæ','Spánn','H','Guadalajara'),
  mk(64,'2026-06-27T00:00:00Z','Grænhöfðaeyjar','Sádi-Arabía','H','Houston'),
  // GROUP I
  mk(17,'2026-06-16T19:00:00Z','Frakkland','Senegal','I','New York/NJ'),
  mk(18,'2026-06-16T22:00:00Z','Noregur','Írak','I','Boston'),
  mk(42,'2026-06-22T21:00:00Z','Frakkland','Írak','I','Philadelphia'),
  mk(43,'2026-06-23T00:00:00Z','Noregur','Senegal','I','New York/NJ'),
  mk(61,'2026-06-26T19:00:00Z','Noregur','Frakkland','I','Boston'),
  mk(62,'2026-06-26T19:00:00Z','Senegal','Írak','I','Toronto'),
  // GROUP J
  mk(19,'2026-06-17T01:00:00Z','Argentína','Alsír','J','Kansas City'),
  mk(20,'2026-06-17T04:00:00Z','Austurríki','Jórdanía','J','San Francisco'),
  mk(41,'2026-06-22T17:00:00Z','Argentína','Austurríki','J','Dallas'),
  mk(44,'2026-06-23T03:00:00Z','Jórdanía','Alsír','J','San Francisco'),
  mk(71,'2026-06-28T02:00:00Z','Jórdanía','Argentína','J','Dallas'),
  mk(72,'2026-06-28T02:00:00Z','Alsír','Austurríki','J','Kansas City'),
  // GROUP K
  mk(21,'2026-06-17T17:00:00Z','Portúgal','Kongó (DR)','K','Houston'),
  mk(24,'2026-06-18T02:00:00Z','Úsbekistan','Kólumbía','K','Mexico City'),
  mk(45,'2026-06-23T17:00:00Z','Portúgal','Úsbekistan','K','Houston'),
  mk(48,'2026-06-24T02:00:00Z','Kólumbía','Kongó (DR)','K','Guadalajara'),
  mk(69,'2026-06-27T23:30:00Z','Kólumbía','Portúgal','K','Miami'),
  mk(70,'2026-06-27T23:30:00Z','Úsbekistan','Kongó (DR)','K','Atlanta'),
  // GROUP L
  mk(22,'2026-06-17T20:00:00Z','England','Króatía','L','Dallas'),
  mk(23,'2026-06-17T23:00:00Z','Gana','Panama','L','Toronto'),
  mk(46,'2026-06-23T20:00:00Z','England','Gana','L','Boston'),
  mk(47,'2026-06-23T23:00:00Z','Panama','Króatía','L','Toronto'),
  mk(67,'2026-06-27T21:00:00Z','Panama','England','L','New York/NJ'),
  mk(68,'2026-06-27T21:00:00Z','Króatía','Gana','L','Philadelphia'),
  // ROUND OF 32
  mk(73,'2026-06-28T19:00:00Z','2. fl. A','2. fl. B',null,'Los Angeles','r32'),
  mk(74,'2026-06-29T20:30:00Z','1. fl. E','3. fl. (A/B/C/D/F)',null,'Boston','r32'),
  mk(75,'2026-06-29T21:00:00Z','1. fl. F','2. fl. C',null,'Monterrey','r32'),
  mk(76,'2026-06-29T17:00:00Z','1. fl. C','2. fl. F',null,'Houston','r32'),
  mk(77,'2026-06-30T21:00:00Z','1. fl. I','3. fl. (C/D/F/G/H)',null,'New York/NJ','r32'),
  mk(78,'2026-06-30T17:00:00Z','2. fl. E','2. fl. I',null,'Dallas','r32'),
  mk(79,'2026-06-30T21:00:00Z','1. fl. A','3. fl. (C/E/F/H/I)',null,'Mexico City','r32'),
  mk(80,'2026-07-01T16:00:00Z','1. fl. L','3. fl. (E/H/I/J/K)',null,'Atlanta','r32'),
  mk(81,'2026-07-02T00:00:00Z','1. fl. D','3. fl. (B/E/F/I/J)',null,'San Francisco','r32'),
  mk(82,'2026-07-01T20:00:00Z','1. fl. G','3. fl. (A/E/H/I/J)',null,'Seattle','r32'),
  mk(83,'2026-07-02T23:00:00Z','2. fl. K','2. fl. L',null,'Toronto','r32'),
  mk(84,'2026-07-02T19:00:00Z','1. fl. H','2. fl. J',null,'Los Angeles','r32'),
  mk(85,'2026-07-04T03:00:00Z','1. fl. B','3. fl. (E/F/G/I/J)',null,'Vancouver','r32'),
  mk(86,'2026-07-03T22:00:00Z','1. fl. J','2. fl. H',null,'Miami','r32'),
  mk(87,'2026-07-04T01:30:00Z','1. fl. K','3. fl. (D/E/I/J/L)',null,'Kansas City','r32'),
  mk(88,'2026-07-03T18:00:00Z','2. fl. D','2. fl. G',null,'Dallas','r32'),
  // ROUND OF 16
  mk(89,'2026-07-04T21:00:00Z','Sig. L74','Sig. L77',null,'Philadelphia','r16'),
  mk(90,'2026-07-04T17:00:00Z','Sig. L73','Sig. L75',null,'Houston','r16'),
  mk(91,'2026-07-05T20:00:00Z','Sig. L76','Sig. L78',null,'New York/NJ','r16'),
  mk(92,'2026-07-06T00:00:00Z','Sig. L79','Sig. L80',null,'Mexico City','r16'),
  mk(93,'2026-07-06T19:00:00Z','Sig. L83','Sig. L84',null,'Dallas','r16'),
  mk(94,'2026-07-07T00:00:00Z','Sig. L81','Sig. L82',null,'Seattle','r16'),
  mk(95,'2026-07-07T16:00:00Z','Sig. L86','Sig. L88',null,'Atlanta','r16'),
  mk(96,'2026-07-07T20:00:00Z','Sig. L85','Sig. L87',null,'Vancouver','r16'),
  // QUARTER-FINALS
  mk(97, '2026-07-09T20:00:00Z','Sig. L89','Sig. L90',null,'Boston','qf'),
  mk(98, '2026-07-10T19:00:00Z','Sig. L93','Sig. L94',null,'Los Angeles','qf'),
  mk(99, '2026-07-11T21:00:00Z','Sig. L91','Sig. L92',null,'Miami','qf'),
  mk(100,'2026-07-12T01:00:00Z','Sig. L95','Sig. L96',null,'Kansas City','qf'),
  // SEMI-FINALS
  mk(101,'2026-07-14T19:00:00Z','Sig. L97','Sig. L98',null,'Dallas','sf'),
  mk(102,'2026-07-15T19:00:00Z','Sig. L99','Sig. L100',null,'Atlanta','sf'),
  // 3RD PLACE
  mk(103,'2026-07-18T21:00:00Z','Tap. L101','Tap. L102',null,'Miami','tp'),
  // FINAL
  mk(104,'2026-07-19T19:00:00Z','Sig. L101','Sig. L102',null,'New York/NJ','final'),
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const TZ = 'Atlantic/Reykjavik';
const fmtTime  = iso => new Date(iso).toLocaleTimeString('is-IS',{hour:'2-digit',minute:'2-digit',timeZone:TZ});
const fmtDay   = iso => new Date(iso).toLocaleDateString('is-IS',{weekday:'long',day:'numeric',month:'long',timeZone:TZ});
const fmtShort = iso => new Date(iso).toLocaleDateString('is-IS',{day:'numeric',month:'short',timeZone:TZ});
const isoDay   = iso => new Date(iso).toLocaleDateString('sv-SE',{timeZone:TZ});
const todayStr = () => new Date().toLocaleDateString('sv-SE',{timeZone:TZ});

function matchStatus(iso) {
  const now = Date.now(), s = new Date(iso).getTime(), e = s + 105*60*1000;
  if (now >= s && now < e) return 'live';
  if (now >= e) return 'done';
  return 'upcoming';
}
function flag(t) { return FLAGS[t] || ''; }
function isKnown(t) { return !!FLAGS[t]; }

function cdStr(iso) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return null;
  const d = Math.floor(diff/86400000), h = Math.floor((diff%86400000)/3600000), mn = Math.floor((diff%3600000)/60000);
  if (d > 0) return `${d}d ${h}klst`;
  if (h > 0) return `${h}klst ${mn}mín`;
  return `${mn}mín`;
}

const KO_LABELS = {r32:'32 LIÐA ÚRSLIT',r16:'16 LIÐA ÚRSLIT',qf:'FJÓRÐUNGSÚRSLIT',sf:'HÁLFLEIKIR',tp:'LEIKUR UM 3. SÆTI',final:'LOKALEIKUR'};

// ── Main component ────────────────────────────────────────────────────────────
function WCApp({ mobile, dark, onThemeChange }) {
  const isDark = dark;

  // 'group' | 'ko' | 'today'
  const [tab, setTab]     = React.useState('group');
  // 'ALL' or 'A'-'L'
  const [group, setGroup] = React.useState('ALL');
  const [search, setSearch] = React.useState('');
  const [, tick] = React.useState(0);

  // Channel map: matchId -> 'RÚV' | 'RÚV 2' (populated from API)
  const [channelMap, setChannelMap] = React.useState({});

  // Auto-tick every 30s to keep live status current
  React.useEffect(() => {
    const t = setInterval(() => tick(n => n+1), 30000);
    return () => clearInterval(t);
  }, []);

  // Dynamic channel detection — query /api/events for WC dates within ±3 days
  React.useEffect(() => {
    const now = new Date();
    const dates = [...new Set(MATCHES.map(m => isoDay(m.iso)))];
    dates.forEach(async d => {
      const dayDiff = (new Date(d) - now) / 86400000;
      if (dayDiff > 3 || dayDiff < -2) return; // only fetch near-term dates
      try {
        const res = await fetch(`/api/events?date=${d}`);
        const data = await res.json();
        const ruvEvs = (data.events || []).filter(e => e.station === 'ruv');
        const updates = {};
        MATCHES.forEach(match => {
          if (isoDay(match.iso) !== d) return;
          // Match by checking if either team name appears in the event title
          const homeWord = match.home.split(' ')[0].toLowerCase();
          const awayWord = match.away.split(' ')[0].toLowerCase();
          const ev = ruvEvs.find(e => {
            const t = e.title.toLowerCase();
            return t.includes(homeWord) || t.includes(awayWord);
          });
          if (ev && ev.channelName) updates[match.id] = ev.channelName;
        });
        if (Object.keys(updates).length) {
          setChannelMap(prev => ({ ...prev, ...updates }));
        }
      } catch(_) {}
    });
  }, []);

  // ── Palette — identical to main app ──────────────────────────────────────────
  const pal = isDark ? {
    bg:'#08080A',fg:'#F4F4F5',card:'#121215',card2:'#1A1A1E',
    hair:'#202024',hair2:'#2C2C30',muted:'#7B7B82',
    accent:'#C8FF3D',accentFg:'#0A0A0B',accentSoft:'rgba(200,255,61,0.13)',
    panelBg:'#0B0B0D',
  } : {
    bg:'#FFFFFF',fg:'#0A0A0B',card:'#FAFAF8',card2:'#FFFFFF',
    hair:'#E7E5E1',hair2:'#D8D6D1',muted:'#76736C',
    accent:'#F26419',accentFg:'#FFFFFF',accentSoft:'rgba(242,100,25,0.12)',
    panelBg:'#F5F4F1',
  };

  React.useEffect(() => {
    document.body.style.background = isDark ? '#08080A' : '#FFFFFF';
  }, [isDark]);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const today       = todayStr();
  const todayMs     = MATCHES.filter(m => isoDay(m.iso) === today).sort((a,b)=>a.iso.localeCompare(b.iso));
  const liveMs      = MATCHES.filter(m => matchStatus(m.iso) === 'live');
  const searchQ     = search.trim().toLowerCase();
  const searchRes   = searchQ ? MATCHES.filter(m =>
    m.home.toLowerCase().includes(searchQ) || m.away.toLowerCase().includes(searchQ) ||
    m.venue.toLowerCase().includes(searchQ) ||
    (m.group && ('riðill '+m.group.toLowerCase()).includes(searchQ))
  ).sort((a,b)=>a.iso.localeCompare(b.iso)) : null;

  // ── Styles ────────────────────────────────────────────────────────────────────
  const S = {
    root:{ minHeight:'100vh',background:pal.bg,color:pal.fg,
      fontFamily:'"Inter",system-ui,sans-serif',letterSpacing:'-0.005em',
      display:'flex',flexDirection:'column' },
    topBar:{ display:'flex',alignItems:'center',gap:mobile?10:20,
      padding:mobile?'12px 16px':'18px 32px',
      borderBottom:`1px solid ${pal.hair}`,
      position:'sticky',top:0,zIndex:50,background:pal.bg },
    iconBtn:{ width:38,height:38,borderRadius:10,cursor:'pointer',
      background:pal.card,border:`1px solid ${pal.hair}`,
      color:pal.fg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 },
    backBtn:{ display:'flex',alignItems:'center',gap:6,height:38,padding:'0 14px',
      borderRadius:10,background:pal.card,border:`1px solid ${pal.hair}`,
      color:pal.fg,fontSize:12.5,fontWeight:600,cursor:'pointer',
      flexShrink:0,textDecoration:'none',fontFamily:'inherit' },
    searchWrap:{ flex:1,maxWidth:460,display:'flex',alignItems:'center',gap:10,
      background:pal.card,border:`1px solid ${pal.hair}`,
      borderRadius:10,padding:'9px 14px',marginLeft:'auto' },
    searchInput:{ flex:1,border:'none',outline:'none',background:'transparent',
      color:pal.fg,fontSize:13,fontFamily:'inherit' },

    // Round tab strip — matches date strip style from main app
    roundStrip:{ display:mobile?'flex':'flex',overflowX:mobile?'auto':undefined,
      scrollbarWidth:'none',borderBottom:`1px solid ${pal.hair}` },
    roundTab:(a)=>({ padding:mobile?'11px 16px 9px':'13px 22px 11px',
      cursor:'pointer',flexShrink:0,whiteSpace:'nowrap',
      borderRight:`1px solid ${pal.hair}`,
      background:a?pal.accent:'transparent',color:a?pal.accentFg:pal.fg,
      border:'none',textAlign:'left',fontFamily:'inherit',
      transition:'background .12s',display:'flex',flexDirection:'column',gap:2 }),
    rtWk:(a)=>({ fontSize:mobile?8.5:10,textTransform:'uppercase',
      letterSpacing:'0.14em',fontWeight:700,opacity:a?0.85:0.45 }),
    rtName:{ fontSize:mobile?17:20,fontWeight:700,
      fontFamily:'"JetBrains Mono",monospace',letterSpacing:'-0.02em',lineHeight:1,marginTop:2 },
    rtSub:(a)=>({ fontSize:9,marginTop:4,fontWeight:700,textTransform:'uppercase',
      letterSpacing:'0.10em',opacity:a?0.85:0.35 }),

    // Group bar
    groupBar:{ display:'flex',alignItems:'center',
      padding:mobile?'8px 12px':'10px 24px',
      borderBottom:`1px solid ${pal.hair}`,gap:4,overflowX:'auto',scrollbarWidth:'none' },
    groupLabel:{ fontSize:9.5,fontWeight:800,letterSpacing:'0.14em',
      color:pal.muted,textTransform:'uppercase',flexShrink:0,marginRight:4,
      whiteSpace:'nowrap' },
    groupChip:(a)=>({ minWidth:mobile?36:40,height:mobile?36:40,
      borderRadius:10,cursor:'pointer',flexShrink:0,
      background:a?pal.fg:'transparent',color:a?pal.bg:pal.fg,
      border:'none',fontFamily:'inherit',fontWeight:700,fontSize:mobile?13:14,
      display:'flex',alignItems:'center',justifyContent:'center',
      transition:'background .12s' }),
    allarChip:(a)=>({ height:mobile?36:40,padding:'0 14px',borderRadius:10,
      cursor:'pointer',flexShrink:0,marginRight:8,
      background:a?pal.accent:'transparent',color:a?pal.accentFg:pal.fg,
      border:`1px solid ${a?pal.accent:pal.hair2}`,fontFamily:'inherit',
      fontWeight:700,fontSize:mobile?11:12,letterSpacing:'0.04em',
      whiteSpace:'nowrap',transition:'background .12s' }),

    // Layout
    body:{ flex:1,display:mobile?'block':'flex' },
    livePane:{ width:280,flexShrink:0,borderRight:`1px solid ${pal.hair}`,
      padding:'24px 20px',background:pal.panelBg,
      position:'sticky',top:0,
      maxHeight:'calc(100vh - 57px)',overflowY:'auto' },
    timeline:{ flex:1,padding:mobile?'0 12px 48px':'0 28px 48px',overflowY:'auto',minWidth:0 },

    // Date header in timeline
    dateHdr:{ fontSize:11,fontWeight:700,letterSpacing:'0.10em',
      color:pal.muted,textTransform:'capitalize',
      padding:mobile?'20px 0 8px':'22px 0 8px' },

    // ── EVENT CARD — matches main app style ───────────────────────────────────
    evCard:(status)=>({
      background:pal.card,
      border:`1px solid ${status==='live'?'rgba(255,59,71,0.45)':pal.hair}`,
      borderRadius:12,marginBottom:6,overflow:'hidden',
      boxShadow:status==='live'?'0 0 0 1px rgba(255,59,71,0.1)':'none',
    }),
    // Meta row (top of card) — sport name / riðill / live badge
    evMeta:{ display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',
      padding:mobile?'10px 14px 0':'12px 18px 0' },
    evMetaTag:(color,bg)=>({ padding:'2px 7px',borderRadius:3,
      fontSize:9.5,fontWeight:800,letterSpacing:'0.14em',
      color:color,background:bg }),
    // Main title area
    evMain:{ padding:mobile?'8px 14px 10px':'10px 18px 12px' },
    // Time — large mono
    evTime:{ fontSize:mobile?20:24,fontWeight:700,
      fontFamily:'"JetBrains Mono",monospace',letterSpacing:'-0.02em',
      lineHeight:1,marginBottom:mobile?8:10 },
    // Teams row
    evTeams:{ display:'grid',gridTemplateColumns:'1fr 28px 1fr',
      alignItems:'center',gap:mobile?6:10 },
    teamSide:(right)=>({ display:'flex',alignItems:'center',gap:mobile?6:8,
      justifyContent:right?'flex-start':'flex-end' }),
    teamName:{ fontWeight:700,fontSize:mobile?14:16,lineHeight:1.2 },
    flagEl:{ fontSize:mobile?22:26,lineHeight:1,flexShrink:0 },
    vsEl:{ fontSize:11,color:pal.muted,fontWeight:700,textAlign:'center' },
    // Footer row
    evFooter:{ display:'flex',alignItems:'center',justifyContent:'space-between',
      padding:mobile?'0 14px 10px':'0 18px 12px',
      borderTop:`1px solid ${pal.hair}`,paddingTop:8,marginTop:8,
      paddingBottom:mobile?10:12 },
    evVenue:{ fontSize:11,color:pal.muted },

    // Badges
    liveBadge:{ display:'inline-flex',alignItems:'center',gap:5,
      background:'rgba(255,59,71,0.18)',color:'#FF3B47',
      padding:'2px 8px',borderRadius:4,fontSize:9.5,fontWeight:800,letterSpacing:'0.16em' },
    liveDotEl:{ width:6,height:6,borderRadius:'50%',background:'#FF3B47',
      animation:'ifPulse 1.4s ease-in-out infinite',flexShrink:0 },
    ruvBadge:(ch)=>({ background:isDark?'#003E7E':'#0054A6',color:'#fff',
      padding:'2px 8px',borderRadius:4,fontSize:10,fontWeight:800,letterSpacing:'0.04em',
      flexShrink:0 }),
    doneBadge:{ fontSize:11,color:pal.muted,fontWeight:600 },

    // Live pane
    liveHd:{ display:'flex',alignItems:'center',gap:8,marginBottom:16 },
    liveDot:{ width:8,height:8,borderRadius:'50%',background:'#FF3B47',
      animation:'ifPulse 1.4s ease-in-out infinite',flexShrink:0 },
    liveLabel:{ fontSize:11,fontWeight:800,letterSpacing:'0.12em',color:pal.muted,textTransform:'uppercase' },
    liveCount:{ marginLeft:'auto',minWidth:22,height:22,padding:'0 7px',
      background:'#FF3B47',color:'#fff',borderRadius:99,fontSize:11,fontWeight:800,
      display:'flex',alignItems:'center',justifyContent:'center',
      fontFamily:'"JetBrains Mono",monospace' },
    liveMiniCard:{ background:pal.card,border:`1px solid ${pal.hair}`,
      borderRadius:10,padding:'12px 14px',marginBottom:8 },
    emptyMsg:{ textAlign:'center',color:pal.muted,padding:'48px 16px',fontSize:14 },

    // Section title for ko rounds
    sectionTitle:(accent)=>({ fontSize:11,fontWeight:800,letterSpacing:'0.14em',
      color:accent?pal.accent:pal.muted,textTransform:'uppercase',
      padding:'22px 0 8px' }),

    // Group team pills
    groupTeams:{ display:'flex',flexWrap:'wrap',gap:6,padding:mobile?'12px 0':'10px 0 14px' },
    groupTeamPill:{ display:'flex',alignItems:'center',gap:6,
      background:pal.card,border:`1px solid ${pal.hair}`,
      borderRadius:8,padding:'6px 12px',fontSize:12,fontWeight:600 },
  };

  // ── Match card ────────────────────────────────────────────────────────────────
  function MatchCard({ match }) {
    const status  = matchStatus(match.iso);
    const time    = fmtTime(match.iso);
    const cd      = status==='upcoming' ? cdStr(match.iso) : null;
    const channel = channelMap[match.id] || 'RÚV';
    const isGroup = match.round === 'group';
    return (
      <div style={S.evCard(status)}>
        {/* Meta row */}
        <div style={S.evMeta}>
          {isGroup && (
            <span style={S.evMetaTag(isDark?'#C8FF3D':'#5A7A00','rgba(200,255,61,0.14)')}>
              RIÐILL {match.group}
            </span>
          )}
          {!isGroup && match.round && (
            <span style={S.evMetaTag(pal.muted,'rgba(128,128,128,0.12)')}>
              {KO_LABELS[match.round] || ''} · L.{match.id}
            </span>
          )}
          {status==='live' && (
            <div style={S.liveBadge}>
              <span style={S.liveDotEl}/>
              LIVE
            </div>
          )}
          {status==='done' && <span style={S.doneBadge}>Lokið</span>}
          {cd && <span style={{ fontSize:10,color:pal.muted,marginLeft:'auto' }}>{cd}</span>}
        </div>

        {/* Main content */}
        <div style={S.evMain}>
          {/* Time */}
          <div style={S.evTime}>kl. {time}</div>
          {/* Teams */}
          <div style={S.evTeams}>
            <div style={S.teamSide(false)}>
              <span style={S.teamName}>{match.home}</span>
              <span style={S.flagEl}>{isKnown(match.home)?flag(match.home):''}</span>
            </div>
            <div style={S.vsEl}>–</div>
            <div style={S.teamSide(true)}>
              <span style={S.flagEl}>{isKnown(match.away)?flag(match.away):''}</span>
              <span style={S.teamName}>{match.away}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={S.evFooter}>
          <span style={S.evVenue}>📍 {match.venue}</span>
          <span style={S.ruvBadge(channel)}>{channel}</span>
        </div>
      </div>
    );
  }

  // ── Group by date helper ──────────────────────────────────────────────────────
  function ByDate({ matches, skipDone }) {
    const ms = skipDone ? matches.filter(m => matchStatus(m.iso) !== 'done') : matches;
    if (!ms.length) return (
      <div style={S.emptyMsg}>
        <div style={{ fontSize:32,marginBottom:10 }}>✅</div>
        <div style={{ fontWeight:700 }}>Allir leikir í þessum riðli eru liðnir.</div>
      </div>
    );
    const byDate = {};
    ms.forEach(m => { const d=isoDay(m.iso); if(!byDate[d])byDate[d]=[]; byDate[d].push(m); });
    return Object.entries(byDate).sort().map(([d,arr])=>(
      <div key={d}>
        <div style={S.dateHdr}>{fmtDay(arr[0].iso)}</div>
        {arr.map(m=><MatchCard key={m.id} match={m}/>)}
      </div>
    ));
  }

  // ── Views ─────────────────────────────────────────────────────────────────────
  function GroupView() {
    const groupMs = MATCHES.filter(m=>m.round==='group');
    if (group === 'ALL') {
      return <ByDate matches={groupMs} skipDone={false}/>;
    }
    const ms = groupMs.filter(m=>m.group===group).sort((a,b)=>a.iso.localeCompare(b.iso));
    const teams = [...new Set(ms.flatMap(m=>[m.home,m.away]))];
    return (
      <>
        <div style={S.groupTeams}>
          {teams.map(t=>(
            <div key={t} style={S.groupTeamPill}>
              <span style={{fontSize:18}}>{flag(t)}</span>
              <span>{t}</span>
            </div>
          ))}
        </div>
        <ByDate matches={ms}/>
      </>
    );
  }

  function KoView() {
    const rounds = ['r32','r16','qf','sf','tp','final'];
    const labels = {r32:'32 liða úrslit',r16:'16 liða úrslit',qf:'Fjórðungsúrslit',sf:'Hálfleikir',tp:'Leikur um 3. sæti',final:'Lokaleikur'};
    return rounds.map(r=>{
      const arr = MATCHES.filter(m=>m.round===r).sort((a,b)=>a.iso.localeCompare(b.iso));
      if(!arr.length) return null;
      return (
        <div key={r}>
          <div style={S.sectionTitle(r==='final')}>{labels[r]}</div>
          {arr.map(m=><MatchCard key={m.id} match={m}/>)}
        </div>
      );
    });
  }

  function TodayView() {
    if (!todayMs.length) {
      const next = MATCHES.filter(m=>new Date(m.iso)>new Date()).sort((a,b)=>a.iso.localeCompare(b.iso))[0];
      return (
        <div style={S.emptyMsg}>
          <div style={{fontWeight:700}}>Enginn HM-leikur í dag</div>
          {next&&<div style={{marginTop:8,fontSize:12}}>Næsti: {fmtDay(next.iso)} kl. {fmtTime(next.iso)}</div>}
        </div>
      );
    }
    return todayMs.map(m=><MatchCard key={m.id} match={m}/>);
  }

  function SearchView() {
    if (!searchRes.length) return <div style={S.emptyMsg}>Engar niðurstöður.</div>;
    return <ByDate matches={searchRes}/>;
  }

  // ── Live mini card ────────────────────────────────────────────────────────────
  function LiveMini({ match }) {
    return (
      <div style={S.liveMiniCard}>
        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
          <span style={{fontSize:11,color:pal.muted,fontFamily:'"JetBrains Mono",monospace'}}>{fmtTime(match.iso)}</span>
          {match.group&&<span style={{fontSize:10,color:pal.muted,fontWeight:700}}>RIÐILL {match.group}</span>}
          <div style={{...S.liveBadge,marginLeft:'auto',padding:'1px 6px'}}>
            <span style={S.liveDotEl}/>LIVE
          </div>
        </div>
        <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>
          {flag(match.home)} {match.home}
        </div>
        <div style={{fontWeight:700,fontSize:13}}>
          {flag(match.away)} {match.away}
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  const todayCount = todayMs.length;

  return (
    <div style={S.root}>
      <style>{`
        @keyframes ifPulse{0%{box-shadow:0 0 0 0 rgba(255,59,71,.55)}70%{box-shadow:0 0 0 8px rgba(255,59,71,0)}100%{box-shadow:0 0 0 0 rgba(255,59,71,0)}}
        *{-webkit-tap-highlight-color:transparent}
      `}</style>

      {/* TOP BAR */}
      <div style={S.topBar}>
        <div style={{display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
          <img src={`assets/logos/sportzone-${isDark?'dark':'light'}.svg`} alt="SportZone"
            style={{height:26,width:'auto',display:'block'}}/>
          {!mobile&&(
            <a href="/" style={S.backBtn}>← Aðalsíða</a>
          )}
        </div>

        {!mobile&&(
          <div>
            <div style={{fontWeight:800,fontSize:18,letterSpacing:'-0.02em',lineHeight:1}}>
              HM í fótbolta 2026
            </div>
            <div style={{fontSize:10,color:pal.muted,letterSpacing:'0.10em',marginTop:4}}>
              11. JÚN – 19. JÚL · USA / KANADA / MEXÍKÓ · RÚV
            </div>
          </div>
        )}

        <div style={{...S.searchWrap,maxWidth:mobile?undefined:380}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={pal.muted} strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
          </svg>
          <input style={S.searchInput} placeholder="Leita að landi, völlum…"
            value={search} onChange={e=>setSearch(e.target.value)}/>
          {search&&<button onClick={()=>setSearch('')}
            style={{background:'none',border:'none',cursor:'pointer',color:pal.muted,fontSize:16,lineHeight:1,padding:'0 2px',display:'flex',alignItems:'center'}}>×</button>}
        </div>

        <button style={S.iconBtn} onClick={()=>onThemeChange(!isDark)}>
          {isDark
            ?<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
            :<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
        </button>

        {mobile&&<a href="/" style={{...S.iconBtn,textDecoration:'none',fontSize:14}}>←</a>}
      </div>

      {/* LIVE BANNER */}
      {liveMs.length>0&&(
        <div style={{background:'rgba(255,59,71,0.10)',borderBottom:'1px solid rgba(255,59,71,0.25)',
          padding:mobile?'8px 16px':'8px 32px',display:'flex',alignItems:'center',gap:10}}>
          <span style={{width:8,height:8,borderRadius:'50%',background:'#FF3B47',
            display:'inline-block',flexShrink:0,animation:'ifPulse 1.4s ease-in-out infinite'}}/>
          <span style={{fontSize:12,fontWeight:700,color:'#FF3B47'}}>
            Í BEINNI: {liveMs.map(m=>`${m.home} – ${m.away}`).join('  ·  ')}
          </span>
        </div>
      )}

      {/* ROUND TABS (date-strip style) */}
      <div style={S.roundStrip}>
        {[
          {id:'today',wk:'Í dag',name:String(todayCount||'0'),sub:'LEIKIR Í DAG'},
          {id:'group',wk:'Riðlakeppni',name:'72',sub:'LEIKIR'},
          {id:'ko',   wk:'Úrslitaleikir',name:'32',sub:'LEIKIR'},
        ].map(rt=>{
          const a = tab===rt.id && !searchRes;
          return (
            <button key={rt.id} style={S.roundTab(a)} onClick={()=>{setTab(rt.id);setSearch('');}}>
              <div style={S.rtWk(a)}>{rt.wk}</div>
              <div style={S.rtName}>{rt.name}</div>
              <div style={S.rtSub(a)}>{rt.sub}</div>
            </button>
          );
        })}
        {/* Filler with subtitle on desktop */}
        {!mobile&&(
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'flex-end',
            padding:'0 24px',color:pal.muted,fontSize:11}}>
            <span style={{fontWeight:700,letterSpacing:'0.08em'}}>48 ÞJÓÐIR · 104 LEIKIR · RÚV</span>
          </div>
        )}
      </div>

      {/* GROUP BAR — only in riðlakeppni tab */}
      {tab==='group'&&!searchRes&&(
        <div style={S.groupBar}>
          <button style={S.allarChip(group==='ALL')} onClick={()=>setGroup('ALL')}>
            ALLIR RIÐLAR
          </button>
          <span style={S.groupLabel}>RIÐLAR:</span>
          {GROUPS.map(g=>(
            <button key={g} style={S.groupChip(group===g&&group!=='ALL')} onClick={()=>setGroup(g)}>{g}</button>
          ))}
        </div>
      )}

      {/* BODY */}
      <div style={S.body}>
        {/* Desktop live pane */}
        {!mobile&&(
          <div style={S.livePane}>
            <div style={S.liveHd}>
              <span style={S.liveDot}/>
              <span style={S.liveLabel}>Í beinni núna</span>
              {liveMs.length>0&&<span style={S.liveCount}>{liveMs.length}</span>}
            </div>
            {liveMs.length===0
              ?<div style={{color:pal.muted,fontSize:12,lineHeight:1.6}}>Enginn leikur í gangi núna.</div>
              :liveMs.map(m=><LiveMini key={m.id} match={m}/>)
            }
            {/* Upcoming today in sidebar */}
            {(()=>{
              const up = todayMs.filter(m=>matchStatus(m.iso)==='upcoming');
              if(!up.length) return null;
              return (<>
                <div style={{...S.liveLabel,display:'block',marginTop:20,marginBottom:10}}>Í dag</div>
                {up.slice(0,6).map(m=>(
                  <div key={m.id} style={{...S.liveMiniCard,marginBottom:6}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                      <span style={{fontSize:11,color:pal.muted,fontFamily:'"JetBrains Mono",monospace'}}>kl. {fmtTime(m.iso)}</span>
                      {m.group&&<span style={{fontSize:10,color:pal.muted,fontWeight:700}}>RIÐILL {m.group}</span>}
                    </div>
                    <div style={{fontWeight:700,fontSize:12,marginBottom:3}}>{flag(m.home)} {m.home}</div>
                    <div style={{fontWeight:700,fontSize:12}}>{flag(m.away)} {m.away}</div>
                  </div>
                ))}
              </>);
            })()}
          </div>
        )}

        {/* Timeline */}
        <div style={S.timeline}>
          {searchRes  ? <SearchView/> :
           tab==='today' ? <TodayView/> :
           tab==='group' ? <GroupView/> :
           <KoView/>}
          <div style={{textAlign:'center',marginTop:32,color:pal.muted,fontSize:11}}>
            RÚV hefur sýningarrétt á öllum 104 leikjum HM 2026
          </div>
        </div>
      </div>
    </div>
  );
}
