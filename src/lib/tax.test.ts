import { describe, it, expect } from 'vitest';
import { incomeTax, estimateCryptoTax } from './tax';

describe('incomeTax (境界値)', () => {
  it('195万 → 97,500', () => expect(incomeTax(1_950_000)).toBeCloseTo(97_500, 4));
  it('330万 → 232,500', () => expect(incomeTax(3_300_000)).toBeCloseTo(232_500, 4));
  it('695万 → 962,500', () => expect(incomeTax(6_950_000)).toBeCloseTo(962_500, 4));
  it('900万 → 1,434,000', () => expect(incomeTax(9_000_000)).toBeCloseTo(1_434_000, 4));
  it('0以下は0', () => {
    expect(incomeTax(0)).toBe(0);
    expect(incomeTax(-100)).toBe(0);
  });
});

describe('estimateCryptoTax', () => {
  it('他所得あり: 損益100万 + 他所得300万', () => {
    const t = estimateCryptoTax(1_000_000, 3_000_000);
    // incomeTax(400万)=372,500, incomeTax(300万)=202,500 → 差170,000
    expect(t.additionalIncomeTax).toBeCloseTo(170_000, 4);
    expect(t.additionalResidentTax).toBeCloseTo(100_000, 4);
    expect(t.totalAdditionalTax).toBeCloseTo(270_000, 4);
    expect(t.assumedOtherIncome).toBe(true);
  });

  it('他所得なし: 損益100万のみ', () => {
    const t = estimateCryptoTax(1_000_000, null);
    // incomeTax(100万)=50,000, resident=100,000
    expect(t.additionalIncomeTax).toBeCloseTo(50_000, 4);
    expect(t.additionalResidentTax).toBeCloseTo(100_000, 4);
    expect(t.totalAdditionalTax).toBeCloseTo(150_000, 4);
    expect(t.assumedOtherIncome).toBe(false);
  });

  it('損失は税ゼロ', () => {
    const t = estimateCryptoTax(-50_000, 3_000_000);
    expect(t.totalAdditionalTax).toBe(0);
    expect(t.additionalIncomeTax).toBe(0);
    expect(t.additionalResidentTax).toBe(0);
  });
});
