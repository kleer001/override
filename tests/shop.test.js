import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SHOP_ITEMS, CHAR_UNLOCK, CARD_UNLOCK } from '../src/shop.js';
import { DRAFT_POOL, SHOP_CARDS } from '../src/cards.js';
import { CHARACTERS } from '../src/characters.js';

// Mirrors the persistence + composition logic in main.js against an in-memory
// store, so the ROOT-shop economy is testable without a DOM. If main.js's logic
// changes, keep this in step.
function makeShop(root = 1000) {
  const store = new Map();
  const getJSON = (k, d) => (store.has(k) ? JSON.parse(store.get(k)) : d);
  const unlockedChars = () => getJSON('chars', ['wardial']);
  const unlockedCards = () => getJSON('cards', []);
  const availChars = () => CHARACTERS.filter((c) => unlockedChars().includes(c.id));
  const draftPool = () => DRAFT_POOL.concat(unlockedCards().map((id) => SHOP_CARDS[id]).filter(Boolean));
  let retry = 0;
  const owned = (it) => it.kind === 'char' ? unlockedChars().includes(CHAR_UNLOCK[it.id])
    : it.kind === 'card' ? unlockedCards().includes(CARD_UNLOCK[it.id]) : false;
  function buy(id) {
    const it = SHOP_ITEMS.find((s) => s.id === id);
    if (!it || owned(it) || root < it.cost) return false;
    root -= it.cost;
    if (it.kind === 'char') { const u = unlockedChars(); u.push(CHAR_UNLOCK[it.id]); store.set('chars', JSON.stringify(u)); }
    else if (it.kind === 'card') { const u = unlockedCards(); u.push(CARD_UNLOCK[it.id]); store.set('cards', JSON.stringify(u)); }
    else if (it.kind === 'retry') retry++;
    else if (it.kind === 'curse') store.set('oc', '1');
    return true;
  }
  return { availChars, draftPool, buy, owned, oc: () => store.get('oc') === '1', getRetry: () => retry, getRoot: () => root };
}

test('shop catalog is well-formed and self-consistent', () => {
  for (const it of SHOP_ITEMS) {
    assert.ok(it.cost > 0 && it.name && it.desc && it.kind, `bad item ${it.id}`);
  }
  for (const id of Object.keys(CHAR_UNLOCK)) assert.ok(SHOP_ITEMS.some((i) => i.id === id && i.kind === 'char'));
  for (const id of Object.keys(CARD_UNLOCK)) assert.ok(SHOP_ITEMS.some((i) => i.id === id && i.kind === 'card'));
  for (const cid of Object.values(CARD_UNLOCK)) assert.ok(SHOP_CARDS[cid], `SHOP_CARDS missing ${cid}`);
});

test('defaults: only War-dialer unlocked, base draft pool only', () => {
  const s = makeShop();
  assert.deepEqual(s.availChars().map((c) => c.id), ['wardial']);
  assert.equal(s.draftPool().length, DRAFT_POOL.length);
});

test('permanent: buying a character unlock adds it to the roster (no double-charge)', () => {
  const s = makeShop();
  const before = s.getRoot();
  assert.ok(s.buy('char_shotgun'));
  assert.deepEqual(s.availChars().map((c) => c.id).sort(), ['shotgun', 'wardial']);
  assert.ok(s.getRoot() < before);
  assert.ok(!s.buy('char_shotgun'));                 // already owned — refused
});

test('permanent: buying a card unlock expands the draft pool', () => {
  const s = makeShop();
  const before = s.draftPool().length;
  assert.ok(s.buy('card_PAYLOAD'));
  assert.equal(s.draftPool().length, before + 1);
  assert.ok(s.draftPool().some((c) => c.id === 'PAYLOAD'));
});

test('consumables: retry tokens stack, overclock arms', () => {
  const s = makeShop();
  s.buy('retry'); s.buy('retry');
  assert.equal(s.getRetry(), 2);
  assert.ok(!s.oc());
  s.buy('overclock');
  assert.ok(s.oc());
});

test('cannot buy above your ROOT balance', () => {
  const s = makeShop(50);                             // less than any char cost
  assert.ok(!s.buy('char_shotgun'));                 // 120 > 50
  assert.deepEqual(s.availChars().map((c) => c.id), ['wardial']);
});
