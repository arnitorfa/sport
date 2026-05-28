// Íþróttir framundan — main app (full-bleed, Option B "Studio" direction)
// Features:
//   • Theme toggle (sun/moon) + persisted to localStorage
//   • Subject-based favorites (team · sport · gender granularity) via popover
//   • "Uppáhalds" filter chip
//   • Mock Gmail login (saved to localStorage)
//   • Station wordmark badges (placeholder — not real brand assets)
//   • Smoother filled sport icons

const LS = {
  fav:   'if_v2_favorites',
  theme: 'if_v2_theme',
  user:  'if_v2_user',
};

function readLS(k, fallback) {
  try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); }
  catch { return fallback; }
}
function writeLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

// Resolve which logo URL to show for a given station, theme, and user-uploaded
// logos blob. Backwards-compatible with the v1 shape (a bare string per station
// from when only one upload slot existed) — those are treated as the "forDark"
// variant since the original modal only made sense for white logos on dark bg.
function resolveLogoUrl(station, userEntry, theme) {
  const want = theme === 'light' ? 'forLight' : 'forDark';
  const userObj = typeof userEntry === 'string'
    ? { forDark: userEntry }
    : (userEntry || {});
  return userObj[want] || (station.defaultLogos && station.defaultLogos[want]) || null;
}

// ── Station wordmark / logo ──
// If a `logoUrl` (resolved image URL) is provided, render the actual image.
// Otherwise fall back to the styled wordmark badge so the prototype still
// reads at a glance.
function StationLogo({ station, size = 'sm', logoUrl, isDark = false }) {
  const dims = size === 'lg'
    ? { h: 32, padX: 14, font: 13, imgH: 26 }
    : { h: 22, padX: 9,  font: 10.5, imgH: 18 };

  // Real logo path — transparent container, image fills.
  if (logoUrl) {
    const scale = station.logoScale || 1;
    // Default logos are black SVGs. Invert to white on dark backgrounds.
    // User-uploaded logos (data: URLs) keep their original colours.
    const needsInvert = isDark && !logoUrl.startsWith('data:');
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        height: dims.h, padding: `0 ${size === 'lg' ? 8 : 6}px`,
        borderRadius: 6, background: 'transparent', flexShrink: 0,
      }}>
        <img src={logoUrl} alt={station.name}
             style={{ height: dims.imgH * scale, maxWidth: 90,
                      objectFit: 'contain', display: 'block',
                      filter: needsInvert ? 'invert(1) brightness(2)' : 'none' }} />
      </span>
    );
  }

  const baseStyle = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    height: dims.h, padding: `0 ${dims.padX}px`, borderRadius: 5,
    background: station.bg, color: station.fg,
    fontSize: dims.font, lineHeight: 1, fontWeight: 700,
    letterSpacing: '-0.01em', whiteSpace: 'nowrap', flexShrink: 0,
    fontFamily: '"Inter", system-ui, sans-serif',
  };

  const m = station.mark;
  let inner;
  if (m.kind === 'serif') {
    inner = <span style={{ fontFamily: '"Fraunces", "Times New Roman", serif',
                            fontWeight: 600, fontStyle: 'italic',
                            fontSize: dims.font + 1, letterSpacing: '-0.02em' }}>
              {m.text}
            </span>;
  } else if (m.kind === 'stack') {
    inner = (
      <span style={{ display: 'flex', flexDirection: 'column',
                     alignItems: 'flex-start', lineHeight: 0.95,
                     fontFamily: '"Inter", sans-serif',
                     padding: '2px 0' }}>
        <span style={{ fontWeight: 800, fontSize: dims.font, letterSpacing: '-0.02em' }}>{m.top}</span>
        <span style={{ fontWeight: 600, fontSize: dims.font - 3,
                       letterSpacing: '0.1em', textTransform: 'uppercase',
                       opacity: 0.9 }}>{m.bot}</span>
      </span>
    );
  } else if (m.kind === 'thin') {
    inner = <span style={{ fontWeight: 500, letterSpacing: '0.01em',
                            fontFamily: '"Inter", sans-serif' }}>{m.text}</span>;
  } else if (m.kind === 'italic') {
    inner = <span style={{ fontStyle: 'italic', fontWeight: 700,
                            letterSpacing: '-0.02em',
                            fontFamily: '"Inter", sans-serif' }}>{m.text}</span>;
  } else if (m.kind === 'mono') {
    inner = <span style={{ fontFamily: '"JetBrains Mono", monospace',
                            fontWeight: 600, letterSpacing: '-0.02em',
                            fontSize: dims.font + 0.5 }}>{m.text}</span>;
  } else {
    inner = <span>{station.name}</span>;
  }
  return <span style={baseStyle}>{inner}</span>;
}

// ── Star popover — subject picker ────────────────────────────────────────────
function StarPopover({ event, follows, toggleFollow, onClose, anchor }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    setTimeout(() => document.addEventListener('mousedown', close), 0);
    return () => document.removeEventListener('mousedown', close);
  }, [onClose]);

  const rect = anchor ? anchor.getBoundingClientRect() : null;
  const top  = rect ? rect.bottom + 8 : 0;
  const right = rect ? Math.max(8, window.innerWidth - rect.right) : 0;

  return (
    <div ref={ref} style={{
      position: 'fixed', top, right,
      width: 280, background: 'var(--if-card)',
      border: '1px solid var(--if-hair)', borderRadius: 12,
      boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
      padding: 14, zIndex: 200, color: 'var(--if-fg)',
    }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--if-muted)',
                    letterSpacing: '0.18em', textTransform: 'uppercase',
                    marginBottom: 10 }}>
        Bæta við uppáhalds
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {event.subjects.map(sub => {
          const on = follows.has(sub.key);
          return (
            <label key={sub.key}
                   onClick={(e) => { e.stopPropagation(); toggleFollow(sub.key); }}
                   style={{
                     display: 'flex', alignItems: 'center', gap: 10,
                     padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                     background: on ? 'var(--if-accent-soft)' : 'transparent',
                     transition: 'background .12s',
                   }}>
              <span style={{
                width: 16, height: 16, borderRadius: 4,
                border: '1.5px solid var(--if-fg)',
                background: on ? 'var(--if-accent)' : 'transparent',
                borderColor: on ? 'var(--if-accent)' : 'var(--if-hair2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {on && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                       stroke="var(--if-accent-fg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600,
                               lineHeight: 1.2, letterSpacing: '-0.01em' }}>
                  {sub.label}
                </span>
                <span style={{ display: 'block', fontSize: 10.5,
                               color: 'var(--if-muted)', marginTop: 2,
                               textTransform: 'uppercase', letterSpacing: '0.12em',
                               fontWeight: 600 }}>
                  {sub.type === 'team' ? 'Lið / einstaklingur' :
                   sub.type === 'comp' ? 'Keppni' : 'Mótaröð'}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--if-muted)',
                    borderTop: '1px solid var(--if-hair)', paddingTop: 10,
                    lineHeight: 1.4 }}>
        Þú færð allt sem þú fylgir sjálfkrafa í <strong style={{color:'var(--if-fg)'}}>Uppáhalds</strong>.
      </div>
    </div>
  );
}

// ── Login mock modal ────────────────────────────────────────────────────────
function LoginModal({ onClose, onLogin }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 380, background: 'var(--if-card)', borderRadius: 16,
        padding: 28, border: '1px solid var(--if-hair)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.35)', color: 'var(--if-fg)',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11, background: 'var(--if-accent)',
          color: 'var(--if-accent-fg)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 20, fontWeight: 800,
          fontFamily: '"JetBrains Mono", monospace', letterSpacing: '-0.04em',
          marginBottom: 18,
        }}>ÍF</div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em',
                      lineHeight: 1.15, marginBottom: 8 }}>
          Skráðu þig inn til að halda í uppáhaldsleikina þína
        </div>
        <div style={{ fontSize: 13, color: 'var(--if-muted)', lineHeight: 1.5,
                      marginBottom: 22 }}>
          Þú færð sömu uppáhaldslið og keppnir á öllum tækjum.
          Sýnishorn — engin raunveruleg innskráning.
        </div>
        <button onClick={() => onLogin({ name: 'Anna Jónsdóttir', email: 'anna@gmail.com', initial: 'A' })}
                style={{
          width: '100%', padding: '12px 14px', borderRadius: 10,
          border: '1px solid var(--if-hair2)', background: 'var(--if-card2)',
          color: 'var(--if-fg)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          fontFamily: 'inherit',
        }}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#4285F4" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8a12 12 0 1 1 7.9-21l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.4-.4-3.5z"/>
            <path fill="#34A853" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"/>
            <path fill="#FBBC05" d="M24 44a20 20 0 0 0 13.4-5l-6.2-5.2c-1.9 1.3-4.4 2.2-7.2 2.2a12 12 0 0 1-11.3-8l-6.6 5.1A20 20 0 0 0 24 44z"/>
            <path fill="#EA4335" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C41.4 35.8 44 30.4 44 24c0-1.2-.1-2.4-.4-3.5z"/>
          </svg>
          Halda áfram með Google
        </button>
        <button onClick={() => onLogin({ name: 'Jón Sigurðsson', email: 'jon@facebook.com', initial: 'J' })}
                style={{
          width: '100%', padding: '12px 14px', borderRadius: 10, marginTop: 8,
          border: '1px solid var(--if-hair2)', background: 'var(--if-card2)',
          color: 'var(--if-fg)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          fontFamily: 'inherit',
        }}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#1877F2" d="M48 24C48 10.7 37.3 0 24 0S0 10.7 0 24c0 12 8.8 21.9 20.25 23.7V31H14.16V24h6.09v-5.3c0-6 3.58-9.34 9.06-9.34 2.62 0 5.36.47 5.36.47v5.9h-3c-2.98 0-3.9 1.85-3.9 3.74V24h6.64l-1.06 7h-5.58v16.7C39.2 45.9 48 36 48 24z"/>
            <path fill="#FFFFFF" d="M33.34 31l1.06-7h-6.64v-4.53c0-1.9.92-3.74 3.9-3.74h3v-5.9s-2.74-.47-5.36-.47c-5.48 0-9.06 3.34-9.06 9.34V24h-6.09v7h6.09v16.7c1.22.2 2.48.3 3.75.3 1.27 0 2.53-.1 3.75-.3V31h5.58z"/>
          </svg>
          Halda áfram með Facebook
        </button>
        <button onClick={onClose} style={{
          width: '100%', padding: '10px', marginTop: 10, borderRadius: 10,
          border: 'none', background: 'transparent', color: 'var(--if-muted)',
          fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Halda áfram án innskráningar
        </button>
      </div>
    </div>
  );
}

// ── Sport icon (monoline outline) ──
function SportIcon({ id, size = 22, strokeWidth = 1.5 }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 0 }}
               dangerouslySetInnerHTML={{ __html: window.IF_DATA.sportIcon(id, size, strokeWidth) }} />;
}

// ── Logo settings modal ──
// Two upload slots per station, one per theme. The 'forDark' slot is the white
// logo (for use on dark backgrounds); the 'forLight' slot is the dark logo (for
// use on light backgrounds). Legacy single-string entries from earlier versions
// migrate to `forDark` on first edit. Persists as data URLs in localStorage.
function LogoSettings({ stations, logos, setLogos, onClose }) {
  // Normalize an entry to an object so the two slots can be edited independently.
  const entryFor = (st) => {
    const raw = logos[st.id];
    return typeof raw === 'string' ? { forDark: raw }
         : (raw || {});
  };

  const handleFile = (stationId, variant, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const cur = logos[stationId];
      const obj = typeof cur === 'string' ? { forDark: cur } : (cur || {});
      setLogos({ ...logos, [stationId]: { ...obj, [variant]: reader.result } });
    };
    reader.readAsDataURL(file);
  };

  const clearVariant = (stationId, variant) => {
    const cur = logos[stationId];
    const obj = typeof cur === 'string' ? { forDark: cur } : (cur || {});
    const next = { ...obj };
    delete next[variant];
    const out = { ...logos };
    if (Object.keys(next).length === 0) delete out[stationId];
    else out[stationId] = next;
    setLogos(out);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 640, maxHeight: '88vh', overflowY: 'auto',
        background: 'var(--if-card)', borderRadius: 16, padding: 28,
        border: '1px solid var(--if-hair)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.35)', color: 'var(--if-fg)',
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em',
                      lineHeight: 1.15, marginBottom: 6 }}>
          Merki stöðvanna
        </div>
        <div style={{ fontSize: 13, color: 'var(--if-muted)', lineHeight: 1.5,
                      marginBottom: 22 }}>
          Hver stöð getur haft tvær útgáfur af merkinu — ein fyrir dökkt útlit
          (ljöst merki) og ein fyrir ljóst útlit (dökkt merki). Merkin birtast
          sjálfkrafa eftir þema. Vistað í vafranum.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {stations.map((st) => {
            const entry = entryFor(st);
            const defD = st.defaultLogos && st.defaultLogos.forDark;
            const defL = st.defaultLogos && st.defaultLogos.forLight;
            return (
              <div key={st.id} style={{
                padding: '14px 16px', borderRadius: 12,
                background: 'var(--if-card2)', border: '1px solid var(--if-hair)',
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10,
                              marginBottom: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 700,
                                letterSpacing: '-0.01em' }}>{st.name}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr',
                              gap: 12 }}>
                  <LogoSlot
                    label="Fyrir dökkt útlit" hint="Ljóst merki (oftast hvítt)"
                    bg="#0E0E0F"
                    url={entry.forDark || defD}
                    isCustom={!!entry.forDark}
                    onUpload={(file) => handleFile(st.id, 'forDark', file)}
                    onClear={entry.forDark ? () => clearVariant(st.id, 'forDark') : null}
                  />
                  <LogoSlot
                    label="Fyrir ljóst útlit" hint="Dökkt merki (oftast svart)"
                    bg="#FFFFFF"
                    url={entry.forLight || defL}
                    isCustom={!!entry.forLight}
                    onUpload={(file) => handleFile(st.id, 'forLight', file)}
                    onClear={entry.forLight ? () => clearVariant(st.id, 'forLight') : null}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={onClose} style={{
          width: '100%', padding: '11px', marginTop: 18, borderRadius: 10,
          border: '1px solid var(--if-hair2)', background: 'transparent',
          color: 'var(--if-fg)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'inherit',
        }}>
          Loka
        </button>
      </div>
    </div>
  );
}

// One upload slot inside the LogoSettings modal.
function LogoSlot({ label, hint, bg, url, isCustom, onUpload, onClear }) {
  const inputRef = React.useRef(null);
  return (
    <div style={{
      borderRadius: 10, border: '1px solid var(--if-hair)',
      padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline',
                    justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--if-fg)',
                      textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          {label}
        </div>
        {isCustom && (
          <div style={{ fontSize: 9.5, color: 'var(--if-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.14em',
                        fontWeight: 700 }}>Eigið</div>
        )}
      </div>
      <div style={{
        height: 56, borderRadius: 8, background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 8,
      }}>
        {url ? (
          <img src={url} alt="" style={{ maxHeight: 40, maxWidth: '100%',
                                          objectFit: 'contain' }} />
        ) : (
          <div style={{ color: bg === '#FFFFFF' ? '#999' : '#666',
                        fontSize: 11 }}>Engin mynd</div>
        )}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--if-muted)', lineHeight: 1.4 }}>
        {hint}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
               onChange={(e) => onUpload(e.target.files && e.target.files[0])} />
        <button onClick={() => inputRef.current && inputRef.current.click()}
                style={{
          flex: 1, padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
          background: 'var(--if-fg)', color: 'var(--if-bg)',
          border: 'none', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
        }}>
          {isCustom ? 'Skipta' : 'Hlaða inn'}
        </button>
        {onClear && (
          <button onClick={onClear} style={{
            padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
            background: 'transparent', color: 'var(--if-muted)',
            border: '1px solid var(--if-hair2)', fontSize: 12, fontWeight: 600,
            fontFamily: 'inherit',
          }}>×</button>
        )}
      </div>
    </div>
  );
}

// ── Ad slot ──
// Placeholder for pulsmedia.is integration. Renders a dashed-border box at the
// exact ad size with a clear label so you can see how the listed sizes fit
// into the layout. Swap the children for a real <script> / iframe later.
function AdSlot({ width, height, format }) {
  return (
    <div style={{
      width, height, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--if-card2)',
      border: '1px dashed var(--if-hair2)',
      borderRadius: 12, color: 'var(--if-muted)',
      position: 'relative', overflow: 'hidden',
      fontFamily: '"Inter", system-ui, sans-serif',
    }}>
      <div style={{
        fontSize: 9.5, fontWeight: 800, letterSpacing: '0.24em',
        textTransform: 'uppercase', color: 'var(--if-muted)',
      }}>Auglýsing</div>
      <div style={{
        marginTop: 10, fontSize: 28, fontWeight: 700,
        fontFamily: '"JetBrains Mono", monospace',
        color: 'var(--if-fg)', opacity: 0.55, letterSpacing: '-0.02em',
      }}>{width} × {height}</div>
      {format && (
        <div style={{ marginTop: 6, fontSize: 10.5,
                      color: 'var(--if-muted)', letterSpacing: '0.04em' }}>{format}</div>
      )}
      <div style={{
        position: 'absolute', bottom: 10, right: 14,
        fontSize: 9, opacity: 0.5, letterSpacing: '0.06em',
        fontFamily: '"JetBrains Mono", monospace',
      }}>pulsmedia.is</div>
    </div>
  );
}

window.IF_COMPS = { StationLogo, StarPopover, LoginModal, LogoSettings, SportIcon, AdSlot, readLS, writeLS, LS, resolveLogoUrl };
