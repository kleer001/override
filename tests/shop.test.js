import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SHOP_ITEMS, DECK_CARD, CARD_UNLOCK } from '../src/shop.js';
import { DRAFT_POOL, SHOP_CARDS, CARDS } from '../src/cards.js';

// Mirrors the persistence + composition logic in main.js against an in-memory
// store, so the ROOT-shop economy is testable without a DOM. If main.js's logic
// changes, keep this in step.
function makeShop(root = 1000) {
  const store = new Map();
  const getJSON = (k, d) => (store.has(k) ? JSON.parse(store.get(k)) : d);
  const unlockedCards = () => getJSON('cards', []);
  const draftPool = () => DRAFT_POOL.concat(unlockedCards().map((id) => SHOP_CARDS[id]).filter(Boolean));
  const deck = [{ ...CARDS['SCRIPT.COM'] }];       // the one-card starter
  let retry = 0;
  const owned = (it) => it.kind === 'card' ? unlockedCards().includes(CARD_UNLOCK[it.id]) : false;
  function buy(id) {
    const it = SHOP_ITEMS.find((s) => s.id === id);
    if (!it || owned(it) || root < it.cost) return false;
    root -= it.cost;
    if (it.kind === 'deckcard') deck.push({ ...CARDS[DECK_CARD[it.id]] });
    else if (it.kind === 'card') { const u = unlockedCards(); u.push(CARD_UNLOCK[it.id]); store.set('cards', JSON.stringify(u)); }
    else if (it.kind === 'retry') retry++;
    return true;
  }
  return { draftPool, buy, owned, deck, getRetry: () => retry, getRoot: () => root };
}

test('shop catalog is well-formed and self-consistent', () => {
  for (const it of SHOP_ITEMS) {
    assert.ok(it.cost > 0 && it.name && it.desc && it.kind, `bad item ${it.id}`);
  }
  for (const id of Object.keys(DECK_CARD)) assert.ok(SHOP_ITEMS.some((i) => i.id === id && i.kind === 'deckcard'));
  for (const id of Object.keys(CARD_UNLOCK)) assert.ok(SHOP_ITEMS.some((i) => i.id === id && i.kind === 'card'));
  for (const cid of Object.values(DECK_CARD)) assert.ok(CARDS[cid], `CARDS missing ${cid}`);
  for (const cid of Object.values(CARD_UNLOCK)) assert.ok(SHOP_CARDS[cid], `SHOP_CARDS missing ${cid}`);
});

test('defaults: base draft pool only until cards are unlocked', () => {
  const s = makeShop();
  assert.equal(s.draftPool().length, DRAFT_POOL.length);
});

test('deck-add: FORK.COM drops straight into the deck (cheap, repeatable)', () => {
  const s = makeShop();
  const before = s.deck.length;
  assert.ok(s.buy('deck_FORK'));
  assert.equal(s.deck.length, before + 1);
  assert.ok(s.deck.some((c) => c.id === 'FORK.COM'));
  assert.ok(s.buy('deck_FORK'));                     // repeatable — never "owned"
  assert.equal(s.deck.length, before + 2);
});

test('permanent: buying a card unlock expands the draft pool', () => {
  const s = makeShop();
  const before = s.draftPool().length;
  assert.ok(s.buy('card_PAYLOAD'));
  assert.equal(s.draftPool().length, before + 1);
  assert.ok(s.draftPool().some((c) => c.id === 'PAYLOAD'));
});

test('consumables: retry tokens stack', () => {
  const s = makeShop();
  s.buy('retry'); s.buy('retry');
  assert.equal(s.getRetry(), 2);
});

test('cannot buy above your ROOT balance', () => {
  const s = makeShop(5);                              // less than any item cost
  assert.ok(!s.buy('deck_FORK'));                    // 10 > 5
  assert.equal(s.deck.length, 1);
});
