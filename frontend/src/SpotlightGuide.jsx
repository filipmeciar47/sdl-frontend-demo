// SpotlightGuide.jsx
// ─────────────────────────────────────────────────────────────────────────────
//  Spotlight tutorial sprievodca pre Spiral Dynamics Lens.
//  Self-contained — žiadne externé závislosti okrem React-u.
//
//  Použitie v App.jsx (presný postup viď IMPLEMENTATION.md):
//    import { useSpotlightGuide, GuideButton, GuideOverlay } from "./SpotlightGuide";
//
//    const guidePhase = !topicSet ? "intro"
//                     : Object.keys(colorChats).length === 0 ? "tools"
//                     : "features";
//    const guide = useSpotlightGuide(guidePhase);
//
//    <GuideButton guide={guide} style={{ top: 0, right: -88 }} tipSide="right" />
//    ...
//    <GuideOverlay guide={guide} />
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";

// ─── Animácie (raz injektnúť globálne CSS pri prvom použití hooka) ──────────
let _stylesInjected = false;
function injectGuideStyles() {
  if (_stylesInjected || typeof document === "undefined") return;
  _stylesInjected = true;
  const s = document.createElement("style");
  s.setAttribute("data-spotlight-guide", "");
  s.textContent = `
@keyframes spotlightGuidePulse {
  0%,100% { box-shadow: 0 0 0 9999px rgba(0,0,0,.55), 0 0 0 2px rgba(250,204,21,.55), 0 0 24px rgba(250,204,21,.35); }
  50%     { box-shadow: 0 0 0 9999px rgba(0,0,0,.60), 0 0 0 2px rgba(250,204,21,.85), 0 0 36px rgba(250,204,21,.55); }
}
@keyframes spotlightGuideFadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
@keyframes spotlightGuideBtnGlow {
  0%,100% { box-shadow: 0 0 0 0 rgba(250,204,21,0); }
  50%     { box-shadow: 0 0 0 4px rgba(250,204,21,.22), 0 0 14px rgba(250,204,21,.35); }
}`;
  document.head.appendChild(s);
}

// ─── Obsah krokov  (bold = účel, text = detail) ─────────────────────────────
export const GUIDE_STEPS = {
  intro: [
    { id: "tut-manual-btn", pos: "bottom",
      bold: "Detailný tutoriál.",
      text: "Otvorí kompletnú interaktívnu príručku so všetkými úrovňami špirálovej dynamiky a vysvetleniami konceptov. Užitočné, ak Spiral Dynamics ešte nepoznáte." },
    { id: "tut-textarea", pos: "top",
      bold: "Sem zadajte tému.",
      text: "Otázku, problém alebo situáciu, ktorú chcete preskúmať. Nie je to bežný chat — je to vstupný bod do viacúrovňovej analýzy." },
    { id: "tut-explore-btn", pos: "top",
      bold: "Kliknutím spustíte analýzu.",
      text: "Otvorí sa interaktívna mandala, na ktorej môžete zvoliť konkrétne úrovne pre váš pohľad." },
  ],
  tools: [
    { id: "tut-view-toggle", pos: "bottom",
      bold: "Prepínač zobrazenia.",
      text: "Mandala ako sústredné prstence, alebo Ikony ako prehľadný zoznam. Obsah je rovnaký — vyberte si, čo vám vyhovuje." },
    { id: "tut-map-active", pos: "bottom",
      bold: "Kliknite na ktorúkoľvek vrstvu.",
      text: "Označíte úroveň pre analýzu. Vrstiev môžete označiť viac naraz." },
    { id: "tut-mode-toggle", pos: "bottom",
      bold: "Jednotlivá úroveň alebo integrovaný pohľad.",
      text: "Integrovaný otvorí zvolenú vrstvu so všetkými vnútornými — úrovne sú kumulatívne a nedajú sa preskakovať." },
    { id: "tut-run-analysis", pos: "bottom",
      bold: "Spustiť analýzu.",
      text: "Keď máte vrstvy označené, týmto otvoríte všetky zvolené perspektívy naraz." },
  ],
  features: [
    { id: "tut-feat-checkbox", pos: "bottom",
      bold: "Označte perspektívu.",
      text: "Zaškrtnutím vyberiete odpoveď. Pri dvoch a viac sa odomknú integrácia a porovnanie napätí." },
    { id: "tut-feat-actions", pos: "top",
      bold: "Prehĺbte perspektívu.",
      text: "Rozvinúť, ukázať ako vznikla z predchádzajúcej úrovne, alebo kam smeruje v dôsledkoch." },
    { id: "tut-feat-axis", pos: "top",
      bold: "Os úrovne.",
      text: "Individualistická (express-self) alebo kolektívna (deny-self). Špirála sa medzi pólmi prirodzene strieda." },
    { id: "tut-feat-integrate", pos: "top",
      bold: "Integrovať do žltej.",
      text: "Vybrané perspektívy sa prenesú do integratívneho dialógu ako kontext." },
    { id: "tut-feat-conflict", pos: "top",
      bold: "Napätia medzi perspektívami.",
      text: "Ukáže, kde sa logiky úrovní stretávajú a kde si odporujú — bez hodnotenia." },
    { id: "tut-feat-integrative", pos: "top",
      bold: "Integratívny dialóg (žltá).",
      text: "Žltá nehodnotí — prepája perspektívy a hľadá mosty pre vašu situáciu." },
    { id: "tut-feat-export", pos: "top",
      bold: "Exportovať konverzáciu.",
      text: "Dokument so všetkými perspektívami — pripravený na tlač alebo PDF." },
    { id: "tut-feat-newtopic", pos: "top",
      bold: "Nová téma.",
      text: "Vyčistí všetko a vráti vás na začiatok pre novú tému." },
  ],
};

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useSpotlightGuide(phase) {
  const [seen, setSeen] = useState({ intro: false, tools: false, features: false });
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);
  const steps = GUIDE_STEPS[phase] || [];

  useEffect(() => { injectGuideStyles(); }, []);

  const findStep = useCallback((from, dir) => {
    let i = from;
    while (i >= 1 && i <= steps.length) {
      if (document.getElementById(steps[i - 1].id)) return i;
      i += dir;
    }
    return 0;
  }, [steps]);

  useEffect(() => { setStep(0); }, [phase]);

  useEffect(() => {
    if (step > 0 && step <= steps.length) {
      const s = steps[step - 1];
      const el = document.getElementById(s.id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        const t = setTimeout(() => {
          const r = el.getBoundingClientRect();
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        }, 350);
        return () => clearTimeout(t);
      }
    }
    setRect(null);
  }, [step, steps]);

  // keep highlight locked to element while user scrolls
  useEffect(() => {
    if (step <= 0 || step > steps.length) return;
    const id = steps[step - 1].id;
    const update = () => {
      const el = document.getElementById(id);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      }
    };
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [step, steps]);

  const glow = !seen[phase] && step === 0;
  const showIntroTip = glow && phase === "intro";

  // klik kamkoľvek mimo zhasne žiarenie
  useEffect(() => {
    if (!glow) return;
    const off = () => setSeen(p => ({ ...p, [phase]: true }));
    const t = setTimeout(() => window.addEventListener("click", off, { once: true }), 80);
    return () => { clearTimeout(t); window.removeEventListener("click", off); };
  }, [glow, phase]);

  return {
    glow, showIntroTip, step, rect, steps,
    activeStep: step > 0 ? steps[step - 1] : null,
    start: () => { setSeen(p => ({ ...p, [phase]: true })); setStep(findStep(1, +1)); },
    next:  () => setStep(prev => findStep(prev + 1, +1)),
    skip:  () => setStep(0),
  };
}

function guideHasNext(steps, step) {
  for (let i = step + 1; i <= steps.length; i++) {
    if (document.getElementById(steps[i - 1].id)) return true;
  }
  return false;
}

// ─── Overlay (raz na konci App-u) ────────────────────────────────────────────
export function GuideOverlay({ guide }) {
  const { step, rect, steps, activeStep, next, skip } = guide;
  if (step <= 0 || !rect || !activeStep) return null;

  const pad = 7;
  const ttWidth = Math.min(270, window.innerWidth - 32);
  const ttLeft = Math.max(16, Math.min(rect.left + rect.width / 2 - ttWidth / 2, window.innerWidth - ttWidth - 16));
  const isBelow = activeStep.pos === "bottom";
  const hasNext = guideHasNext(steps, step);

  return (
    <>
      <div onClick={skip}
        style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,.38)" }} />
      <div style={{ position: "fixed", top: rect.top - pad, left: rect.left - pad,
        width: rect.width + pad * 2, height: rect.height + pad * 2, zIndex: 9999, borderRadius: 14,
        animation: "spotlightGuidePulse 2s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "fixed", zIndex: 10000, left: ttLeft, width: ttWidth, padding: "14px 18px",
        background: "rgba(8,8,16,.98)", border: "1px solid rgba(250,204,21,.45)", borderRadius: 14,
        backdropFilter: "blur(20px)", boxShadow: "0 16px 48px rgba(0,0,0,.75)",
        animation: "spotlightGuideFadeIn .35s ease-out",
        ...(isBelow ? { top: Math.min(rect.top + rect.height + pad + 20, window.innerHeight - 210) }
                    : { top: Math.max(10, rect.top - 215) }) }}>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, lineHeight: 1.7, marginBottom: 14 }}>
          <span style={{ fontWeight: 600, color: "rgba(250,204,21,.95)" }}>{activeStep.bold} </span>
          <span style={{ fontWeight: 300, color: "rgba(240,240,240,.85)" }}>{activeStep.text}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "rgba(250,204,21,.5)", letterSpacing: 1 }}>
            {step} / {steps.length}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={skip} style={{ padding: "6px 14px", background: "none", border: "none",
              color: "rgba(255,255,255,.4)", fontFamily: "'DM Sans',sans-serif", fontSize: 11, cursor: "pointer" }}>
              Preskočiť
            </button>
            <button onClick={next} style={{ padding: "6px 20px", background: "rgba(250,204,21,.15)",
              border: "1px solid rgba(250,204,21,.35)", borderRadius: 8, color: "#FACC15",
              fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 500, letterSpacing: 1,
              textTransform: "uppercase", cursor: "pointer" }}>
              {hasNext ? "Ďalej" : "Hotovo"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Tlačidlo sprievodcu (pridáva sa POPRI existujúcom TUTORIAL tlačidle) ────
export function GuideButton({ guide, style, tipSide = "left" }) {
  return (
    <div style={{ position: "absolute", ...style }}>
      <button
        onClick={guide.start}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          background: guide.glow ? "rgba(250,204,21,0.14)" : "rgba(255,255,255,0.04)",
          border: "1px solid " + (guide.glow ? "rgba(250,204,21,0.5)" : "rgba(255,255,255,0.1)"),
          borderRadius: 4, padding: "5px 10px",
          color: guide.glow ? "#FACC15" : "rgba(255,255,255,0.35)",
          fontFamily: "'DM Sans',sans-serif", fontSize: 9, letterSpacing: "0.12em",
          textTransform: "uppercase", cursor: "pointer", transition: "all 0.2s",
          animation: guide.glow ? "spotlightGuideBtnGlow 1.8s ease-in-out infinite" : "none",
        }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        Sprievodca
      </button>

      {guide.showIntroTip && (
        <div style={{
          position: "absolute", top: 38,
          [tipSide === "right" ? "right" : "left"]: 0,
          width: 240, zIndex: 10000,
          padding: "12px 16px", background: "rgba(10,10,18,.96)",
          border: "1px solid rgba(250,204,21,.3)", borderRadius: 12,
          backdropFilter: "blur(16px)", animation: "spotlightGuideFadeIn .35s ease-out",
          pointerEvents: "none",
        }}>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, lineHeight: 1.6 }}>
            <span style={{ fontWeight: 600, color: "rgba(250,204,21,.95)" }}>Sprievodca aplikáciou. </span>
            <span style={{ fontWeight: 300, color: "rgba(240,240,240,.85)" }}>
              Kliknutím vás krok po kroku prevediem funkciami.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
