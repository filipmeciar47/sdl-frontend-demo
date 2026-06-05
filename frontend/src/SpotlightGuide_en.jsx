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
      bold: "Detailed tutorial.",
      text: "Opens the full interactive guide with all Spiral Dynamics levels and concept explanations. Useful if you're new to Spiral Dynamics." },
    { id: "tut-textarea", pos: "top",
      bold: "Enter your topic here.",
      text: "A question, problem, or situation you want to explore. This isn't a regular chat — it's the entry point into a multi-level analysis." },
    { id: "tut-explore-btn", pos: "top",
      bold: "Click to start the analysis.",
      text: "An interactive mandala will open where you can choose specific levels for your perspective." },
  ],
  tools: [
    { id: "tut-view-toggle", pos: "bottom",
      bold: "Display toggle.",
      text: "Mandala as concentric rings, or Icons as a clear list. The content is the same — choose what works for you." },
    { id: "tut-map-active", pos: "bottom",
      bold: "Click any layer.",
      text: "You mark a level for analysis. You can mark multiple layers at once." },
    { id: "tut-mode-toggle", pos: "bottom",
      bold: "Single level or integrated view.",
      text: "Integrated opens the chosen layer together with all inner ones — levels are cumulative and cannot be skipped." },
    { id: "tut-run-analysis", pos: "bottom",
      bold: "Run analysis.",
      text: "Once you have layers selected, this opens all chosen perspectives at once." },
  ],
  features: [
    { id: "tut-feat-checkbox", pos: "bottom",
      bold: "Select a perspective.",
      text: "Tick to choose a response. With two or more, integration and tension comparison unlock." },
    { id: "tut-feat-actions", pos: "top",
      bold: "Go deeper into the perspective.",
      text: "Expand it, show how it emerged from the previous level, or where it leads in its consequences." },
    { id: "tut-feat-axis", pos: "top",
      bold: "Level axis.",
      text: "Individualistic (express-self) or collective (other-oriented). The spiral naturally alternates between the two poles." },
    { id: "tut-feat-integrate", pos: "top",
      bold: "Integrate into Yellow.",
      text: "Selected perspectives are carried into the integrative dialogue as context." },
    { id: "tut-feat-conflict", pos: "top",
      bold: "Tensions between perspectives.",
      text: "Shows where the logics of the levels meet and where they contradict each other — without judgment." },
    { id: "tut-feat-integrative", pos: "top",
      bold: "Integrative dialogue (Yellow).",
      text: "Yellow does not judge — it connects perspectives and looks for bridges for your situation." },
    { id: "tut-feat-export", pos: "top",
      bold: "Export the conversation.",
      text: "A document with all perspectives — ready to print or save as PDF." },
    { id: "tut-feat-newtopic", pos: "top",
      bold: "New topic.",
      text: "Clears everything and returns you to the start for a new topic." },
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
  const showIntroTip = glow && phase !== "features";

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

  const pad = 10;
  const ttWidth = 340;
  const ttLeft = Math.max(16, Math.min(rect.left + rect.width / 2 - ttWidth / 2, window.innerWidth - ttWidth - 16));
  const isBelow = activeStep.pos === "bottom";
  const hasNext = guideHasNext(steps, step);

  return (
    <>
      <div onClick={skip}
        style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,.25)" }} />
      <div style={{ position: "fixed", top: rect.top - pad, left: rect.left - pad,
        width: rect.width + pad * 2, height: rect.height + pad * 2, zIndex: 9999, borderRadius: 14,
        animation: "spotlightGuidePulse 2s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "fixed", zIndex: 10000, left: ttLeft, width: ttWidth, padding: "18px 22px",
        background: "rgba(10,10,18,.96)", border: "1px solid rgba(250,204,21,.3)", borderRadius: 14,
        backdropFilter: "blur(16px)", animation: "spotlightGuideFadeIn .35s ease-out",
        ...(isBelow ? { top: Math.min(rect.top + rect.height + 20, window.innerHeight - 200) }
                    : { top: Math.max(10, rect.top - 180) }) }}>
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
              Skip
            </button>
            <button onClick={next} style={{ padding: "6px 20px", background: "rgba(250,204,21,.15)",
              border: "1px solid rgba(250,204,21,.35)", borderRadius: 8, color: "#FACC15",
              fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 500, letterSpacing: 1,
              textTransform: "uppercase", cursor: "pointer" }}>
              {hasNext ? "Next" : "Done"}
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
        Guide
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
            <span style={{ fontWeight: 600, color: "rgba(250,204,21,.95)" }}>Application guide. </span>
            <span style={{ fontWeight: 300, color: "rgba(240,240,240,.85)" }}>
              Click and I'll walk you through the features step by step.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
