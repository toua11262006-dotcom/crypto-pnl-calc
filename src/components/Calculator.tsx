import { useMemo, useState } from 'react';
import { calcPnl, type FeeType } from '../lib/calc';
import { estimateCryptoTax } from '../lib/tax';

const yen = (n: number) => Math.round(n).toLocaleString('ja-JP') + '円';

export default function Calculator() {
  const [buyPrice, setBuyPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [feeType, setFeeType] = useState<FeeType>('percent');
  const [feeValue, setFeeValue] = useState('0');
  const [otherIncome, setOtherIncome] = useState('');

  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);

  const num = (s: string) => (s.trim() === '' ? NaN : Number(s));

  const coreValid =
    !Number.isNaN(num(buyPrice)) &&
    !Number.isNaN(num(sellPrice)) &&
    !Number.isNaN(num(quantity));

  const computed = useMemo(() => {
    if (!coreValid) return null;
    const pnl = calcPnl({
      buyPrice: num(buyPrice),
      sellPrice: num(sellPrice),
      quantity: num(quantity),
      feeType,
      feeValue: Number.isNaN(num(feeValue)) ? 0 : num(feeValue),
    });
    const otherIncomeVal = otherIncome.trim() === '' ? null : num(otherIncome);
    const tax = estimateCryptoTax(
      pnl.netPnl,
      otherIncomeVal !== null && Number.isNaN(otherIncomeVal) ? null : otherIncomeVal,
    );
    return { pnl, tax, otherIncomeVal };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyPrice, sellPrice, quantity, feeType, feeValue, otherIncome, coreValid]);

  async function explain() {
    if (!computed) return;
    setAiLoading(true);
    setAiError(false);
    setAiText(null);
    try {
      const res = await fetch('/explain', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          input: {
            buyPrice: num(buyPrice),
            sellPrice: num(sellPrice),
            quantity: num(quantity),
            feeType,
            feeValue: Number.isNaN(num(feeValue)) ? 0 : num(feeValue),
            otherIncome: computed.otherIncomeVal,
          },
          result: {
            netPnl: computed.pnl.netPnl,
            pnlPercent: computed.pnl.pnlPercent,
            totalAdditionalTax: computed.tax.totalAdditionalTax,
            assumedOtherIncome: computed.tax.assumedOtherIncome,
          },
        }),
      });
      if (!res.ok) throw new Error('ai');
      const data = (await res.json()) as { explanation: string };
      setAiText(data.explanation);
    } catch {
      setAiError(true);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="calc">
      <div className="panel">
        <span className="panel-title">INPUT</span>
        <div className="fields">
          <label>買値 (円)<input inputMode="decimal" placeholder="例: 5000000" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} /></label>
          <label>売値 (円)<input inputMode="decimal" placeholder="例: 6000000" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} /></label>
          <label className="wide-sm">数量<input inputMode="decimal" placeholder="例: 0.1" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
          <label>手数料の種類
            <select value={feeType} onChange={(e) => setFeeType(e.target.value as FeeType)}>
              <option value="percent">パーセント (%)</option>
              <option value="fixed">定額 (円)</option>
            </select>
          </label>
          <label>手数料の値<input inputMode="decimal" value={feeValue} onChange={(e) => setFeeValue(e.target.value)} /></label>
          <label className="wide-sm"><span>その年の他の所得 (円) <span className="opt">任意</span></span><input inputMode="decimal" placeholder="例: 4000000" value={otherIncome} onChange={(e) => setOtherIncome(e.target.value)} /></label>
        </div>

        {!coreValid && <p className="hint">買値・売値・数量に数値を入力してください。</p>}
      </div>

      {computed && (
        <div className="results">
          <div className={'hero-num ' + (computed.pnl.netPnl > 0 ? 'plus' : computed.pnl.netPnl < 0 ? 'minus' : 'even')}>
            <span className="label">実現損益</span>
            <p className="big">{(computed.pnl.netPnl > 0 ? '+' : '') + yen(computed.pnl.netPnl)}</p>
            <span className="pct">損益率 {computed.pnl.pnlPercent === null ? '—' : (computed.pnl.pnlPercent > 0 ? '+' : '') + computed.pnl.pnlPercent.toFixed(2) + '%'}</span>
            {computed.pnl.netPnl !== 0 && (
              <span className="stamp" aria-hidden="true">{computed.pnl.netPnl > 0 ? '利益' : '損失'}</span>
            )}
          </div>

          <div className="sub">
            <div>
              <span className="label">概算の追加税額</span>
              <span className="v tax">{yen(computed.tax.totalAdditionalTax)}</span>
              <span className="detail">所得税 {yen(computed.tax.additionalIncomeTax)} ＋ 住民税 {yen(computed.tax.additionalResidentTax)}</span>
            </div>
            <div>
              <span className="label">手数料合計</span>
              <span className="v">{yen(computed.pnl.totalFee)}</span>
            </div>
          </div>
          {!computed.tax.assumedOtherIncome && (
            <p className="note">※他の所得が未入力のため、損益額のみを課税所得と仮定した目安です。</p>
          )}
          <p className="disclaimer">
            税額は概算であり、税務上の助言ではありません。正確な損益計算・確定申告には専用ツールや税理士をご利用ください。
          </p>

          <div className="ai">
            <button onClick={explain} disabled={aiLoading}>
              {aiLoading ? 'AIが解説中…' : 'AIに解説してもらう'}
            </button>
            {aiError && <p className="note">解説は今使えません。計算結果はそのまま有効です。</p>}
            {aiText && <div className="ai-explain">{aiText}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
