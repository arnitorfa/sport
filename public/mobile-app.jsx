// Mobile app — SportZone (iPhone layout)
// Production adaptation of the design handoff.
// Fetches live data from /api/events — same backend as the desktop app.
// Shares data.js and components.jsx with the desktop layout.

const { StationLogo, SportIcon, resolveLogoUrl, readLS, writeLS, LS } = window.IF_COMPS;

function MobileApp({ dark, onThemeChange }) {
  const D = window.IF_DATA;
  const isDark = dark;

  // ── state ──────────────────────────────────────────────────────────────────
  const [date, setDate] = React.useState(0); // offset: -1=yesterday, 0=today, 1=tomorrow …
  const [selectedSports, setSelectedSportsRaw] = React.useState(() => new Set());
  const setSelectedSports = (n) => setSelectedSportsRaw(new Set(n));
  const [stations, setStations] = React.useState(D.stations.map((s) => s.id));
  const [follows, setFollowsRaw] = React.useState(() => new Set(readLS(LS.fav, [])));
  const [logos] = React.useState(() => readLS(LS.logos, {}));
  const [sportPickerOpen, setSportPickerOpen] = React.useState(false);
  const [datePickerOpen, setDatePickerOpen] = React.useState(false);
  const [starSheetFor, setStarSheetFor] = React.useState(null);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  // ── API fetch ───────────────────────────────────────────────────────────────
  const [events, setEvents] = React.useState([]);
  const [loadingEvents, setLoadingEvents] = React.useState(true);

  React.useEffect(() => {
    const d = D.dates.find((d) => d.offset === date);
    if (!d) return;
    setLoadingEvents(true);
    setEvents([]);
    fetch(`/api/events?date=${d.isoDate}`)
      .then((r) => r.json())
      .then((data) => { setEvents(data.events || []); setLoadingEvents(false); })
      .catch(() => setLoadingEvents(false));
  }, [date]);

  // Persist favorites
  React.useEffect(() => writeLS(LS.fav, [...follows]), [follows]);

  // ── helpers ─────────────────────────────────────────────────────────────────
  const toggleFollow = (key) => {
    const n = new Set(follows);
    n.has(key) ? n.delete(key) : n.add(key);
    setFollowsRaw(new Set(n));
  };
  const toggleSport = (id) => {
    if (id === 'all') { setSelectedSports(new Set()); return; }
    const next = new Set(selectedSports);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedSports(next);
  };
  const toggleStation = (id) => {
    setStations((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const sportObj = (id) => D.sports.find((s) => s.id === id) || D.sports[2]; // fallback to fb
  const stationObj = (id) => D.stations.find((s) => s.id === id);
  const isStarred = (ev) => (ev.subjects || []).some((s) => follows.has(s.key));
  const logoFor = (st) => resolveLogoUrl(st, logos[st.id], isDark ? 'dark' : 'light');

  // ── filtering + sorting ─────────────────────────────────────────────────────
  const favActive = selectedSports.has('fav');
  const sportIds = [...selectedSports].filter((s) => s !== 'fav');
  const filtered = events
    .filter((e) => stations.includes(e.station))
    .filter((e) => !favActive || isStarred(e))
    .filter((e) => sportIds.length === 0 || sportIds.includes(e.sport))
    .filter((e) => {
      if (!search) return true;
      const q = search.toLowerCase();
      const hay = [e.title, e.sub, e.comp, ...(e.subjects || []).map((s) => s.label)]
        .join(' ').toLowerCase();
      return hay.includes(q);
    });

  const live     = filtered.filter((e) => e.status === 'live');
  const upcoming = [...filtered.filter((e) => e.status === 'upcoming')]
    .sort((a, b) => a.time.localeCompare(b.time));
  const done     = [...filtered.filter((e) => e.status === 'done')]
    .sort((a, b) => a.time.localeCompare(b.time));

  // ── palette ─────────────────────────────────────────────────────────────────
  const pal = isDark ? {
    bg: '#08080A', fg: '#F4F4F5', card: '#121215', card2: '#1A1A1E',
    hair: '#202024', hair2: '#2C2C30', muted: '#7B7B82',
    accent: '#C8FF3D', accentFg: '#0A0A0B', accentSoft: 'rgba(200,255,61,0.13)',
    liveAccent: '#FF3B47', liveSoft: 'rgba(255,59,71,0.16)',
  } : {
    bg: '#FFFFFF', fg: '#0A0A0B', card: '#FAFAF8', card2: '#FFFFFF',
    hair: '#E7E5E1', hair2: '#D8D6D1', muted: '#76736C',
    accent: '#F26419', accentFg: '#FFFFFF', accentSoft: 'rgba(242,100,25,0.13)',
    liveAccent: '#E63946', liveSoft: 'rgba(230,57,70,0.13)',
  };

  const visibleDates = D.dates.filter((d) => d.offset >= -1 && d.offset <= 3);
  const isToday = date === 0;

  return (
    <div style={{
      width: '100%', minHeight: '100vh',
      background: pal.bg, color: pal.fg,
      fontFamily: '"Inter", system-ui, sans-serif',
    }}>
      <style>{`
        @keyframes ifPulseM {
          0%   { box-shadow: 0 0 0 0   ${pal.liveAccent}99; }
          70%  { box-shadow: 0 0 0 8px ${pal.liveAccent}00; }
          100% { box-shadow: 0 0 0 0   ${pal.liveAccent}00; }
        }
        .m-scroll::-webkit-scrollbar { display: none; }
        .m-scroll { scrollbar-width: none; -ms-overflow-style: none; }
      `}</style>

      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <div style={{
        padding: '12px 16px 10px', display: 'flex',
        alignItems: 'center', gap: 10,
        borderBottom: `1px solid ${pal.hair}`,
        position: 'sticky', top: 0, background: pal.bg, zIndex: 20,
      }}>
        <img
          src={`assets/logos/sportzone-${isDark ? 'dark' : 'light'}.svg`}
          alt="SportZone"
          onClick={() => window.location.reload()}
          style={{ height: 22, width: 'auto', display: 'block', cursor: 'pointer' }}
        />
        <div style={{ flex: 1 }} />
        <button onClick={() => setSearchOpen((s) => !s)} style={mIconBtn(pal)}>
          {searchOpen ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
            </svg>
          )}
        </button>
        <button onClick={() => onThemeChange && onThemeChange(!isDark)} style={mIconBtn(pal)}>
          {isDark ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="4"/>
              <line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>
      </div>

      {/* ── SEARCH ───────────────────────────────────────────────────────────── */}
      {searchOpen && (
        <div style={{
          padding: '10px 16px', borderBottom: `1px solid ${pal.hair}`,
          display: 'flex', gap: 8, alignItems: 'center', background: pal.card,
        }}>
          <input
            autoFocus
            placeholder="Leita að liði, íþrótt, keppni…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setSearch(''); setSearchOpen(false); } }}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 8,
              border: `1px solid ${pal.hair2}`, background: pal.bg,
              color: pal.fg, fontSize: 14, fontFamily: 'inherit', outline: 'none',
            }}
          />
          <button
            onClick={() => { setSearch(''); setSearchOpen(false); }}
            style={{ padding: '8px 12px', borderRadius: 8, background: 'transparent',
                     border: 'none', color: pal.muted, fontSize: 13, cursor: 'pointer',
                     fontFamily: 'inherit' }}>
            Hætta
          </button>
        </div>
      )}

      {/* ── DATE STRIP ───────────────────────────────────────────────────────── */}
      <div style={{
        padding: '12px 14px', borderBottom: `1px solid ${pal.hair}`,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <div className="m-scroll" style={{ flex: 1, display: 'flex', gap: 6, overflowX: 'auto' }}>
          {visibleDates.map((d) => {
            const active = d.offset === date;
            return (
              <button key={d.offset} onClick={() => setDate(d.offset)} style={{
                flexShrink: 0, padding: '8px 10px', borderRadius: 10,
                background: active ? pal.accent : 'transparent',
                color: active ? pal.accentFg : pal.fg,
                border: `1px solid ${active ? pal.accent : pal.hair}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 2, minWidth: 54, fontFamily: 'inherit', cursor: 'pointer',
              }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em',
                               textTransform: 'uppercase', opacity: active ? 0.85 : 0.55 }}>
                  {d.weekday}
                </span>
                <span style={{ fontSize: 16, fontWeight: 700,
                               fontFamily: '"JetBrains Mono", monospace',
                               letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {String(d.day).padStart(2, '0')}
                </span>
                {d.label && (
                  <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.1em',
                                 textTransform: 'uppercase', opacity: active ? 0.85 : 0.5 }}>
                    {d.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <button onClick={() => setDatePickerOpen((o) => !o)} style={{ ...mIconBtn(pal), width: 38, height: 50, flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="16" rx="2"/>
            <path d="M3 10H21M8 3V7M16 3V7"/>
          </svg>
        </button>
      </div>

      {/* ── SPORT FILTER ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: '12px 14px', borderBottom: `1px solid ${pal.hair}`,
        display: 'flex', gap: 6,
      }}>
        {D.sports.filter((s) => s.id === 'all' || s.id === 'fav').map((sp) => (
          <MSportChip key={sp.id} sp={sp} pal={pal}
            active={sp.id === 'all' ? selectedSports.size === 0 : selectedSports.has(sp.id)}
            showCount={sp.id === 'fav' && follows.size > 0}
            count={follows.size}
            onClick={() => toggleSport(sp.id)} />
        ))}
        <button onClick={() => setSportPickerOpen(true)} style={{
          flex: 1, padding: '8px 14px', borderRadius: 10,
          border: `1px solid ${sportIds.length > 0 ? pal.fg : pal.hair}`,
          background: sportIds.length > 0 ? pal.fg : 'transparent',
          color: sportIds.length > 0 ? pal.bg : pal.fg,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                 style={{ flexShrink: 0 }}>
              <line x1="4" y1="7"  x2="15" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/>
              <line x1="4" y1="17" x2="11" y2="17"/>
              <circle cx="18" cy="7" r="2"/><circle cx="7" cy="17" r="2"/>
            </svg>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.10em',
                           textTransform: 'uppercase', overflow: 'hidden',
                           textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sportIds.length === 0
                ? 'Íþróttir'
                : sportIds.length === 1
                  ? (sportObj(sportIds[0])?.name || 'Íþrótt')
                  : `Íþróttir · ${sportIds.length}`}
            </span>
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
               style={{ flexShrink: 0 }}>
            <path d="M6 9L12 15L18 9"/>
          </svg>
        </button>
      </div>

      {/* ── STATION FILTER ───────────────────────────────────────────────────── */}
      <div style={{
        padding: '10px 14px', borderBottom: `1px solid ${pal.hair}`,
        display: 'flex', gap: 6, alignItems: 'center', background: pal.card,
      }}>
        <div className="m-scroll" style={{ flex: 1, display: 'flex', gap: 6, overflowX: 'auto' }}>
          {D.stations.map((st) => {
            const active = stations.includes(st.id);
            return (
              <button key={st.id} onClick={() => toggleStation(st.id)} style={{
                padding: '4px 8px', borderRadius: 6, flexShrink: 0,
                background: active ? pal.card2 : 'transparent',
                border: `1px solid ${active ? pal.hair : 'transparent'}`,
                opacity: active ? 1 : 0.35, cursor: 'pointer',
                display: 'flex', alignItems: 'center', fontFamily: 'inherit',
              }}>
                <StationLogo station={st} size="sm" logoUrl={logoFor(st)} />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── EVENT LIST ───────────────────────────────────────────────────────── */}
      <div style={{ padding: '8px 14px 32px' }}>
        {loadingEvents && (
          <div style={{ color: pal.muted, padding: '40px 0', textAlign: 'center', fontSize: 13 }}>
            Sæki dagskrá…
          </div>
        )}

        {!loadingEvents && live.length > 0 && (
          <>
            <MSectionHeader pal={pal} live label="Í beinni núna" count={live.length} />
            {live.map((ev) => (
              <MEventCard key={ev.id} ev={ev} D={D} pal={pal} live
                stationObj={stationObj} sportObj={sportObj}
                isStarred={isStarred} logoFor={logoFor} follows={follows}
                onStarTap={() => setStarSheetFor(ev.id)} />
            ))}
          </>
        )}

        {!loadingEvents && upcoming.length > 0 && (
          <>
            <MSectionHeader pal={pal}
              label={isToday ? 'Framundan í dag' : 'Dagskrá'}
              count={upcoming.length} />
            {upcoming.map((ev) => (
              <MEventCard key={ev.id} ev={ev} D={D} pal={pal}
                stationObj={stationObj} sportObj={sportObj}
                isStarred={isStarred} logoFor={logoFor} follows={follows}
                onStarTap={() => setStarSheetFor(ev.id)} />
            ))}
          </>
        )}

        {!loadingEvents && done.length > 0 && (
          <>
            <MSectionHeader pal={pal} label="Liðið" count={done.length} muted />
            {done.map((ev) => (
              <MEventCard key={ev.id} ev={ev} D={D} pal={pal} done
                stationObj={stationObj} sportObj={sportObj}
                isStarred={isStarred} logoFor={logoFor} follows={follows}
                onStarTap={() => setStarSheetFor(ev.id)} />
            ))}
          </>
        )}

        {!loadingEvents && filtered.length === 0 && (
          <div style={{ color: pal.muted, padding: 40, textAlign: 'center',
                        fontSize: 13, lineHeight: 1.5 }}>
            Engir viðburðir passa við valið.
          </div>
        )}
      </div>

      {/* ── BOTTOM SHEETS (position: fixed — cover full viewport) ────────────── */}
      {datePickerOpen && (
        <MDatePicker D={D} pal={pal} date={date}
          onPick={(o) => { setDate(o); setDatePickerOpen(false); }}
          onClose={() => setDatePickerOpen(false)} />
      )}
      {sportPickerOpen && (
        <MSportPicker D={D} pal={pal}
          selectedSports={selectedSports}
          toggle={toggleSport}
          clearAll={() => setSelectedSports(new Set([...selectedSports].filter((s) => s === 'fav')))}
          onClose={() => setSportPickerOpen(false)} />
      )}
      {starSheetFor && (() => {
        const ev = events.find((e) => e.id === starSheetFor);
        return ev ? (
          <MSubjectPicker
            event={ev} follows={follows} toggleFollow={toggleFollow}
            pal={pal} onClose={() => setStarSheetFor(null)} />
        ) : null;
      })()}
    </div>
  );
}

// ── Shared style helpers ──────────────────────────────────────────────────────

const mIconBtn = (pal) => ({
  width: 38, height: 38, borderRadius: 10,
  background: pal.card, border: `1px solid ${pal.hair}`,
  color: pal.fg, display: 'flex', alignItems: 'center',
  justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
  fontFamily: 'inherit',
});

// ── MSportChip ───────────────────────────────────────────────────────────────

function MSportChip({ sp, pal, active, showCount, count, onClick }) {
  const isFav = sp.id === 'fav';
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'flex-start', gap: 4, padding: '8px 12px 6px',
      minWidth: 66, borderRadius: 10, cursor: 'pointer', flexShrink: 0,
      background: active ? pal.fg : 'transparent',
      color: active ? pal.bg : (isFav ? pal.accent : pal.fg),
      border: 'none', fontFamily: 'inherit',
    }}>
      <div style={{ position: 'relative' }}>
        <SportIcon id={sp.id} size={26} strokeWidth={1.6} />
        {showCount && !active && (
          <span style={{
            position: 'absolute', top: -4, right: -8, minWidth: 14, height: 14,
            padding: '0 4px', borderRadius: 99, background: pal.accent,
            color: pal.accentFg, fontSize: 9, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: '"JetBrains Mono", monospace',
          }}>{count}</span>
        )}
      </div>
      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em',
                     textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.1,
                     whiteSpace: 'nowrap' }}>
        {sp.name}
      </span>
    </button>
  );
}

// ── MSectionHeader ────────────────────────────────────────────────────────────

function MSectionHeader({ pal, label, count, live, muted }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 4px 8px' }}>
      {live && (
        <span style={{
          width: 7, height: 7, borderRadius: 99, background: pal.liveAccent,
          animation: 'ifPulseM 1.6s infinite', flexShrink: 0,
        }} />
      )}
      <span style={{
        fontSize: 10, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase',
        color: live ? pal.liveAccent : (muted ? pal.muted : pal.muted),
      }}>
        {label}
      </span>
      <span style={{ marginLeft: 'auto', fontSize: 10.5, color: pal.muted,
                     fontFamily: '"JetBrains Mono", monospace' }}>
        {count}
      </span>
    </div>
  );
}

// ── MEventCard ────────────────────────────────────────────────────────────────

function MEventCard({ ev, D, pal, live, done, stationObj, sportObj, isStarred, logoFor, follows, onStarTap }) {
  const st = stationObj(ev.station);
  const sp = sportObj(ev.sport);
  const starred = isStarred(ev);
  const matchedSubs = (ev.subjects || []).filter((s) => follows.has(s.key));

  return (
    <div style={{
      padding: '14px 14px', borderRadius: 14, marginBottom: 8,
      background: pal.card,
      border: `1px solid ${live ? pal.liveAccent + '66' : pal.hair}`,
      opacity: done ? 0.38 : 1,
    }}>
      {/* time row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 17, fontWeight: 700,
                       letterSpacing: '-0.02em' }}>
          {ev.time}
        </span>
        {live ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 7px', borderRadius: 3,
            background: pal.liveSoft, color: pal.liveAccent,
            fontSize: 9, fontWeight: 800, letterSpacing: '0.18em',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 99, background: pal.liveAccent }} />
            LIVE
          </span>
        ) : (
          <span style={{ fontSize: 11.5, color: pal.muted, fontWeight: 600, letterSpacing: '-0.005em' }}>
            {D.countdown(ev.time, ev.status)}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10.5, color: pal.muted,
                       fontFamily: '"JetBrains Mono", monospace' }}>
          til {ev.endTime}
        </span>
        <button onClick={onStarTap} style={{
          width: 28, height: 28, borderRadius: 8, cursor: 'pointer',
          background: starred ? pal.accent : 'transparent',
          color: starred ? pal.accentFg : pal.muted,
          border: `1px solid ${starred ? pal.accent : pal.hair2}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, fontFamily: 'inherit',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24"
               fill={starred ? 'currentColor' : 'none'} stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.1 8.6 22 9.3 17 14 18.4 21 12 17.5 5.6 21 7 14 2 9.3 8.9 8.6 12 2"/>
          </svg>
        </button>
      </div>

      {/* meta: sport icon + sport · competition */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
        <span style={{ display: 'inline-flex', color: pal.fg }}>
          <SportIcon id={ev.sport} size={15} strokeWidth={1.7} />
        </span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: pal.muted,
                       textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          {sp ? sp.name : ev.sport}{ev.comp ? ` · ${ev.comp}` : ''}
        </span>
      </div>

      <div style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.01em' }}>
        {ev.title}
      </div>
      {ev.sub && (
        <div style={{ fontSize: 12, color: pal.muted, marginTop: 2, lineHeight: 1.3 }}>
          {ev.sub}
        </div>
      )}

      {/* bottom: station + followed subjects */}
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${pal.hair}`,
                    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {st && <StationLogo station={st} size="sm" logoUrl={logoFor(st)} />}
        {matchedSubs.length > 0 && (
          <>
            <span style={{ color: pal.muted, fontSize: 10 }}>·</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill={pal.fg}>
              <path d="M12 2L14.6 9L21 9.7L16.3 14L17.7 20.5L12 17L6.3 20.5L7.7 14L3 9.7L9.4 9Z"/>
            </svg>
            <span style={{ fontSize: 10.5, color: pal.fg, fontWeight: 700 }}>
              Þú fylgir {matchedSubs[0].label}{matchedSubs.length > 1 ? ` +${matchedSubs.length - 1}` : ''}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ── MDatePicker (bottom sheet) ────────────────────────────────────────────────

function MDatePicker({ D, pal, date, onPick, onClose }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      zIndex: 50, display: 'flex', alignItems: 'flex-end',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', background: pal.card,
        borderTopLeftRadius: 18, borderTopRightRadius: 18,
        padding: '18px 16px 32px',
        borderTop: `1px solid ${pal.hair}`,
        boxShadow: '0 -8px 30px rgba(0,0,0,0.18)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: pal.hair2,
                      margin: '0 auto 14px' }} />
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 12 }}>
          Veldu dagsetningu
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
          {D.dates.map((d) => {
            const active = d.offset === date;
            return (
              <button key={d.offset} onClick={() => onPick(d.offset)} style={{
                padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
                background: active ? pal.accent : pal.card2,
                color: active ? pal.accentFg : pal.fg,
                border: `1px solid ${active ? pal.accent : pal.hair}`,
                fontFamily: 'inherit',
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, opacity: active ? 0.85 : 0.5,
                              textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  {d.weekday}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2,
                              fontFamily: '"JetBrains Mono", monospace', letterSpacing: '-0.02em' }}>
                  {String(d.day).padStart(2, '0')}.{String(d.month).padStart(2, '0')}
                </div>
                {d.label && (
                  <div style={{ fontSize: 8, fontWeight: 700, marginTop: 4,
                                opacity: active ? 0.85 : 0.5,
                                textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {d.label}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── MSportPicker (bottom sheet) ───────────────────────────────────────────────

function MSportPicker({ D, pal, selectedSports, toggle, clearAll, onClose }) {
  const sports = D.sports.filter((s) => s.id !== 'all' && s.id !== 'fav');
  const sel = [...selectedSports].filter((s) => s !== 'fav');

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      zIndex: 60, display: 'flex', alignItems: 'flex-end',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxHeight: '80vh', overflowY: 'auto',
        background: pal.card, borderTopLeftRadius: 18, borderTopRightRadius: 18,
        padding: '18px 16px 32px',
        borderTop: `1px solid ${pal.hair}`,
        boxShadow: '0 -8px 30px rgba(0,0,0,0.18)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: pal.hair2,
                      margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', alignItems: 'baseline',
                      justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Veldu íþróttir
          </div>
          {sel.length > 0 && (
            <button onClick={clearAll} style={{
              padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
              background: 'transparent', border: 'none',
              color: pal.muted, fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
            }}>
              Hreinsa val
            </button>
          )}
        </div>
        <div style={{ fontSize: 11, color: pal.muted, marginBottom: 14, lineHeight: 1.4 }}>
          Veldu eina eða fleiri íþróttir til að sía listann.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {sports.map((sp) => {
            const active = selectedSports.has(sp.id);
            return (
              <button key={sp.id} onClick={() => toggle(sp.id)} style={{
                padding: '14px 8px 10px', borderRadius: 12, cursor: 'pointer',
                background: active ? pal.fg : pal.card2,
                color: active ? pal.bg : pal.fg,
                border: `1px solid ${active ? pal.fg : pal.hair}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 8, fontFamily: 'inherit', position: 'relative',
              }}>
                <SportIcon id={sp.id} size={30} strokeWidth={1.5} />
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em',
                               textTransform: 'uppercase', lineHeight: 1.1, textAlign: 'center' }}>
                  {sp.name}
                </span>
                {active && (
                  <span style={{
                    position: 'absolute', top: 8, right: 8, width: 16, height: 16,
                    borderRadius: 99, background: pal.accent, color: pal.accentFg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <button onClick={onClose} style={{
          width: '100%', padding: '12px', marginTop: 16, borderRadius: 12,
          background: pal.accent, color: pal.accentFg,
          border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'inherit', letterSpacing: '0.02em',
        }}>
          {sel.length === 0 ? 'Sýna allt' : `Sýna ${sel.length} ${sel.length === 1 ? 'íþrótt' : 'íþróttir'}`}
        </button>
      </div>
    </div>
  );
}

// ── MSubjectPicker (bottom sheet) ─────────────────────────────────────────────

function MSubjectPicker({ event, follows, toggleFollow, pal, onClose }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      zIndex: 70, display: 'flex', alignItems: 'flex-end',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxHeight: '78vh', overflowY: 'auto',
        background: pal.card, borderTopLeftRadius: 18, borderTopRightRadius: 18,
        padding: '18px 16px 32px',
        borderTop: `1px solid ${pal.hair}`,
        boxShadow: '0 -8px 30px rgba(0,0,0,0.18)', color: pal.fg,
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: pal.hair2,
                      margin: '0 auto 14px' }} />
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.20em',
                      textTransform: 'uppercase', color: pal.muted, marginBottom: 6 }}>
          Bæta við uppáhalds
        </div>
        <div style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.2,
                      letterSpacing: '-0.01em', marginBottom: 12 }}>
          {event.title}
        </div>
        {(event.subjects || []).length === 0 && (
          <div style={{ color: pal.muted, fontSize: 13, padding: '8px 0' }}>
            Engir þátttakendur skráðir fyrir þennan viðburð.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(event.subjects || []).map((sub) => {
            const on = follows.has(sub.key);
            return (
              <button key={sub.key} onClick={() => toggleFollow(sub.key)} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 12px', borderRadius: 10, cursor: 'pointer',
                background: on ? pal.accentSoft : pal.card2,
                border: `1px solid ${on ? pal.accent : pal.hair}`,
                textAlign: 'left', fontFamily: 'inherit', color: pal.fg,
              }}>
                <span style={{
                  width: 20, height: 20, borderRadius: 5,
                  border: `1.5px solid ${on ? pal.accent : pal.hair2}`,
                  background: on ? pal.accent : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {on && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                         stroke={pal.accentFg} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.005em', lineHeight: 1.2 }}>
                    {sub.label}
                  </div>
                  <div style={{ fontSize: 10, color: pal.muted, marginTop: 3,
                                textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700 }}>
                    {sub.type === 'team' ? 'Lið / einstaklingur'
                      : sub.type === 'comp' ? 'Keppni' : 'Mótaröð'}
                  </div>
                </span>
              </button>
            );
          })}
        </div>
        <button onClick={onClose} style={{
          width: '100%', padding: '12px', marginTop: 16, borderRadius: 12,
          background: pal.accent, color: pal.accentFg,
          border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'inherit', letterSpacing: '0.02em',
        }}>
          Loka
        </button>
      </div>
    </div>
  );
}

window.MobileApp = MobileApp;
