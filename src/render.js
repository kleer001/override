// Compose the whole 80x40 screen. Central region is contextual:
//   assemble / draft -> card panels · target -> the machine (pick a sector) ·
//   exec / result    -> the sector burning.

import { FIELD_W, FIELD_H, WALL, VAULT, idx, SECTORS, heatToClear } from './terrain.js';
import { LOCKDOWN, CODE_DIGITS, crackPct, heatOf } from './battle.js';
import { evalProgram } from './cards.js';
import { COLS, ROWS, FIELD_TOP, HAND_CARDS, DRAFT_CARDS, BTN_UNDO, BTN_EXEC, BTN_CONTINUE } from './layout.js';

export { COLS, ROWS };

const TERRAIN_G = [' ', '▒', '▓', '═', '$', '"']; // OPEN HARD WALL BUS VAULT HONEY

function blank() { return Array.from({ length: ROWS }, () => new Array(COLS).fill(' ')); }
function stamp(g, x, y, s) { if (y < 0 || y >= ROWS) return; for (let i = 0; i < s.length; i++) if (x + i >= 0 && x + i < COLS) g[y][x + i] = s[i]; }
function center(g, y, s) { stamp(g, Math.max(0, Math.floor((COLS - s.length) / 2)), y, s); }
function bar(pct, w) { const f = Math.round((pct / 100) * w); return '[' + '#'.repeat(f) + '.'.repeat(w - f) + ']'; }

function wrap(text, w) {
  const out = []; let cur = '';
  for (const word of text.split(' ')) {
    if ((cur + ' ' + word).trim().length > w) { out.push(cur.trim()); cur = word; }
    else cur = (cur + ' ' + word).trim();
  }
  if (cur) out.push(cur.trim());
  return out;
}

function drawCard(g, x, y, key, card, spent) {
  const w = 15, h = 8;
  stamp(g, x, y, '┌' + `[${key}]` + '─'.repeat(w - 2 - (key.length + 2)) + '┐');
  for (let r = 1; r < h - 1; r++) stamp(g, x, y + r, '│' + ' '.repeat(w - 2) + '│');
  stamp(g, x, y + h - 1, '└' + '─'.repeat(w - 2) + '┘');
  if (spent) { stamp(g, x + 2, y + 3, 'SPENT'); return; }
  stamp(g, x + 2, y + 1, card.name.slice(0, w - 3));
  wrap(card.desc, w - 4).slice(0, 3).forEach((ln, i) => stamp(g, x + 2, y + 3 + i, ln));
  stamp(g, x + 2, y + h - 2, card.kind.toUpperCase());
}

function drawButton(g, r, dim) {
  stamp(g, r.x, r.y, '┌' + '─'.repeat(r.w - 2) + '┐');
  stamp(g, r.x, r.y + 1, '│' + ' '.repeat(r.w - 2) + '│');
  stamp(g, r.x, r.y + 2, '└' + '─'.repeat(r.w - 2) + '┘');
  const t = dim ? r.label.replace('▶', '·') : r.label;
  stamp(g, r.x + Math.max(1, Math.floor((r.w - t.length) / 2)), r.y + 1, t);
}

function accPreview(program) {
  const loaded = program.filter(Boolean);
  if (!loaded.length) return { expr: '(load cards to preview)', value: 0 };
  const tok = loaded.map((c) => c.kind === 'add' ? `+${c.value}` : c.kind === 'mult' ? `x${c.value}`
    : c.kind === 'nop' ? '(nop)' : c.kind === 'goto' ? '(goto)' : c.kind === 'fork' ? '(fork)' : '(int)');
  return { expr: '0 ' + tok.join(' '), value: evalProgram(loaded).value };
}

function drawAssemble(g, game) {
  center(g, 3, 'ASSEMBLE INTRUSION');
  center(g, 4, 'instructions run left→right on a CPU accumulator — adds early, x late');
  game.hand.forEach((h, i) => drawCard(g, HAND_CARDS[i].x, HAND_CARDS[i].y, String(i + 1), h.card, h.used));
  stamp(g, 6, 17, 'PROGRAM');
  stamp(g, 16, 17, [0, 1, 2].map((i) => `[ ${(game.program[i] ? game.program[i].name : '......').padEnd(9).slice(0, 9)} ]`).join(' → '));
  const p = accPreview(game.program);
  stamp(g, 6, 19, 'ACCUMULATOR');
  stamp(g, 18, 19, `${p.expr}   =  ${p.value}   (heat ${p.value ? heatOf({ value: p.value, flags: {} }) : '–'})`);
  center(g, 22, 'tap a card to load · then choose which sector to hit');
  drawButton(g, BTN_UNDO, false);
  drawButton(g, BTN_EXEC, game.selection.length < 3);
}

function drawDraft(g, game) {
  center(g, 3, 'DRAFT — bank an instruction into your deck');
  game.draft.forEach((c, i) => drawCard(g, DRAFT_CARDS[i].x, DRAFT_CARDS[i].y, String(i + 1), c, false));
  center(g, 19, 'tap a card to keep it');
}

function frontier(machine, x, y) {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || nx >= FIELD_W || ny < 0 || ny >= FIELD_H) continue;
    const n = idx(nx, ny);
    if (!machine.burned[n] && machine.t[n] !== WALL) return true;
  }
  return false;
}

function drawMachineBoard(g, machine) {
  for (let y = 0; y < FIELD_H; y++) for (let x = 0; x < FIELD_W; x++) {
    const c = idx(x, y);
    let ch;
    if (machine.burned[c]) ch = machine.t[c] === VAULT ? '$' : frontier(machine, x, y) ? '@' : '#';
    else ch = TERRAIN_G[machine.t[c]];
    g[FIELD_TOP + y][x] = ch;
  }
}

function drawTarget(g, game) {
  const { machine } = game.run;
  drawMachineBoard(g, machine);
  const heat = heatOf(evalProgram(game.program));
  machine.sectors.forEach((s) => {
    const label = s.conquered ? `${s.id} ·OWNED·` : `${s.id} ${s.difficulty} h≥${heatToClear(machine, s)}`;
    stamp(g, s.x0 + 1, FIELD_TOP, label.slice(0, s.x1 - s.x0));
  });
  center(g, 38, `YOUR HEAT ${heat}  —  tap an un-owned sector to assault  (higher heat burns hotter & faster)`);
}

function drawBurning(g, game) {
  const node = game.node;
  drawMachineBoard(g, game.run.machine);
  game.run.machine.sectors.forEach((s) => {
    const tag = s.conquered ? `${s.id} ·OWNED·` : s === node.sector ? `${s.id} «BURNING»` : s.id;
    stamp(g, s.x0 + 1, FIELD_TOP, tag.slice(0, s.x1 - s.x0));
  });
  stamp(g, 0, 36, 'PROGRAM  ');
  stamp(g, 9, 36, [0, 1, 2].map((i) => {
    const name = (game.program[i] ? game.program[i].name : '......').padEnd(9).slice(0, 9);
    return game.phase === 'exec' && game.playhead === i ? `[>${name}<]` : `[ ${name} ]`;
  }).join(''));
  const cp = crackPct(node);
  stamp(g, 0, 37, `CRACK ${bar(cp, 34)} ${cp.toFixed(0)}%   heat ${node.heat}   ${node.sector.id}`);
  const log = node.log.slice(-2);
  stamp(g, 0, 38, (log[0] || '').slice(0, COLS));
  stamp(g, 0, 39, (log[1] || game.message || '').slice(0, COLS));
}

export function buildScreen(game) {
  const g = blank();
  const { phase, run, node } = game;

  const lockPct = node ? (node.pass / LOCKDOWN) * 100 : 0;
  stamp(g, 0, 0, `TIER ${run.tier}: THE MACHINE   CONQUERED ${run.conquered}/3   ROOT:${run.root}`);
  if (node) stamp(g, 54, 0, `LOCKDOWN${bar(lockPct, 8)} ${node.pass}/${LOCKDOWN}`);

  let code = 'CODE  ';
  for (let i = 0; i < CODE_DIGITS; i++) code += (run.locked[i] ? String(run.code[i]) : '_') + ' ';
  stamp(g, 0, 1, code);
  stamp(g, 0, 2, game.prompt || '');

  if (phase === 'assemble') drawAssemble(g, game);
  else if (phase === 'draft') drawDraft(g, game);
  else if (phase === 'target') drawTarget(g, game);
  else if (node) drawBurning(g, game);

  if (phase === 'result' || phase === 'tierclear' || phase === 'gameover') {
    drawButton(g, BTN_CONTINUE, false);
    stamp(g, 0, 39, (game.message || '').slice(0, COLS));
  }
  return g.map((r) => r.join('')).join('\n');
}
