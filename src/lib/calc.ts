export type FeeType = 'percent' | 'fixed';

export interface TradeInput {
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  feeType: FeeType;
  feeValue: number;
}

export interface PnlResult {
  grossPnl: number;
  totalFee: number;
  netPnl: number;
  costBasis: number;
  pnlPercent: number | null;
}

export function calcPnl(input: TradeInput): PnlResult {
  const { buyPrice, sellPrice, quantity, feeType, feeValue } = input;
  const costBasis = buyPrice * quantity;
  const sellNotional = sellPrice * quantity;
  const grossPnl = (sellPrice - buyPrice) * quantity;

  const totalFee =
    feeType === 'percent'
      ? (feeValue / 100) * (costBasis + sellNotional)
      : feeValue;

  const netPnl = grossPnl - totalFee;
  const pnlPercent = costBasis > 0 ? (netPnl / costBasis) * 100 : null;

  return { grossPnl, totalFee, netPnl, costBasis, pnlPercent };
}
