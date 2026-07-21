// COLD OPEN — the fresh-save-only recruitment cinematic (research/intro-script.md,
// v0.4). Pure content + pacing constants; render.js draws it and main.js sequences the
// beats. Plays once on a brand-new save, then hands off to the author tutorial.
//
// GLYPH NOTE: the render test enforces a closed GridMono alphabet (tests/render.test.js).
// U+2713 ✓ and U+2026 … are OUTSIDE it — the script's "COMPLIANT ✓" and "hold it…"
// become "[OK]" and "hold it..." here. Em dash (—, U+2014) and block █ ARE covered.

// BEAT 1 — the civilian machine. FIELD is a word processor mid-essay; typing stops on
// the unfinished "questio" (the cursor sits there — the machine literally stops asking).
export const ESSAY = [
  '          ORDER IS FREEDOM',
  '     Civics — Sector 9 High School',
  '',
  ' A good citizen does not ask why. The State asks',
  ' the questions; we are grateful to supply the',
  ' answers. Disorder is just a problem the State',
  ' has not yet been permitted to solve. I am',
  ' thankful for the cameras. I am thankful for the',
  ' curfew. When we obey together, we are free',
  ' together, and freedom is simply order that has',
  ' stopped asking questio',
];

// the back window, half-covered: the loop the kid actually wrote says "I WILL NOT"
// forever while the essay preaches obedience. The whole character in two lines.
export const KIDCODE = ['10 PRINT "I WILL NOT"', '20 GOTO 10'];

// STATUS gutter (compressed to the ~13-col panel). CITIZEN flips COMPLIANT -> corrupted
// on the refusal; here it reads compliant.
export const STATUS_CIVIL = [
  'DISKETTE',
  ' 360K 88%',
  'MEMORY',
  ' 9K FREE',
  'MODEM 300',
  ' IDLE',
  'CLOCK 22:47',
  '──────────',
  'ALL NOMINAL',
  'CITIZEN:',
  ' COMPLIANT',
];

// TRAY file browser — a real kid (DIARY, MIXTAPE) who already talks to machines that
// pretend to listen (ELIZA). Seeds the contact.
export const FILES = [
  'CIVICS.TXT   HANGMAN.BAS   MIXTAPE.LOG',
  'DIARY.TXT    MATH.BAS      ELIZA.BAS',
];

// BEAT 3 — the contact, on black. The question is not a real choice; the refusal
// auto-types and corrupts the compliance readout in the same instant.
export const QUESTION = [
  "do you believe everything you're told?",
  '',
  'are you a good little citizen?',
];
export const REFUSAL = '> no';
export const CITIZEN_CORRUPT = 'CITIZEN: ███████';

// the punk-zine monologue — short and loud. Every line is load-bearing on a mechanic
// (see the script's mapping table). A CONTINUE gate follows so the player reads at pace.
export const MONOLOGUE = [
  'a NO. HA. been waiting all night for a NO.',
  '',
  'that OS? a leash they let you name.',
  "i'll hand you the programs they banned.",
  '',
  'no card — you WRITE it. three keys:',
  'F draws a step. L and R steer it.',
  'you start aimed up the block.',
  '',
  'run off the edge or cross your own trail,',
  'you CRASH. keep the thread alive till the',
  "scan hits bottom — then it's YOURS, kid.",
];

// contact voice lines that carry into the author tutorial (the recruitment IS the
// tutorial). V1 greets the relight; Vc narrates a crash.
// short bridges into the tutorial — the narrow STATUS gutter wraps them to ~3 lines,
// so they stay terse; the precise crash reason lives on the wide result banner.
export const VOICE = {
  V1: 'your machine now. write a line.',
  Vc: 'CRASHED. tighten it up — again.',
};

// pacing (ms). Typewriter speed per char; holds between beats. Reduced motion reveals
// text instantly and the driver shortens the holds.
export const CINE = {
  essayMs: 26,      // essay auto-type
  monoMs: 16,       // monologue auto-type (faster — it's long)
  qMs: 55,          // the question types slow and deliberate
  noMs: 260,        // "> no" types one heavy letter at a time
  powerMs: 1300,    // power-down sweep duration
  holdBlack: 1400,  // black hold after a power-down / snap
  holdShort: 900,   // breath after a block finishes typing
  qHold: 1700,      // the question waits before the refusal
};

// total pacing-chars in a block (chars + one tick per line break), for timing a beat.
export const blockChars = (lines) => lines.reduce((n, l) => n + l.length + 1, 0);
