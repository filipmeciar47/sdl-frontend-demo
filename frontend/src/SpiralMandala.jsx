/**
 * SpiralMandala — interaktívna rotujúca mandala s 8 vrstvami
 * --------------------------------------------------------------
 * Štandardný React komponent (import-friendly, žiadne globaly).
 * Bez vonkajších závislostí okrem `react` (>= 18).
 *
 * Public API:
 *   <SpiralMandala />                            // celý panel: mandala + info bar + mode toggle
 *   <SpiralMandalaCore />                        // len mandala (bez info baru a toggle-a)
 *   SPIRAL_LEVEL_KEYS, SPIRAL_LEVEL_COLORS       // pre downstream logiku
 *   ROTATION_DURATION_MS                         // 2400 ms — koniec rotácie
 *
 * Assety:
 *   Komponent očakáva 8 PNG vrstiev (transparent background) na ceste assetBase.
 *   Defaultná cesta: "/assets/mandala". Štruktúra:
 *       <assetBase>/layers/beige.png ... turquoise.png
 *       <assetBase>/icons/beige-L.png ... turquoise-R.png
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';

/* ================================================================== */
/* PUBLIC EXPORTS                                                      */
/* ================================================================== */

export const ROTATION_DURATION_MS = 2400;

export const SPIRAL_LEVEL_KEYS = [
  'beige', 'purple', 'red', 'blue',
  'orange', 'green', 'yellow', 'turquoise',
];

export const SPIRAL_LEVEL_COLORS = {
  beige:     '#c9b896',
  purple:    '#6b4d8a',
  red:       '#c8443d',
  blue:      '#3e5a96',
  orange:    '#d97a2c',
  green:     '#4a8a3f',
  yellow:    '#d9b441',
  turquoise: '#3aa6a0',
};

export const SPIRAL_LEVEL_MEANINGS = {
  beige:     'Inštinkt · Prežitie',
  purple:    'Kmeň · Mágia',
  red:       'Sila · Ego',
  blue:      'Poriadok · Pravda',
  orange:    'Úspech · Stratégia',
  green:     'Komunita · Pluralita',
  yellow:    'Integrácia · Systém',
  turquoise: 'Holos · Globálna',
};

export const SPIRAL_LEVEL_NAMES = {
  beige:     'Béžová',
  purple:    'Purpurová',
  red:       'Červená',
  blue:      'Modrá',
  orange:    'Oranžová',
  green:     'Zelená',
  yellow:    'Žltá',
  turquoise: 'Tyrkysová',
};

/* ================================================================== */
/* KONFIGURÁCIA VRSTIEV                                                */
/* ================================================================== */
/* innerSrc/outerSrc/imgSize sú namerané v zdrojovom PNG (px od stredu).
   Slúžia na chain-fit: každá ďalšia vrstva sedí presne na vonkajšej
   hrane predošlej. NEMEŇ tieto hodnoty, pokiaľ nemeníš zdrojový obrázok. */
const LAYER_CONFIG = [
  { key: 'beige',     imgSize: 600,  innerSrc: 0,   outerSrc: 205 },
  { key: 'purple',    imgSize: 600,  innerSrc: 182, outerSrc: 280 },
  { key: 'red',       imgSize: 600,  innerSrc: 194, outerSrc: 292 },
  { key: 'blue',      imgSize: 600,  innerSrc: 195, outerSrc: 292 },
  { key: 'orange',    imgSize: 500,  innerSrc: 195, outerSrc: 240 },
  { key: 'green',     imgSize: 600,  innerSrc: 202, outerSrc: 252, offsetY: 6 },
  { key: 'yellow',    imgSize: 1254, innerSrc: 392, outerSrc: 477, offsetY: 10 },
  { key: 'turquoise', imgSize: 600,  innerSrc: 196, outerSrc: 237 },
];

const VIEW = 800;
/* Vonkajší polomer prvej (béžovej) vrstvy vo view-box jednotkách —
   z neho sa odvodzuje veľkosť všetkých ostatných cez chain-fit. */
const BASE_OUTER = 51;

function buildGeometry(assetBase, layerOverrides) {
  let prevOuter = 0;
  let firstReady = true;
  return LAYER_CONFIG.map((cfg, idx) => {
    const override = layerOverrides?.[cfg.key] ?? {};
    const src   = override.src   ?? `${assetBase}/layers/${cfg.key}.png`;
    const iconL = override.iconL ?? `${assetBase}/icons/${cfg.key}-L.png`;
    const iconR = override.iconR ?? `${assetBase}/icons/${cfg.key}-R.png`;
    const color = SPIRAL_LEVEL_COLORS[cfg.key];

    let scale, targetInner, targetOuter;
    if (firstReady) {
      scale = BASE_OUTER / cfg.outerSrc;
      targetInner = cfg.innerSrc * scale;
      targetOuter = BASE_OUTER;
      firstReady = false;
    } else {
      scale = prevOuter / cfg.innerSrc;
      targetInner = prevOuter;
      targetOuter = cfg.outerSrc * scale;
    }
    const imgWidthVbu = cfg.imgSize * scale;
    prevOuter = targetOuter;

    return {
      ...cfg, idx, color, src, iconL, iconR,
      name:    SPIRAL_LEVEL_NAMES[cfg.key],
      meaning: SPIRAL_LEVEL_MEANINGS[cfg.key],
      scale, targetInner, targetOuter, imgWidthVbu,
    };
  });
}

/* ================================================================== */
/* JEDNA VRSTVA — celý PNG, rotuje sa ako celok                        */
/* ================================================================== */
const LayerImage = ({ layer, rotation, isActive, isDimmed, isHovered, tintColor }) => {
  const widthPct = (layer.imgWidthVbu / VIEW) * 100;
  const offX = ((layer.offsetX || 0) * layer.scale) / VIEW * 100;
  const offY = ((layer.offsetY || 0) * layer.scale) / VIEW * 100;

  let filterFx = 'none';
  if (isActive) {
    filterFx = `drop-shadow(0 0 14px ${layer.color}dd) drop-shadow(0 0 28px ${layer.color}66)`;
  } else if (isDimmed) {
    filterFx = 'blur(1.4px) brightness(0.78) saturate(0.9)';
  } else if (isHovered) {
    filterFx = `drop-shadow(0 0 9px ${layer.color}aa)`;
  }
  const brightness = isActive ? 1.18 : isHovered ? 1.10 : 1;
  const scaleFx    = isActive ? 1.04 : 1;
  const opacity    = isDimmed ? 0.78 : 1;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1 + layer.idx,
        pointerEvents: 'none',
        opacity,
        filter: filterFx,
        transition: 'opacity 900ms ease, filter 900ms ease',
      }}
    >
      <img
        src={layer.src}
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          top:  `calc(50% + ${offY}%)`,
          left: `calc(50% + ${offX}%)`,
          width:  `${widthPct}%`,
          height: `${widthPct}%`,
          transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scaleFx})`,
          transformOrigin: 'center center',
          transition: `transform ${ROTATION_DURATION_MS}ms cubic-bezier(0.45, 0.05, 0.25, 1), filter 900ms ease`,
          filter: `brightness(${brightness})`,
          userSelect: 'none',
          willChange: 'transform',
          imageRendering: '-webkit-optimize-contrast',
        }}
      />
      {tintColor && (
        <div
          style={{
            position: 'absolute',
            top:  `calc(50% + ${offY}%)`,
            left: `calc(50% + ${offX}%)`,
            width:  `${widthPct}%`,
            height: `${widthPct}%`,
            transform: 'translate(-50%, -50%)',
            WebkitMaskImage: `url(${layer.src})`,
            maskImage: `url(${layer.src})`,
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            background: tintColor,
            opacity: 0.32,
            mixBlendMode: 'color',
            transition: 'opacity 900ms ease, background-color 900ms ease',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
};

/* ================================================================== */
/* HALO + STRED                                                        */
/* ================================================================== */
const MandalaGlow = ({ activeColor }) => (
  <>
    <div style={{
      position: 'absolute',
      inset: '-18%',
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(217, 180, 65, 0.18) 0%, rgba(217, 122, 44, 0.09) 32%, rgba(58, 166, 160, 0.04) 58%, transparent 78%)',
      pointerEvents: 'none',
      zIndex: 0,
      animation: 'spiralMandalaGlowPulse 8s ease-in-out infinite',
      transformOrigin: 'center',
      filter: 'blur(8px)',
    }} />
    <div style={{
      position: 'absolute',
      inset: '-14%',
      borderRadius: '50%',
      background: activeColor
        ? `radial-gradient(circle, ${activeColor}42 0%, ${activeColor}18 30%, transparent 62%)`
        : 'transparent',
      pointerEvents: 'none',
      zIndex: 0,
      opacity: activeColor ? 1 : 0,
      transition: 'opacity 900ms ease, background 900ms ease',
      filter: 'blur(6px)',
    }} />
  </>
);

/* ================================================================== */
/* HIT-OVERLAY — výber podľa radial distance k najbližšej vrstve       */
/* ================================================================== */
const HitOverlay = ({ geom, onClick, onHover }) => {
  const pick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const radiusPx  = Math.sqrt(dx * dx + dy * dy);
    const radiusVbu = radiusPx * (VIEW / rect.width);
    const maxR = geom[geom.length - 1].targetOuter + 25;
    if (radiusVbu > maxR) return null;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < geom.length; i++) {
      const mid = (geom[i].targetInner + geom[i].targetOuter) / 2;
      const d   = Math.abs(radiusVbu - mid);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    return bestIdx;
  };

  return (
    <div
      onMouseMove={(e) => onHover(pick(e))}
      onMouseLeave={() => onHover(null)}
      onClick={(e) => { const idx = pick(e); if (idx !== null) onClick(idx); }}
      style={{ position: 'absolute', inset: 0, zIndex: 60, cursor: 'pointer' }}
    />
  );
};

/* ================================================================== */
/* SpiralMandalaCore — len mandala, bez chrome                         */
/* ================================================================== */
export function SpiralMandalaCore({
  mode = 'integrative',
  selectedList: controlledSelected,
  onSelectionChange,
  onSelect,
  onDeselect,
  onRotate,
  onRotateComplete,
  onHover,
  size = 'min(72vw, 560px)',
  assetBase = '/assets/mandala',
  layers: layerOverrides,
  className,
  style,
}) {
  const geomRef = useRef(null);
  if (!geomRef.current) {
    geomRef.current = buildGeometry(assetBase, layerOverrides);
  }
  const GEOM = geomRef.current;

  const [internalSelected, setInternalSelected] = useState([]);
  const selectedList = controlledSelected ?? internalSelected;
  const [hovered, setHovered]   = useState(null);
  const [rotations, setRotations] = useState(() => GEOM.map(() => 0));

  useEffect(() => {
    if (controlledSelected === undefined) setInternalSelected([]);
    onDeselect?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const updateSelected = useCallback((next) => {
    if (controlledSelected === undefined) setInternalSelected(next);
    onSelectionChange?.(next.map((i) => ({ key: GEOM[i].key, color: GEOM[i].color, idx: i })));
    if (next.length === 0) onDeselect?.();
  }, [controlledSelected, onSelectionChange, onDeselect, GEOM]);

  const handleRingClick = useCallback((idx) => {
    const selDir  = idx % 2 === 0 ? 1 : -1;
    const layer   = GEOM[idx];
    const levelInfo = { key: layer.key, color: layer.color, idx };

    let nextSelected, rotatingIndices;

    if (mode === 'single') {
      const cur = selectedList;
      nextSelected     = cur.includes(idx) ? cur.filter((x) => x !== idx) : [...cur, idx];
      rotatingIndices  = [idx];
    } else {
      const lastSelected = selectedList.length > 0 ? selectedList[selectedList.length - 1] : null;
      if (lastSelected === idx) {
        nextSelected    = [];
        rotatingIndices = [];
        for (let i = 0; i <= idx; i++) rotatingIndices.push(i);
      } else {
        nextSelected    = [];
        rotatingIndices = [];
        for (let i = 0; i <= idx; i++) { nextSelected.push(i); rotatingIndices.push(i); }
      }
    }

    updateSelected(nextSelected);
    onSelect?.(levelInfo);

    if (rotatingIndices.length > 0) {
      setRotations((prev) => {
        const next = prev.slice();
        for (const i of rotatingIndices) next[i] = next[i] + 360 * selDir;
        return next;
      });
      onRotate?.(levelInfo, idx);
      window.setTimeout(() => {
        onRotateComplete?.(levelInfo, idx);
      }, ROTATION_DURATION_MS);
    }
  }, [GEOM, mode, selectedList, updateSelected, onSelect, onRotate, onRotateComplete]);

  const handleHover = useCallback((idx) => {
    setHovered(idx);
    if (idx === null) onHover?.(null);
    else onHover?.({ key: GEOM[idx].key, color: GEOM[idx].color, idx });
  }, [onHover, GEOM]);

  const lastSelected = selectedList.length > 0 ? selectedList[selectedList.length - 1] : null;
  const isActive  = (i) => selectedList.includes(i);
  const isDimmed  = (i) => selectedList.length > 0 && !isActive(i);
  const isHovered = (i) => hovered === i && !isActive(i);
  const tintColorFor = (i) => {
    if (!isActive(i)) return null;
    if (mode === 'single') return GEOM[i].color;
    return lastSelected !== null ? GEOM[lastSelected].color : null;
  };

  return (
    <>
      <style>{`
        @keyframes spiralMandalaGlowPulse {
          0%, 100% { opacity: 0.85; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.045); }
        }
      `}</style>
      <div
        className={className}
        style={{ position: 'relative', width: size, aspectRatio: '1 / 1', ...(style || {}) }}
        onClick={(e) => { if (e.target === e.currentTarget) updateSelected([]); }}
      >
        <MandalaGlow activeColor={lastSelected !== null ? GEOM[lastSelected].color : null} />
        {GEOM.map((layer, i) => (
          <LayerImage
            key={layer.key}
            layer={layer}
            rotation={rotations[i]}
            isActive={isActive(i)}
            isDimmed={isDimmed(i)}
            isHovered={isHovered(i)}
            tintColor={tintColorFor(i)}
          />
        ))}
        <HitOverlay geom={GEOM} onClick={handleRingClick} onHover={handleHover} />
      </div>
    </>
  );
}

/* ================================================================== */
/* InfoBar — L/R ikony + názov + meaning                               */
/* ================================================================== */
function InfoBar({ level }) {
  if (!level) {
    return (
      <div style={{
        fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif',
        fontSize: 12, letterSpacing: '0.32em', textTransform: 'uppercase',
        color: 'rgba(239, 230, 214, 0.35)',
        marginTop: 30,
      }}>vyberte úroveň</div>
    );
  }
  const L = level;
  const badge = (icon) => (
    <div style={{
      width: 72, height: 72, borderRadius: '50%',
      background: 'radial-gradient(circle at 35% 30%, #2c1c10 0%, #150a04 75%)',
      border: `1.5px solid ${L.color}55`,
      boxShadow: `inset 0 0 0 1px rgba(217, 180, 65, 0.32), inset 0 2px 4px rgba(0,0,0,0.55), 0 0 14px ${L.color}3a, 0 4px 10px rgba(0,0,0,0.45)`,
      position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <img src={icon} alt="" draggable={false}
        style={{
          width: '76%', height: '76%', objectFit: 'contain',
          filter: `saturate(0.82) sepia(0.18) brightness(0.94) drop-shadow(0 0 4px ${L.color}88) drop-shadow(0 1px 2px rgba(0,0,0,0.7))`,
          userSelect: 'none', position: 'relative', zIndex: 1,
        }} />
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle, ${L.color}22 0%, transparent 65%)`, pointerEvents: 'none', mixBlendMode: 'screen' }} />
    </div>
  );
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '72px 1fr 72px',
      alignItems: 'center', gap: 18,
      width: '100%', maxWidth: 520, padding: '0 8px',
    }}>
      {badge(L.iconL)}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{
          fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif',
          fontSize: 11, letterSpacing: '0.36em', textTransform: 'uppercase',
          color: L.color, opacity: 0.95,
        }}>{L.name}</div>
        <div style={{
          fontFamily: 'ui-serif, Georgia, serif', fontStyle: 'italic',
          fontSize: 16, color: 'rgba(239, 230, 214, 0.85)', textAlign: 'center',
        }}>{L.meaning}</div>
      </div>
      {badge(L.iconR)}
    </div>
  );
}

/* ================================================================== */
/* ModeToggle                                                          */
/* ================================================================== */
function ModeToggle({ mode, onChange }) {
  const on = mode === 'integrative';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif',
      fontSize: 14, color: 'rgba(239, 230, 214, 0.75)', userSelect: 'none',
    }}>
      <span style={{ opacity: on ? 0.55 : 1, transition: 'opacity 300ms ease', color: on ? undefined : '#f0e6d4' }}>
        Jednotlivá úroveň
      </span>
      <div role="switch" aria-checked={on} onClick={() => onChange(on ? 'single' : 'integrative')}
        style={{
          width: 46, height: 24, borderRadius: 100,
          background: on ? 'rgba(217, 180, 65, 0.85)' : 'rgba(60, 48, 30, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          position: 'relative', cursor: 'pointer',
          transition: 'background 300ms ease',
        }}>
        <div style={{
          position: 'absolute', top: 2, left: on ? 24 : 2,
          width: 18, height: 18, borderRadius: '50%',
          background: on ? '#1a0f08' : '#d9b441',
          transition: 'left 360ms cubic-bezier(.45,.05,.25,1), background 300ms ease',
        }} />
      </div>
      <span style={{ opacity: on ? 1 : 0.55, transition: 'opacity 300ms ease', color: on ? '#f0e6d4' : undefined }}>
        Integrovaný pohľad
      </span>
    </div>
  );
}

/* ================================================================== */
/* SpiralMandala — celý panel (mandala + voliteľný info bar + toggle)  */
/* ================================================================== */
export default function SpiralMandala({
  mode: controlledMode,
  defaultMode = 'integrative',
  onModeChange,
  onSelect,
  onSelectionChange,
  onRotate,
  onRotateComplete,
  onDeselect,
  onHover,
  size = 'min(72vw, 560px)',
  assetBase = '/assets/mandala',
  layers,
  showInfoBar    = false,
  showModeToggle = false,
  showHint       = false,
  className,
  style,
}) {
  const [internalMode, setInternalMode] = useState(defaultMode);
  const mode   = controlledMode ?? internalMode;
  const setMode = (m) => {
    if (controlledMode === undefined) setInternalMode(m);
    onModeChange?.(m);
  };

  const [activeLevels,  setActiveLevels]  = useState([]);
  const [hoveredLevel,  setHoveredLevel]  = useState(null);

  const geomRef = useRef(null);
  if (!geomRef.current) geomRef.current = buildGeometry(assetBase, layers);
  const GEOM = geomRef.current;

  const handleSelectionChange = (levels) => {
    setActiveLevels(levels);
    onSelectionChange?.(levels);
  };

  const lastLevel    = activeLevels.length > 0 ? activeLevels[activeLevels.length - 1] : null;
  const showLevelIdx = lastLevel ? lastLevel.idx : (hoveredLevel ? hoveredLevel.idx : null);
  const showLevel    = showLevelIdx !== null ? GEOM[showLevelIdx] : null;

  const hintText = mode === 'integrative'
    ? 'Kliknutím na vrstvu otvoríte túto + všetky vnútorné úrovne'
    : 'Kliknutím pridáte / odoberiete úroveň; každá zostane svietiť svojou farbou';

  return (
    <div
      className={className}
      style={{
        width: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 22,
        ...(style || {}),
      }}
    >
      <SpiralMandalaCore
        mode={mode}
        size={size}
        assetBase={assetBase}
        layers={layers}
        onSelectionChange={handleSelectionChange}
        onSelect={onSelect}
        onRotate={onRotate}
        onRotateComplete={onRotateComplete}
        onDeselect={() => { setActiveLevels([]); onDeselect?.(); }}
        onHover={(lvl) => { setHoveredLevel(lvl); onHover?.(lvl); }}
      />

      {showInfoBar && (
        <div style={{ minHeight: 96, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: '100%' }}>
          <InfoBar level={showLevel} />
        </div>
      )}

      {showModeToggle && <ModeToggle mode={mode} onChange={setMode} />}

      {showHint && (
        <div style={{
          fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif',
          fontSize: 13, color: 'rgba(239, 230, 214, 0.45)', textAlign: 'center',
          maxWidth: 520, lineHeight: 1.5,
        }}>
          {hintText}
        </div>
      )}
    </div>
  );
}
