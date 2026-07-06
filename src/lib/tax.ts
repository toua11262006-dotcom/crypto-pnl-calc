export interface TaxBracket {
  limit: number;
  rate: number;
  deduction: number;
}

export const INCOME_TAX_BRACKETS: TaxBracket[] = [
  { limit: 1_950_000, rate: 0.05, deduction: 0 },
  { limit: 3_300_000, rate: 0.1, deduction: 97_500 },
  { limit: 6_950_000, rate: 0.2, deduction: 427_500 },
  { limit: 9_000_000, rate: 0.23, deduction: 636_000 },
  { limit: 18_000_000, rate: 0.33, deduction: 1_536_000 },
  { limit: 40_000_000, rate: 0.4, deduction: 2_796_000 },
  { limit: Infinity, rate: 0.45, deduction: 4_796_000 },
];

export const RESIDENT_TAX_RATE = 0.1;

export function incomeTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  const bracket = INCOME_TAX_BRACKETS.find((b) => taxableIncome <= b.limit)!;
  return taxableIncome * bracket.rate - bracket.deduction;
}

export interface TaxEstimate {
  additionalIncomeTax: number;
  additionalResidentTax: number;
  totalAdditionalTax: number;
  assumedOtherIncome: boolean;
}

export function estimateCryptoTax(pnl: number, otherIncome: number | null): TaxEstimate {
  if (pnl <= 0) {
    return {
      additionalIncomeTax: 0,
      additionalResidentTax: 0,
      totalAdditionalTax: 0,
      assumedOtherIncome: otherIncome !== null,
    };
  }
  const base = otherIncome ?? 0;
  const additionalIncomeTax = incomeTax(base + pnl) - incomeTax(base);
  const additionalResidentTax = pnl * RESIDENT_TAX_RATE;
  return {
    additionalIncomeTax,
    additionalResidentTax,
    totalAdditionalTax: additionalIncomeTax + additionalResidentTax,
    assumedOtherIncome: otherIncome !== null,
  };
}
