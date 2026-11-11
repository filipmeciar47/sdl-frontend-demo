/* safe-patch.js — pojistky pre archivované migračné skripty.
 *
 * Pôvodné skripty (revert_en.js, revert_en2.js) mali tri chyby, ktoré spolu
 * dokázali ticho poškodiť súbor:
 *
 *   1. Cesty boli RELATÍVNE ('backend/api/chat.js'), takže sa vyhodnotili voči
 *      aktuálnemu priečinku. Spustenie z iného repa zasiahlo iné súbory.
 *   2. Použili .replace(), ktorý nahradí LEN PRVÝ výskyt. Druhý zostal.
 *   3. Pri nenájdenej náhrade ("MISS") len vypísali hlášku, pokračovali a súbor
 *      NAKONIEC AJ TAK ZAPÍSALI — uložil sa teda polovičný výsledok.
 *
 * Tento modul to obracia:
 *
 *   - `--repo=<cesta>` je POVINNÝ a musí ukazovať na git repozitár
 *   - všetky cesty sa vyhodnocujú voči nemu, nikdy voči aktuálnemu priečinku,
 *     a nesmú z neho vyliezť
 *   - predvolene je to NÁHĽAD; zapisuje sa len s `--write`
 *   - nahrádza sa KAŽDÝ výskyt (split/join), nie prvý
 *   - zmeny sa držia v pamäti a zapíšu sa až na konci NARAZ
 *   - jediný MISS znamená, že sa NEZAPÍŠE NIČ
 *   - súbor s necommitnutými zmenami sa odmietne prepísať (`--allow-dirty` zruší)
 *
 * Dôsledok, s ktorým treba počítať: produkčné súbory sú už preložené, takže
 * tieto skripty od teraz budú spoľahlivo odmietať zápis. To je zámer — ich
 * úloha sa mení z migračného nástroja na OVEROVACÍ. Náhľad vypíše, ktoré
 * reťazce sú ešte v pôvodnom jazyku.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function parseArgs(argv) {
  const out = { repo: null, write: false, allowDirty: false, exportPairs: null, quiet: false };
  for (const a of argv) {
    if (a.startsWith('--repo=')) out.repo = a.slice(7);
    else if (a === '--write') out.write = true;
    else if (a === '--allow-dirty') out.allowDirty = true;
    else if (a.startsWith('--export-pairs=')) out.exportPairs = a.slice(15);
    else if (a === '--quiet') out.quiet = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else out.unknown = (out.unknown || []).concat(a);
  }
  return out;
}

function usage(name) {
  return [
    '',
    'Použitie:',
    '  node tools/archive/' + name + '.js --repo=<cesta k repu> [--write] [--allow-dirty]',
    '  node tools/archive/' + name + '.js --repo=<cesta> --export-pairs=<subor.json>',
    '',
    '  --repo=<cesta>          POVINNÉ. Koreň git repozitára, v ktorom sa má pracovať.',
    '  --write                 Skutočne zapísať. Bez tohto je to len náhľad.',
    '  --allow-dirty           Dovoliť zápis aj do súborov s necommitnutými zmenami.',
    '  --export-pairs=<subor>  Nič nepatchovať, len vypísať páry do JSON.',
    '  --quiet                 Nevypisovať jednotlivé náhrady, len súhrn.',
    '',
  ].join('\n');
}

function isGitRepo(dir) {
  try {
    const p = path.join(dir, '.git');
    return fs.existsSync(p); // priečinok aj súbor (worktree) sú v poriadku
  } catch (e) {
    return false;
  }
}

function gitDirty(repo, rel) {
  try {
    const out = execFileSync('git', ['status', '--porcelain', '--', rel], {
      cwd: repo, encoding: 'utf8',
    });
    return out.trim().length > 0;
  } catch (e) {
    return false; // git sa nedá spustiť → nebudeme kvôli tomu blokovať
  }
}

function patcher(meta) {
  const name = (meta && meta.name) || 'skript';
  const purpose = (meta && meta.purpose) || '';
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(name + (purpose ? ' — ' + purpose : ''));
    console.log(usage(name));
    process.exit(0);
  }

  console.log('');
  console.log('── ' + name + ' ' + '─'.repeat(Math.max(0, 60 - name.length)));
  if (purpose) console.log(purpose);
  console.log('');

  if (args.unknown) {
    console.error('Neznámy prepínač: ' + args.unknown.join(', '));
    console.error(usage(name));
    process.exit(2);
  }
  if (!args.repo) {
    console.error('CHYBA: chýba --repo=<cesta>.');
    console.error('Bez nej by sa relatívne cesty vyhodnotili voči aktuálnemu');
    console.error('priečinku a skript by mohol zasiahnuť iné repo. Preto je povinná.');
    console.error(usage(name));
    process.exit(2);
  }

  const repo = path.resolve(args.repo);
  if (!fs.existsSync(repo) || !fs.statSync(repo).isDirectory()) {
    console.error('CHYBA: --repo neukazuje na existujúci priečinok: ' + repo);
    process.exit(2);
  }
  if (!isGitRepo(repo)) {
    console.error('CHYBA: v ' + repo + ' nie je git repozitár (chýba .git).');
    console.error('Skript zapisuje do zdrojových súborov, takže bez gitu by sa');
    console.error('zmeny nedali vrátiť. Preto to odmieta.');
    process.exit(2);
  }

  console.log('repo:   ' + repo);
  console.log('režim:  ' + (args.exportPairs ? 'export párov' : args.write ? 'ZÁPIS' : 'náhľad (bez zápisu)'));
  console.log('');

  const files = new Map(); // rel -> { rel, abs, nl, original, content, ops: [] }
  const problems = [];
  const exported = [];

  function file(rel) {
    if (files.has(rel)) return files.get(rel).handle;

    const abs = path.resolve(repo, rel);
    const relCheck = path.relative(repo, abs);
    if (relCheck.startsWith('..') || path.isAbsolute(relCheck)) {
      problems.push('cesta vylieza z repa: ' + rel);
      const dead = deadHandle(rel);
      files.set(rel, { rel, dead: true, handle: dead });
      return dead;
    }
    if (!fs.existsSync(abs)) {
      problems.push('súbor neexistuje: ' + rel);
      const dead = deadHandle(rel);
      files.set(rel, { rel, dead: true, handle: dead });
      return dead;
    }
    if (!args.exportPairs && !args.allowDirty && gitDirty(repo, rel)) {
      problems.push('súbor má necommitnuté zmeny: ' + rel + '  (--allow-dirty ich prepíše)');
    }

    const original = fs.readFileSync(abs, 'utf8');
    const entry = {
      rel, abs, original, content: original,
      nl: original.includes('\r\n') ? '\r\n' : '\n',
      hits: 0, misses: 0,
    };

    const handle = {
      get nl() { return entry.nl; },

      // Nahradí KAŽDÝ výskyt. Nula výskytov = MISS, ktorý zablokuje zápis.
      rep(from, to, label) {
        if (args.exportPairs) { exported.push({ file: rel, from, to, label: label || null }); return handle; }
        const n = countOccurrences(entry.content, from);
        if (n === 0) {
          entry.misses++;
          if (!args.quiet) console.log('  MISS  ' + (label || preview(from)));
          return handle;
        }
        entry.content = entry.content.split(from).join(to);
        entry.hits++;
        if (!args.quiet) console.log('  ok    ' + (label || preview(from)) + (n > 1 ? '  (' + n + '×)' : ''));
        return handle;
      },

      many(pairs) {
        for (const pair of pairs) handle.rep(pair[0], pair[1], pair[2]);
        return handle;
      },

      // Regexová varianta pre vzory, ktoré musia tolerovať konce riadkov.
      // Vždy sa aplikuje globálne — pôvodné skripty tu mali tú istú chybu
      // s prvým výskytom.
      regex(re, replacement, label) {
        if (args.exportPairs) { exported.push({ file: rel, regex: String(re), to: replacement, label: label || null }); return handle; }
        const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
        const g = new RegExp(re.source, flags);
        const m = entry.content.match(g);
        if (!m || m.length === 0) {
          entry.misses++;
          if (!args.quiet) console.log('  MISS  ' + (label || String(re)));
          return handle;
        }
        entry.content = entry.content.replace(g, replacement);
        entry.hits++;
        if (!args.quiet) console.log('  ok    ' + (label || String(re)) + (m.length > 1 ? '  (' + m.length + '×)' : ''));
        return handle;
      },
    };

    entry.handle = handle;
    files.set(rel, entry);
    if (!args.quiet) console.log(rel + ':');
    return handle;
  }

  function finish() {
    const live = [...files.values()].filter((f) => !f.dead);
    const totalHits = live.reduce((a, f) => a + f.hits, 0);
    const totalMisses = live.reduce((a, f) => a + f.misses, 0);
    const changed = live.filter((f) => f.content !== f.original);

    console.log('');
    console.log('── súhrn ' + '─'.repeat(54));

    if (args.exportPairs) {
      const out = path.resolve(args.exportPairs);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, JSON.stringify(exported, null, 2) + '\n', 'utf8');
      console.log('vyexportovaných párov: ' + exported.length);
      console.log('do: ' + out);
      process.exit(0);
    }

    console.log('nahradené: ' + totalHits + '    nenájdené (MISS): ' + totalMisses);
    for (const f of changed) {
      console.log('  zmenilo by sa: ' + f.rel + '  (' + f.original.length + ' → ' + f.content.length + ' znakov)');
    }

    if (problems.length) {
      console.log('');
      console.log('PREKÁŽKY:');
      for (const p of problems) console.log('  - ' + p);
    }

    if (totalMisses > 0 || problems.length) {
      console.log('');
      console.log('NEZAPÍSALO SA NIČ.');
      if (totalMisses > 0) {
        console.log('Dôvod: ' + totalMisses + ' náhrad sa nenašlo. Pôvodná verzia by v takom');
        console.log('prípade súbor aj tak zapísala a uložila polovičný výsledok — práve to');
        console.log('tu nechceme. Buď je to už aplikované, alebo sa zdrojový kód medzitým');
        console.log('zmenil. Náhľad vyššie ukazuje, čo konkrétne sa nenašlo.');
      }
      process.exit(1);
    }

    if (!changed.length) {
      console.log('');
      console.log('Niet čo meniť — obsah by zostal rovnaký.');
      process.exit(0);
    }

    if (!args.write) {
      console.log('');
      console.log('Náhľad. Nič sa nezapísalo. Na skutočný zápis pridaj --write.');
      process.exit(0);
    }

    for (const f of changed) {
      fs.writeFileSync(f.abs, f.content, 'utf8');
      console.log('  zapísané: ' + f.rel);
    }
    console.log('');
    console.log('Hotovo — zapísaných súborov: ' + changed.length + '.');
    process.exit(0);
  }

  return { file, finish, repo, args };
}

function deadHandle(rel) {
  const noop = { get nl() { return '\n'; }, rep() { return noop; }, many() { return noop; }, regex() { return noop; } };
  return noop;
}

function countOccurrences(hay, needle) {
  if (!needle) return 0;
  return hay.split(needle).length - 1;
}

function preview(s) {
  const one = String(s).replace(/\r?\n/g, '⏎');
  return one.length > 72 ? one.slice(0, 72) + '…' : one;
}

module.exports = { patcher };
