import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createTrauma } from '../src/shake.js';

test('trauma clamps into [0,1]', () => {
  const t = createTrauma();
  t.add(0.4); assert.equal(t.value, 0.4);
  t.add(5);   assert.equal(t.value, 1);        // saturates, never exceeds 1
  t.add(-9);  assert.equal(t.value, 0);        // and never drops below 0
});

test('decay bleeds trauma over time and floors at 0', () => {
  const t = createTrauma({ decayPerSec: 2 });
  t.add(1);
  t.decay(250);                                 // 0.25s * 2/s = 0.5
  assert.ok(Math.abs(t.value - 0.5) < 1e-9);
  t.decay(1000);                                // would go negative
  assert.equal(t.value, 0);
});

test('shake is zero at zero trauma', () => {
  const t = createTrauma();
  const s = t.shake(() => 0.99);
  assert.deepEqual(s, { x: 0, y: 0, rot: 0 });
});

test('shake grows with trauma SQUARED, not linearly (Eiserloh)', () => {
  const t = createTrauma({ maxOffset: 10, maxRot: 0 });
  const rand = () => 1;                          // pin jitter to +max so we read amplitude
  t.reset(); t.add(0.5);
  const half = t.shake(rand).x;                  // 10 * 0.25 * 1 = 2.5
  t.reset(); t.add(1);
  const full = t.shake(rand).x;                  // 10 * 1    * 1 = 10
  assert.ok(Math.abs(half - 2.5) < 1e-9);
  assert.ok(Math.abs(full - 10) < 1e-9);
  assert.ok(full / half > 3.9);                  // 4x for 2x trauma => quadratic, not linear
});

test('shake stays within [-max, max] on every axis', () => {
  const t = createTrauma({ maxOffset: 6, maxRot: 0.6 });
  t.add(1);
  for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
    const s = t.shake(() => r);
    assert.ok(Math.abs(s.x) <= 6 + 1e-9 && Math.abs(s.y) <= 6 + 1e-9);
    assert.ok(Math.abs(s.rot) <= 0.6 + 1e-9);
  }
});

test('reset zeroes trauma so shake never carries across runs', () => {
  const t = createTrauma();
  t.add(1); t.reset();
  assert.equal(t.value, 0);
  assert.deepEqual(t.shake(() => 1), { x: 0, y: 0, rot: 0 });
});
