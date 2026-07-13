// Dawn-of-computing instruction cards. Every card executes on a running
// accumulator, like a CPU — so sequence is the strategy. Adds early build the
// value; multipliers late detonate it.
//
// kind:
//   'add'     — acc += value
//   'mult'    — acc = round(acc * value)   (also raises spread / worm jump)
//   'nop'     — nothing; two in a row (a "sled") doubles the NEXT card
//   'goto'    — re-apply the previous numeric card's effect
//   'fork'    — seed a worm beachhead on another sector (flags.fork++)
//   'interrupt' — freeze ICE for this pass (flags.interrupt)
//   'draw'    — phreak the line: (reserved; hooks into hand size later)

export const CARDS = {
  BRUTE:     { id: 'BRUTE',     name: 'BRUTE +3',   kind: 'add',       value: 3,  desc: 'add 3 to the accumulator' },
  ADD5:      { id: 'ADD5',      name: 'ADD +5',     kind: 'add',       value: 5,  desc: 'add 5 to the accumulator' },
  XOR:       { id: 'XOR',       name: 'XOR x2',     kind: 'mult',      value: 2,  desc: 'multiply accum x2; wider spread' },
  SHL:       { id: 'SHL',       name: 'SHL x3',     kind: 'mult',      value: 3,  desc: 'multiply accum x3; wider spread' },
  NOP:       { id: 'NOP',       name: 'NOP',        kind: 'nop',       value: 0,  desc: 'nothing; two in a row doubles next' },
  GOTO:      { id: 'GOTO',      name: 'GOTO ^',     kind: 'goto',      value: 0,  desc: 're-run the previous card' },
  FORK:      { id: 'FORK',      name: 'FORK()',     kind: 'fork',      value: 0,  desc: 'open a 2nd front; +crack, board seed' },
  INTERRUPT: { id: 'INTERRUPT', name: 'INTERRUPT',  kind: 'interrupt', value: 0,  desc: 'freeze ICE this pass; less drain' },
  PUNCH:     { id: 'PUNCH',     name: 'PUNCHCARD',  kind: 'add',       value: 12, desc: 'add 12; a heavy payload' },
  PHREAK:    { id: 'PHREAK',    name: '2600Hz',     kind: 'nop',       value: 0,  desc: 'phreak the line (flavor)' },
};

// Tier-1 starting deck (10 cards).
export function startingDeck() {
  return [
    CARDS.BRUTE, CARDS.BRUTE, CARDS.BRUTE, CARDS.BRUTE,
    CARDS.XOR, CARDS.XOR,
    CARDS.NOP, CARDS.NOP,
    CARDS.FORK,
    CARDS.INTERRUPT,
  ].map((c) => ({ ...c }));
}

// Cards always available in the draft-between-nodes pool.
export const BASE_DRAFT_POOL = [
  CARDS.ADD5, CARDS.XOR, CARDS.BRUTE, CARDS.FORK, CARDS.INTERRUPT, CARDS.NOP,
];
// Cards that start LOCKED and enter the draft pool once bought in the ROOT shop.
export const SHOP_CARDS = {
  SHL: CARDS.SHL, GOTO: CARDS.GOTO, PUNCH: CARDS.PUNCH,
};

// Pure interpreter: run a 3-card program, return the pass value + effect flags
// + a per-step trace (for the playhead animation).
export function evalProgram(program) {
  let acc = 0;
  let doubleNext = false;
  let nopRun = 0;
  let lastNumeric = null; // {kind, value} for GOTO
  const flags = { fork: 0, interrupt: false, spread: 1 };
  const steps = [];

  for (const card of program) {
    let note = '';
    switch (card.kind) {
      case 'add': {
        let v = card.value;
        if (doubleNext) { v *= 2; doubleNext = false; note = 'sled x2'; }
        acc += v;
        lastNumeric = { kind: 'add', value: v };
        nopRun = 0;
        break;
      }
      case 'mult': {
        let m = card.value;
        acc = Math.round(acc * m);
        if (doubleNext) { acc = Math.round(acc * m); doubleNext = false; note = 'sled x2'; }
        flags.spread = Math.max(flags.spread, m);
        lastNumeric = { kind: 'mult', value: m };
        nopRun = 0;
        break;
      }
      case 'nop': {
        nopRun++;
        if (nopRun >= 2) { doubleNext = true; note = 'sled primed'; }
        break;
      }
      case 'goto': {
        if (lastNumeric) {
          if (lastNumeric.kind === 'add') acc += lastNumeric.value;
          else acc = Math.round(acc * lastNumeric.value);
          note = 're-ran prev';
        }
        nopRun = 0;
        break;
      }
      case 'fork': {
        flags.fork++;
        nopRun = 0;
        break;
      }
      case 'interrupt': {
        flags.interrupt = true;
        nopRun = 0;
        break;
      }
      default:
        nopRun = 0;
    }
    steps.push({ name: card.name, acc, note });
  }

  return { value: acc, flags, steps };
}
