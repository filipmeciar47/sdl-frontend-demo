// SpiralLensV5.jsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';

const LEVELS = [
  { id: 'beige',     name: 'BÉŽOVÁ',    motto: 'Prežitie',            polarity: 'express', hex: '#C4A882', glow: 'rgba(196,168,130,0.55)' },
  { id: 'purple',    name: 'PURPUROVÁ', motto: 'Bezpečie klanu',      polarity: 'deny',    hex: '#A78BFA', glow: 'rgba(167,139,250,0.55)' },
  { id: 'red',       name: 'ČERVENÁ',   motto: 'Moc a vôľa',          polarity: 'express', hex: '#F87171', glow: 'rgba(248,113,113,0.55)' },
  { id: 'blue',      name: 'MODRÁ',     motto: 'Poriadok a zmysel',   polarity: 'deny',    hex: '#60A5FA', glow: 'rgba(96,165,250,0.55)'  },
  { id: 'orange',    name: 'ORANŽOVÁ',  motto: 'Úspech a výkon',      polarity: 'express', hex: '#FB923C', glow: 'rgba(251,146,60,0.55)'  },
  { id: 'green',     name: 'ZELENÁ',    motto: 'Harmónia a rovnosť',  polarity: 'deny',    hex: '#4ADE80', glow: 'rgba(74,222,128,0.55)'  },
  { id: 'yellow',    name: 'ŽLTÁ',      motto: 'Syst. integrácia',    polarity: 'express', hex: '#FACC15', glow: 'rgba(250,204,21,0.6)'   },
  { id: 'turquoise', name: 'TYRKYSOVÁ', motto: 'Celostné vedomie',    polarity: 'deny',    hex: '#2DD4BF', glow: 'rgba(45,212,191,0.6)'   },
];

const HEIGHT  = 460;
const ROW_TOP = 110;
const ROW_BOT = 310;
const ICO_MAIN = 64;
const ICO_AXIS = 44;

function polyPath(pts) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`;
  return d;
}

export default function SpiralLensV5({
  icons = {}, axisIcons = {},
  activeKeys = [], pendingKeys = [],
  onLevelClick,
  integrated = false,
}) {
  const [hover, setHover] = useState(null);
  const containerRef = useRef(null);
  const [width, setWidth] = useState(860);
  const [mobileOffset, setMobileOffset] = useState(0);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      if (w > 0) setWidth(w);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const isMobile = width < 520;

  const MOBILE_VISIBLE = 4;
  const goPrev = useCallback(() => setMobileOffset(i => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setMobileOffset(i => Math.min(LEVELS.length - MOBILE_VISIBLE, i + 1)), []);

  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 36) {
      if (dx < 0) goNext(); else goPrev();
    }
    touchStartX.current = null;
  }, [goPrev, goNext]);

  const active  = useMemo(() => new Set(activeKeys),  [activeKeys]);
  const pending = useMemo(() => new Set(pendingKeys),  [pendingKeys]);
  // "selected" = clicked (pending or active)
  const selected = useMemo(() => new Set([...activeKeys, ...pendingKeys]), [activeKeys, pendingKeys]);

  // In integrated mode: expand to all levels up to the highest selected index
  const connected = useMemo(() => {
    if (!integrated || selected.size === 0) return selected;
    let maxIdx = -1;
    LEVELS.forEach((lv, i) => { if (selected.has(lv.id)) maxIdx = i; });
    if (maxIdx === -1) return selected;
    return new Set(LEVELS.slice(0, maxIdx + 1).map(lv => lv.id));
  }, [selected, integrated]);

  // Desktop geometry — computed regardless of mobile (hooks must run unconditionally)
  const slot = width / LEVELS.length;
  const items = useMemo(() => LEVELS.map((lv, i) => {
    const cx = (i + 0.5) * slot;
    const iconsY = lv.polarity === 'express' ? ROW_TOP : ROW_BOT;
    const axisY  = lv.polarity === 'express' ? ROW_BOT : ROW_TOP;
    return { lv, cx, iconsY, axisY };
  }), [slot]);
  const connItems   = items.filter(it => connected.has(it.lv.id));
  const connAnchors = connItems.map(it => ({ x: it.cx, y: it.iconsY }));
  const N = connItems.length;
  const outerToInner = Array.from({ length: N }, (_, i) => N - 1 - i);

  // ── MOBILE ZIG-ZAG ─────────────────────────────────────────────────
  if (isMobile) {
    const M_HEIGHT   = 320;
    const M_ROW_TOP  = 78;
    const M_ROW_BOT  = 208;
    const M_ICO_MAIN = 46;
    const M_ICO_AXIS = 28;
    const mSlot      = width / MOBILE_VISIBLE;

    const mobileItems = LEVELS.map((lv, i) => {
      const localIdx = i - mobileOffset;
      const cx       = (localIdx + 0.5) * mSlot;
      const iconsY   = lv.polarity === 'express' ? M_ROW_TOP : M_ROW_BOT;
      const axisY    = lv.polarity === 'express' ? M_ROW_BOT : M_ROW_TOP;
      return { lv, cx, iconsY, axisY, localIdx };
    });
    const visibleItems = mobileItems.filter(it => it.localIdx >= 0 && it.localIdx < MOBILE_VISIBLE);

    const connM        = visibleItems.filter(it => connected.has(it.lv.id));
    const connMAnchors = connM.map(it => ({ x: it.cx, y: it.iconsY }));
    const NM           = connM.length;

    const canLeft  = mobileOffset > 0;
    const canRight = mobileOffset + MOBILE_VISIBLE < LEVELS.length;
    const numDots  = LEVELS.length - MOBILE_VISIBLE + 1;

    return (
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ width: '100%', userSelect: 'none', fontFamily: "'DM Sans', Georgia, sans-serif", paddingBottom: 8 }}
      >
        <div style={{ position: 'relative', width: '100%', height: M_HEIGHT, overflow: 'hidden' }}>

          {/* Zone labels */}
          <div style={{ position: 'absolute', top: 136, left: 0, right: 0, textAlign: 'center', fontSize: 7, letterSpacing: '0.35em', color: 'rgba(255,180,100,0.3)', pointerEvents: 'none', zIndex: 5, textTransform: 'uppercase' }}>
            Express Self · JA
          </div>
          <div style={{ position: 'absolute', top: 158, left: 0, right: 0, textAlign: 'center', fontSize: 7, letterSpacing: '0.35em', color: 'rgba(96,165,250,0.3)', pointerEvents: 'none', zIndex: 5, textTransform: 'uppercase' }}>
            Deny Self · MY
          </div>

          {/* SVG: zig-zag + sparks */}
          <svg width={width} height={M_HEIGHT} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}>
            <defs>
              <filter id="mhalo" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="14" />
              </filter>
            </defs>
            {NM >= 2 && (
              <g style={{ mixBlendMode: 'screen' }}>
                <path d={polyPath(connMAnchors)} fill="none" stroke="rgba(255,255,255,0.12)"
                  strokeWidth={18} strokeLinecap="round" strokeLinejoin="round"
                  filter="url(#mhalo)" />
                <path d={polyPath(connMAnchors)} fill="none" stroke="rgba(255,255,255,0.55)"
                  strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
              </g>
            )}
            {connMAnchors.map((a, i) => (
              <circle key={i} cx={a.x} cy={a.y} r="2" fill="#fff" opacity="0.8" />
            ))}
          </svg>

          {/* Left arrow */}
          {canLeft && (
            <button onClick={goPrev} style={{
              position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
              background: 'linear-gradient(90deg, rgba(0,0,0,0.55) 0%, transparent 100%)',
              border: 'none', color: 'rgba(255,255,255,0.65)',
              fontSize: 26, lineHeight: 1, cursor: 'pointer',
              width: 36, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 20, borderRadius: '0 6px 6px 0', flexShrink: 0,
            }}>‹</button>
          )}

          {/* Right arrow */}
          {canRight && (
            <button onClick={goNext} style={{
              position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
              background: 'linear-gradient(270deg, rgba(0,0,0,0.55) 0%, transparent 100%)',
              border: 'none', color: 'rgba(255,255,255,0.65)',
              fontSize: 26, lineHeight: 1, cursor: 'pointer',
              width: 36, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 20, borderRadius: '6px 0 0 6px', flexShrink: 0,
            }}>›</button>
          )}

          {/* Icons */}
          {visibleItems.map(({ lv, cx, iconsY, axisY }) => {
            const isHvr   = hover === lv.id;
            const isAct   = active.has(lv.id);
            const isSel   = selected.has(lv.id);
            const src1    = icons[lv.id];
            const src2    = axisIcons[lv.id];
            const glow    = isHvr ? 0.72 : isSel ? 0.88 : 0.28;
            const imgOp   = isHvr ? 1 : isSel ? 1 : 0.82;
            const blur    = isHvr ? 8 : isSel ? 10 : 3;

            return (
              <React.Fragment key={lv.id}>
                {/* Main icon */}
                <div
                  onMouseEnter={() => setHover(lv.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onLevelClick?.(lv.id)}
                  style={{
                    position: 'absolute',
                    left: cx - M_ICO_MAIN / 2 - 10,
                    top: iconsY - M_ICO_MAIN / 2 - 2,
                    width: M_ICO_MAIN + 20,
                    cursor: 'pointer', zIndex: isHvr ? 50 : 10,
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    transform: isHvr ? 'scale(1.1)' : 'scale(1)',
                    transition: 'transform 0.2s cubic-bezier(.2,.7,.2,1)',
                  }}
                >
                  <div style={{ position: 'relative', width: M_ICO_MAIN, height: M_ICO_MAIN }}>
                    <div style={{
                      position: 'absolute', inset: -(M_ICO_MAIN * 0.22),
                      background: `radial-gradient(circle, ${lv.hex}99 0%, ${lv.glow} 30%, transparent 65%)`,
                      opacity: glow, transition: 'opacity 0.2s', pointerEvents: 'none', filter: 'blur(4px)',
                    }} />
                    {src1 && (
                      <img src={src1} alt={lv.name} style={{
                        position: 'relative', width: '100%', height: '100%',
                        borderRadius: '50%', objectFit: 'cover',
                        filter: `drop-shadow(0 0 ${blur}px ${lv.glow})`,
                        opacity: imgOp, transition: 'filter 0.2s, opacity 0.2s',
                      }} />
                    )}
                    {isAct && <div style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: `2px solid ${lv.hex}`, boxShadow: `0 0 10px ${lv.glow}`, pointerEvents: 'none' }} />}
                    {!isAct && isSel && <div style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: `1.5px solid ${lv.hex}bb`, pointerEvents: 'none' }} />}
                  </div>
                  <div style={{ marginTop: 3, fontSize: 7, letterSpacing: '0.13em', fontWeight: 600, textTransform: 'uppercase', textAlign: 'center', color: (isHvr || isSel) ? lv.hex : 'rgba(200,190,178,0.68)', whiteSpace: 'nowrap', transition: 'color 0.2s' }}>{lv.name}</div>
                </div>

                {/* Axis icon */}
                {src2 && (
                  <div
                    onMouseEnter={() => setHover(lv.id)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => onLevelClick?.(lv.id)}
                    style={{
                      position: 'absolute',
                      left: cx - M_ICO_AXIS / 2,
                      top: axisY - M_ICO_AXIS / 2,
                      width: M_ICO_AXIS, height: M_ICO_AXIS,
                      cursor: 'pointer', zIndex: isHvr ? 50 : 10,
                    }}
                  >
                    <img src={src2} alt={lv.name} style={{
                      width: '100%', height: '100%',
                      borderRadius: '50%', objectFit: 'cover',
                      filter: `drop-shadow(0 0 ${isHvr ? 8 : isSel ? 6 : 2}px ${lv.glow})`,
                      opacity: isHvr ? 0.95 : isSel ? 0.82 : 0.48,
                      transition: 'filter 0.2s, opacity 0.2s',
                    }} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Dot pagination */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 10 }}>
          {Array.from({ length: numDots }, (_, i) => (
            <div
              key={i}
              onClick={() => setMobileOffset(i)}
              style={{
                width: i === mobileOffset ? 16 : 6, height: 6, borderRadius: 3,
                background: i === mobileOffset
                  ? LEVELS[i + Math.floor(MOBILE_VISIBLE / 2)].hex
                  : 'rgba(255,255,255,0.18)',
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(.2,.7,.2,1)',
              }}
            />
          ))}
        </div>
      </div>
    );
  }
  // ── END MOBILE ZIG-ZAG ──────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: HEIGHT, overflow: 'hidden', fontFamily: "'DM Sans', Georgia, sans-serif" }}
    >
      {/* Zone labels — centered in the gap between the two icon rows */}
      <div style={{ position: 'absolute', top: 168, left: 0, right: 0, textAlign: 'center', fontSize: 8, letterSpacing: '0.38em', color: 'rgba(255,180,100,0.38)', pointerEvents: 'none', zIndex: 5, fontFamily: "'DM Sans', sans-serif", textTransform: 'uppercase' }}>
        Express Self · JA
      </div>
      <div style={{ position: 'absolute', top: 248, left: 0, right: 0, textAlign: 'center', fontSize: 8, letterSpacing: '0.38em', color: 'rgba(96,165,250,0.38)', pointerEvents: 'none', zIndex: 5, fontFamily: "'DM Sans', sans-serif", textTransform: 'uppercase' }}>
        Deny Self · MY
      </div>

      <svg width={width} height={HEIGHT} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}>
        <defs>
          <filter id="slv5-halo" x="-120%" y="-120%" width="340%" height="340%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation="26" />
          </filter>
          <filter id="slv5-band" x="-60%" y="-60%" width="220%" height="220%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <filter id="slv5-core" x="-40%" y="-40%" width="180%" height="180%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
        </defs>

        {/* Glowing zigzag — connected levels only (solid, no dashes) */}
        {N >= 2 && (
          <>
            <g style={{ mixBlendMode: 'screen' }}>
              {connItems.map((it, k) => (
                <path key={`halo-${it.lv.id}`} d={polyPath(connAnchors.slice(k))}
                  fill="none" stroke={it.lv.hex}
                  strokeWidth={11 + k * 13} strokeLinecap="round" strokeLinejoin="round"
                  strokeOpacity="0.38"
                  filter="url(#slv5-halo)" />
              ))}
            </g>
            <g>
              {outerToInner.map(k => {
                const it = connItems[k];
                return (
                  <path key={`band-${it.lv.id}`} d={polyPath(connAnchors.slice(k))}
                    fill="none" stroke={it.lv.hex}
                    strokeWidth={11 + k * 13} strokeLinecap="round" strokeLinejoin="round"
                    strokeOpacity="0.85"
                    filter="url(#slv5-band)" />
                );
              })}
            </g>
            <g style={{ mixBlendMode: 'screen' }}>
              <path d={polyPath(connAnchors)} fill="none" stroke="#ffffff"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                strokeOpacity="0.6" filter="url(#slv5-core)" />
            </g>
          </>
        )}

        {/* Sparks at connected ICONS anchors */}
        {connAnchors.map((a, idx) => (
          <circle key={`spark-${idx}`} cx={a.x} cy={a.y} r="2.5"
            fill="#fff" opacity="0.85" />
        ))}
      </svg>

      {/* Render each level */}
      {items.map(({ lv, cx, iconsY, axisY }) => {
        const isHover   = hover === lv.id;
        const isActive  = active.has(lv.id);
        const isSel     = selected.has(lv.id);  // clicked (pending or active)
        const isConn    = connected.has(lv.id); // in zigzag

        const src1 = icons[lv.id];
        const src2 = axisIcons[lv.id];

        // Glow intensity: hover > selected > base
        const glowOpacity = isHover ? 0.72 : isSel ? 0.88 : 0.28;
        const imgOpacity  = isHover ? 1    : isSel ? 1    : 0.82;
        const glowBlur    = isHover ? 8    : isSel ? 12   : 4;
        const axisOpacity = isHover ? 0.95 : isSel ? 0.85 : 0.55;
        const axisGlowBlur = isHover ? 8   : isSel ? 8    : 2;

        return (
          <React.Fragment key={lv.id}>
            {/* ICONS badge — at zigzag anchor row */}
            <div
              onMouseEnter={() => setHover(lv.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onLevelClick && onLevelClick(lv.id)}
              style={{
                position: 'absolute',
                left: cx - ICO_MAIN / 2 - 14,
                top: iconsY - ICO_MAIN / 2 - 4,
                width: ICO_MAIN + 28,
                cursor: 'pointer',
                zIndex: isHover ? 50 : 10,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                transform: isHover ? 'scale(1.08)' : 'scale(1)',
                transition: 'transform 0.22s cubic-bezier(.2,.7,.2,1)',
              }}
            >
              <div style={{ position: 'relative', width: ICO_MAIN, height: ICO_MAIN }}>
                <div style={{
                  position: 'absolute', inset: -(ICO_MAIN * 0.22),
                  background: `radial-gradient(circle, ${lv.hex}99 0%, ${lv.glow} 30%, transparent 65%)`,
                  opacity: glowOpacity,
                  transition: 'opacity 0.22s', pointerEvents: 'none', filter: 'blur(5px)',
                }} />
                {src1 && (
                  <img src={src1} alt={lv.name} style={{
                    position: 'relative', width: '100%', height: '100%',
                    borderRadius: '50%', objectFit: 'cover',
                    filter: `drop-shadow(0 0 ${glowBlur}px ${lv.glow})`,
                    opacity: imgOpacity,
                    transition: 'filter 0.22s, opacity 0.22s',
                  }} />
                )}
                {/* Ring: solid for active, thinner for pending-only */}
                {isActive && (
                  <div style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: `2px solid ${lv.hex}`, boxShadow: `0 0 12px ${lv.glow}`, pointerEvents: 'none' }} />
                )}
                {!isActive && isSel && (
                  <div style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: `1.5px solid ${lv.hex}bb`, pointerEvents: 'none' }} />
                )}
              </div>
              {/* Label */}
              <div style={{ marginTop: 5, textAlign: 'center' }}>
                <div style={{
                  fontSize: 9, letterSpacing: '0.16em', fontWeight: 600, textTransform: 'uppercase',
                  color: (isHover || isSel) ? lv.hex : 'rgba(200,190,178,0.7)',
                  textShadow: (isHover || isSel) ? `0 0 8px ${lv.glow}` : 'none',
                  transition: 'color 0.22s', whiteSpace: 'nowrap',
                }}>{lv.name}</div>
                <div style={{
                  marginTop: 2, fontSize: 8,
                  fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic',
                  color: (isHover || isSel) ? 'rgba(220,210,200,0.9)' : 'rgba(200,190,178,0.5)',
                  transition: 'color 0.22s', whiteSpace: 'nowrap',
                }}>{lv.motto}</div>
              </div>
            </div>

            {/* AXIS_ICONS badge — opposite row, no label */}
            {src2 && (
              <div
                onMouseEnter={() => setHover(lv.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onLevelClick && onLevelClick(lv.id)}
                style={{
                  position: 'absolute',
                  left: cx - ICO_AXIS / 2,
                  top: axisY - ICO_AXIS / 2,
                  width: ICO_AXIS, height: ICO_AXIS,
                  cursor: 'pointer', zIndex: isHover ? 50 : 10,
                  transform: isHover ? 'scale(1.08)' : 'scale(1)',
                  transition: 'transform 0.22s cubic-bezier(.2,.7,.2,1)',
                }}
              >
                <img src={src2} alt={lv.name} style={{
                  width: '100%', height: '100%',
                  borderRadius: '50%', objectFit: 'cover',
                  filter: `drop-shadow(0 0 ${axisGlowBlur}px ${lv.glow})`,
                  opacity: axisOpacity,
                  transition: 'filter 0.22s, opacity 0.22s',
                }} />
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* Bottom hint */}
      <div style={{
        position: 'absolute', bottom: 22, left: 0, right: 0,
        textAlign: 'center', pointerEvents: 'none', zIndex: 6,
        fontSize: 10, letterSpacing: '0.28em',
        color: N === 0 ? 'rgba(200,190,178,0.22)' : 'transparent',
        transition: 'color 0.3s',
      }}>
        KLIKNUTÍM AKTIVUJEŠ ÚROVEŇ
      </div>
    </div>
  );
}
