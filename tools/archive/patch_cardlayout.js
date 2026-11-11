/* patch_cardlayout.js — ARCHIVOVANÉ. Jednorazový nástroj z 10/2026.
 *
 * Toto NIE JE prekladový skript. Pridával do dema voľbu rozloženia kariet
 * (karusel vs zoznam) a k nej panel nastavení — teda funkciu, nie preklad.
 * Preto jeho vzory nie sú v tools/i18n/: nesú štruktúru kódu, nie reťazce UI.
 *
 * Vzory sa skladajú dynamicky cez ${nl}, aby zniesli CRLF aj LF. Konec riadku
 * sa zisťuje zo súboru, nie háda.
 *
 * Pôvodná verzia mala tie isté tri chyby ako revert_en*: relatívnu cestu voči
 * aktuálnemu priečinku, .replace() len na prvý výskyt, a pri nenájdenej
 * náhrade pokračovala a súbor nakoniec aj tak zapísala. Pojistky sú opísané
 * v safe-patch.js a v README.md vedľa.
 *
 * Keďže je zmena už aplikovaná, skript dnes zápis odmietne. Náhľad poslúži
 * na overenie, či v kóde ešte stoja miesta, ktoré očakával.
 *
 *   node tools/archive/patch_cardlayout.js --repo=.            (náhľad)
 *   node tools/archive/patch_cardlayout.js --repo=. --write     (zápis)
 */

'use strict';

const { patcher } = require('./safe-patch');

const p = patcher({
  name: 'patch_cardlayout',
  purpose: 'Rozloženie kariet karusel/zoznam + panel nastavení (archivované).',
});

const app = p.file('frontend/src/App.jsx');
const nl = app.nl; // zistené zo súboru

// 1. Add states
app.rep(
  `  const [activeCardIdx, setActiveCardIdx] = useState(0);`,
  `  const [activeCardIdx, setActiveCardIdx] = useState(0);${nl}  const [cardLayout, setCardLayout] = useState("carousel");${nl}  const [settingsOpen, setSettingsOpen] = useState(false);`,
  'states'
);

// 2. isActive — make layout-aware
app.rep(
  `                    const isActive = offset === 0;`,
  `                    const isActive = cardLayout === "list" ? true : offset === 0;`,
  'isActive'
);

// 3. Wrap transform logic in cardLayout guard
app.rep(
  `                    let transform, zIdx, opacity, flt;${nl}                    if (offset === 0) { transform = "translateX(0) scale(1) rotateY(0deg)"; zIdx = 3; opacity = 1; flt = "none"; }${nl}                    else if (offset === -1) { transform = "translateX(-60%) scale(0.74) rotateY(22deg)"; zIdx = 2; opacity = 0.82; flt = "none"; }${nl}                    else if (offset === 1) { transform = "translateX(60%) scale(0.74) rotateY(-22deg)"; zIdx = 2; opacity = 0.82; flt = "none"; }${nl}                    else if (offset < -1) { transform = "translateX(-88%) scale(0.48) rotateY(38deg)"; zIdx = 1; opacity = 0; flt = "blur(2px)"; }${nl}                    else { transform = "translateX(88%) scale(0.48) rotateY(-38deg)"; zIdx = 1; opacity = 0; flt = "blur(2px)"; }`,
  `                    let transform, zIdx, opacity, flt;${nl}                    if (cardLayout === "carousel") {${nl}                      if (offset === 0) { transform = "translateX(0) scale(1) rotateY(0deg)"; zIdx = 3; opacity = 1; flt = "none"; }${nl}                      else if (offset === -1) { transform = "translateX(-60%) scale(0.74) rotateY(22deg)"; zIdx = 2; opacity = 0.82; flt = "none"; }${nl}                      else if (offset === 1) { transform = "translateX(60%) scale(0.74) rotateY(-22deg)"; zIdx = 2; opacity = 0.82; flt = "none"; }${nl}                      else if (offset < -1) { transform = "translateX(-88%) scale(0.48) rotateY(38deg)"; zIdx = 1; opacity = 0; flt = "blur(2px)"; }${nl}                      else { transform = "translateX(88%) scale(0.48) rotateY(-38deg)"; zIdx = 1; opacity = 0; flt = "blur(2px)"; }${nl}                    }`,
  'transform block'
);

// 4. crsl-wrap → conditional wrapper
app.rep(
  `                <div className="crsl-wrap">`,
  `                <div className={cardLayout === "carousel" ? "crsl-wrap" : undefined} style={cardLayout === "list" ? { display: "flex", flexDirection: "column", gap: 20 } : undefined}>`,
  'crsl-wrap div'
);

// 5. Card outer div → conditional (carousel vs list)
app.rep(
  `                      <div key={key} className={"crsl-card" + (!isActive ? " is-side" : "")} onClick={!isActive ? () => setActiveCardIdx(idx) : undefined} style={{ transform, zIndex: zIdx, opacity, filter: flt, pointerEvents: Math.abs(offset) > 1 ? "none" : "auto" }}>`,
  `                      <div key={key} className={cardLayout === "carousel" ? ("crsl-card" + (!isActive ? " is-side" : "")) : undefined} onClick={cardLayout === "carousel" && !isActive ? () => setActiveCardIdx(idx) : undefined} style={cardLayout === "carousel" ? { transform, zIndex: zIdx, opacity, filter: flt, pointerEvents: Math.abs(offset) > 1 ? "none" : "auto" } : { position: "relative" }}>`,
  'card outer div'
);

// 6. crsl-nav → only in carousel mode
app.rep(
  `                {openChatKeys.length > 1 && (${nl}                  <div className="crsl-nav">`,
  `                {cardLayout === "carousel" && openChatKeys.length > 1 && (${nl}                  <div className="crsl-nav">`,
  'crsl-nav condition'
);

// 7. Settings panel — insert after the "New topic + Export" buttons div closes, before </>
const settingsPanel = [
  `            <div style={{ marginTop: 18, borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 14 }}>`,
  `              <button onClick={() => setSettingsOpen(p => !p)} style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 auto", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,.28)", fontFamily: "'DM Sans',sans-serif", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", padding: "4px 8px", transition: "color .2s" }}`,
  `                onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,.65)"}`,
  `                onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,.28)"}>`,
  `                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>`,
  `                {_lang === "en" ? "Settings" : "Nastavenia"} {settingsOpen ? "▲" : "▼"}`,
  `              </button>`,
  `              {settingsOpen && (`,
  `                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>`,
  `                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>`,
  `                    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "rgba(255,255,255,.35)", letterSpacing: ".8px", textTransform: "uppercase" }}>{_lang === "en" ? "Card layout:" : "Rozloženie kariet:"}</span>`,
  `                    <div style={{ display: "inline-flex", borderRadius: 5, border: "1px solid rgba(255,255,255,.1)", overflow: "hidden" }}>`,
  `                      {[["carousel", _lang === "en" ? "Carousel" : "Karusel"], ["list", _lang === "en" ? "List" : "Zoznam"]].map(([val, label]) => {`,
  `                        const active = cardLayout === val;`,
  `                        return (`,
  `                          <button key={val} onClick={() => setCardLayout(val)}`,
  `                            style={{ padding: "4px 12px", background: active ? "rgba(255,255,255,.1)" : "none", border: "none", borderRight: val === "carousel" ? "1px solid rgba(255,255,255,.1)" : "none", color: active ? "rgba(255,255,255,.75)" : "rgba(255,255,255,.25)", fontFamily: "'DM Sans',sans-serif", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", cursor: active ? "default" : "pointer", transition: "all .2s", fontWeight: active ? 600 : 400 }}>`,
  `                            {label}`,
  `                          </button>`,
  `                        );`,
  `                      })}`,
  `                    </div>`,
  `                  </div>`,
  `                </div>`,
  `              )}`,
  `            </div>`,
].join(nl);

app.rep(
  `              )}${nl}            </div>${nl}          </>`,
  `              )}${nl}            </div>${nl}${settingsPanel}${nl}          </>`,
  'settings panel insertion'
);

p.finish();
