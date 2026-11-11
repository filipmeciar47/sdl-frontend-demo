# Archív migračných skriptov

Jednorazové nástroje, ktoré už svoju prácu odviedli. Nie sú tu preto, že by sa
mali znovu spúšťať — sú tu preto, že ich pôvodná podoba dokázala ticho poškodiť
súbor, a to stojí za zaznamenanie.

| skript | čo robil | stav |
|---|---|---|
| `patch_cardlayout.js` | pridal voľbu rozloženia kariet (karusel / zoznam) a panel nastavení do `frontend/src/App.jsx` | aplikované; dnes overovacie |

Nie je to prekladový skript — mení štruktúru kódu, nie reťazce. Preto jeho
vzory nie sú v žiadnom slovníku i18n.

## Čo bolo nebezpečné

Tie isté tri chyby, aké mali `revert_en*.js` v produkčnom repe:

1. **Relatívna cesta.** `fs.readFileSync('frontend/src/App.jsx')` sa vyhodnotilo
   voči aktuálnemu priečinku. Spustenie z iného repa zasiahlo iný súbor.
2. **`.replace()` nahradí len prvý výskyt.**
3. **Pri nenájdenej náhrade („MISS") skript pokračoval a súbor nakoniec aj tak
   zapísal.**

### Čo by sa stalo pri spustení pôvodnej verzie dnes

Overené 2026-11-11 proti `main`. Zo siedmich náhrad **2 trafia a 5 minie**:

```
ok    states                      <- uz aplikovane!
MISS  isActive
MISS  transform block
MISS  crsl-wrap div
MISS  card outer div
MISS  crsl-nav condition
ok    settings panel insertion    <- uz aplikovane!
```

Tie dva „ok" sú na už aplikovanom kóde, takže by sa aplikovali **druhýkrát**:

- `states` by pridal druhú deklaráciu `const [cardLayout, setCardLayout]`
  a `const [settingsOpen, setSettingsOpen]` do toho istého scope →
  **`SyntaxError: Identifier 'cardLayout' has already been declared`**, build padá
- `settings panel insertion` by vložil celý panel nastavení znovu (+2 869 znakov)

A pôvodná verzia by to **zapísala** a vypísala `Done — ok: 2, fail: 5`.

## Čo platí teraz

Pojistky sú v [`safe-patch.js`](safe-patch.js) — ten istý modul ako v produkčnom
repe:

- **`--repo=<cesta>` je povinný** a musí ukazovať na git repozitár
- **predvolene náhľad**, zápis len s `--write`
- **nahrádza sa každý výskyt**, nie prvý
- **jediný MISS znamená, že sa nezapíše nič** a návratový kód je 1
- **súbor s necommitnutými zmenami sa odmietne prepísať** (`--allow-dirty` zruší)

Keďže je zmena aplikovaná, skript dnes zápis odmietne. Náhľad poslúži na
overenie, či v kóde ešte stoja miesta, ktoré očakával — a päť `MISS` hovorí,
že `App.jsx` sa odvtedy prepracoval.

## Spustenie

```
node tools/archive/patch_cardlayout.js --repo=.           # náhľad
node tools/archive/patch_cardlayout.js --repo=. --write    # zápis
node tools/archive/patch_cardlayout.js --help
```

Presun z koreňa repa je sám o sebe pojistka: `node patch_cardlayout.js`
spustené z koreňa už nič nenájde.
