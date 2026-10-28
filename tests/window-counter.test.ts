import { describe, expect, it } from 'vitest';
import { WindowCounter } from '../engine/mutation/window-counter';

describe('mutation action counters', () => {
  it('ages rare invalid actions out before they can disable a healthy module', () => {
    const invalid = new WindowCounter(60_000);
    expect(invalid.add(9, 1000)).toBe(9);
    expect(invalid.add(1, 61_001)).toBe(1);
  });
  it('reports only recent event skips', () => {
    const skipped = new WindowCounter(10_000);
    skipped.add(4, 1000);
    expect(skipped.current(10_999)).toBe(4);
    expect(skipped.current(11_000)).toBe(0);
  });
});
