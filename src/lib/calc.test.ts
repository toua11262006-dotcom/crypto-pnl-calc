import { describe, it, expect } from 'vitest';
import { calcPnl } from './calc';

describe('calcPnl', () => {
  it('利益・パーセント手数料', () => {
    const r = calcPnl({ buyPrice: 100, sellPrice: 150, quantity: 2, feeType: 'percent', feeValue: 0.1 });
    expect(r.grossPnl).toBe(100);
    expect(r.totalFee).toBeCloseTo(0.5, 6); // 0.1% * (200 + 300)
    expect(r.netPnl).toBeCloseTo(99.5, 6);
    expect(r.costBasis).toBe(200);
    expect(r.pnlPercent).toBeCloseTo(49.75, 6);
  });

  it('損失・定額手数料', () => {
    const r = calcPnl({ buyPrice: 100, sellPrice: 80, quantity: 1, feeType: 'fixed', feeValue: 5 });
    expect(r.grossPnl).toBe(-20);
    expect(r.totalFee).toBe(5);
    expect(r.netPnl).toBe(-25);
    expect(r.pnlPercent).toBeCloseTo(-25, 6);
  });

  it('定額手数料の利益', () => {
    const r = calcPnl({ buyPrice: 100, sellPrice: 120, quantity: 1, feeType: 'fixed', feeValue: 10 });
    expect(r.netPnl).toBe(10);
    expect(r.pnlPercent).toBeCloseTo(10, 6);
  });

  it('原資ゼロは損益率 null', () => {
    const r = calcPnl({ buyPrice: 0, sellPrice: 100, quantity: 5, feeType: 'fixed', feeValue: 0 });
    expect(r.costBasis).toBe(0);
    expect(r.pnlPercent).toBeNull();
  });
});
