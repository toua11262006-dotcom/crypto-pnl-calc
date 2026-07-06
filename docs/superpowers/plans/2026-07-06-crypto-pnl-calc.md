# crypto-pnl-calc Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 仮想通貨1取引の実現損益・損益率・税金概算をクライアント側で即時計算し、AIが結果を平易に解説する単機能 Web ツールを作る。

**Architecture:** Astro プロジェクト。計算機本体は React 島 (`client:load`) で、損益・税の計算は純粋 TS 関数 (`src/lib/`) としてUIから分離しクライアント側で実行。AI解説のみ Cloudflare Pages Function (`functions/explain.ts`) 経由で Claude API を呼び、APIキーは Cloudflare Secret で保護する。

**Tech Stack:** Astro 7, @astrojs/react, React, TypeScript, Vitest, Cloudflare Pages (+ Pages Functions)

## Global Constraints

- Node.js 22.12 以上
- モデル ID は `claude-sonnet-5` (verbatim)
- `ANTHROPIC_API_KEY` は Cloudflare 環境変数 (Secret) からのみ読む。ブラウザ/リポジトリに出さない
- 計算 (損益・税) は**すべてクライアント側の純粋関数**。サーバーは AI解説のみ
- 日本の暗号資産は**雑所得・総合課税**。所得税は累進7区分、住民税は一律10%。復興特別所得税(2.1%)は概算のため含めない
- 税額は概算であり税務助言ではない旨の**免責を UI に明記**
- 損失時 (損益 ≤ 0) の税額はゼロ (雑所得は損益通算・繰越不可)
- v1 はレート制限を実装しない (YAGNI)。AI解説ボタンは実行中 disabled で二重送信のみ防止
- 所得税の累進テーブル (課税所得ベース):
  - 〜1,950,000 → 5% / 控除0
  - 〜3,300,000 → 10% / 控除97,500
  - 〜6,950,000 → 20% / 控除427,500
  - 〜9,000,000 → 23% / 控除636,000
  - 〜18,000,000 → 33% / 控除1,536,000
  - 〜40,000,000 → 40% / 控除2,796,000
  - 40,000,000超 → 45% / 控除4,796,000

---

## File Structure

| ファイル | 責務 |
|---|---|
| `package.json` / `astro.config.mjs` / `tsconfig.json` / `vitest.config.ts` | プロジェクト設定 |
| `src/lib/calc.ts` | 損益・損益率の純粋計算 |
| `src/lib/tax.ts` | 累進税率テーブルと税額概算 |
| `src/components/Calculator.tsx` | React島: 入力フォーム＋結果表示＋AI解説呼び出し |
| `functions/explain.ts` | Cloudflare Pages Function: Claude API 呼び出し (テスト可能なヘルパー分離) |
| `src/pages/index.astro` | ページ枠・SEO・免責・ブログ導線 |
| `src/lib/*.test.ts` / `functions/*.test.ts` | Vitest 単体テスト |

---

## Task 1: プロジェクト基盤 (Astro + React + Vitest)

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `src/pages/index.astro` (placeholder), `src/lib/smoke.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `npm run build` と `npm test` が通る Astro+React+Vitest 環境

- [ ] **Step 1: package.json を作成**

```json
{
  "name": "crypto-pnl-calc",
  "type": "module",
  "version": "0.0.1",
  "engines": { "node": ">=22.12.0" },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "test": "vitest run",
    "astro": "astro"
  },
  "dependencies": {
    "astro": "^7.0.6"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 2: astro をインストールし、React 統合を追加**

Run:
```bash
npm install
npx astro add react --yes
```
Expected: `@astrojs/react`, `react`, `react-dom` が devDependencies/dependencies に追加され、`astro.config.mjs` に react 統合が入る。`astro add` が生成/更新に失敗する場合の代替: `npm install @astrojs/react react react-dom && npm install -D @types/react @types/react-dom` の後、Step 3 の astro.config.mjs を手書きする。

- [ ] **Step 3: astro.config.mjs を確認/作成 (react 統合が入っていること)**

`astro.config.mjs` が以下と等価であることを確認。無ければ作成:
```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  integrations: [react()],
});
```

- [ ] **Step 4: tsconfig.json を作成**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  },
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

- [ ] **Step 5: vitest.config.ts を作成**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'functions/**/*.test.ts'],
  },
});
```

- [ ] **Step 6: .gitignore を作成**

```
node_modules/
dist/
.astro/
.env
```

- [ ] **Step 7: プレースホルダの index.astro を作成**

`src/pages/index.astro`:
```astro
---
---
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <title>仮想通貨 損益計算ツール</title>
  </head>
  <body>
    <main><h1>仮想通貨 損益計算ツール</h1></main>
  </body>
</html>
```

- [ ] **Step 8: スモークテストを作成**

`src/lib/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('vitest runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 9: ビルドとテストが通ることを確認**

Run: `npm run build && npm test`
Expected: build 成功 (dist 生成)、vitest で smoke 1 passed。

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Astro + React + Vitest project"
```

---

## Task 2: 損益計算 (calc.ts)

**Files:**
- Create: `src/lib/calc.ts`, `src/lib/calc.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `type FeeType = 'percent' | 'fixed'`
  - `interface TradeInput { buyPrice: number; sellPrice: number; quantity: number; feeType: FeeType; feeValue: number }`
  - `interface PnlResult { grossPnl: number; totalFee: number; netPnl: number; costBasis: number; pnlPercent: number | null }`
  - `function calcPnl(input: TradeInput): PnlResult`
  - 手数料: `percent` は約定代金 (買い+売り) に対する割合 (feeValue は%値、例 0.1 は 0.1%)。`fixed` は feeValue をそのまま合計手数料(円)とする。
  - `pnlPercent` は `costBasis <= 0` のとき `null`。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/calc.test.ts`:
```ts
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
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/calc.test.ts`
Expected: FAIL (`calc` モジュール/`calcPnl` 未定義)

- [ ] **Step 3: calc.ts を実装**

`src/lib/calc.ts`:
```ts
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/lib/calc.test.ts`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add src/lib/calc.ts src/lib/calc.test.ts
git commit -m "feat: add P&L calculation"
```

---

## Task 3: 税額概算 (tax.ts)

**Files:**
- Create: `src/lib/tax.ts`, `src/lib/tax.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `interface TaxBracket { limit: number; rate: number; deduction: number }`
  - `const INCOME_TAX_BRACKETS: TaxBracket[]` (Global Constraints の7区分、最上位は `limit: Infinity`)
  - `const RESIDENT_TAX_RATE = 0.1`
  - `function incomeTax(taxableIncome: number): number` (累進所得税、住民税は含まない。`taxableIncome <= 0` は 0)
  - `interface TaxEstimate { additionalIncomeTax: number; additionalResidentTax: number; totalAdditionalTax: number; assumedOtherIncome: boolean }`
  - `function estimateCryptoTax(pnl: number, otherIncome: number | null): TaxEstimate`
  - ロジック: `pnl <= 0` は全ゼロ。`base = otherIncome ?? 0`。`additionalIncomeTax = incomeTax(base + pnl) - incomeTax(base)`。`additionalResidentTax = pnl * 0.1`。`assumedOtherIncome = otherIncome !== null`。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/tax.test.ts`:
```ts
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
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/tax.test.ts`
Expected: FAIL (`tax` モジュール未定義)

- [ ] **Step 3: tax.ts を実装**

`src/lib/tax.ts`:
```ts
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/lib/tax.test.ts`
Expected: PASS (8 passed)

- [ ] **Step 5: Commit**

```bash
git add src/lib/tax.ts src/lib/tax.test.ts
git commit -m "feat: add crypto tax estimation"
```

---

## Task 4: AI解説の Pages Function (functions/explain.ts)

**Files:**
- Create: `functions/explain.ts`, `functions/explain.test.ts`

**Interfaces:**
- Consumes: なし (ランタイムの `fetch`/`Request`/`Response` を使用)
- Produces:
  - `interface ExplainPayload { input: { buyPrice: number; sellPrice: number; quantity: number; feeType: string; feeValue: number; otherIncome: number | null }; result: { netPnl: number; pnlPercent: number | null; totalAdditionalTax: number; assumedOtherIncome: boolean } }`
  - `function buildExplainPrompt(p: ExplainPayload): string`
  - `function handleExplain(request: Request, env: { ANTHROPIC_API_KEY?: string }, fetchImpl?: typeof fetch): Promise<Response>`
  - `const onRequestPost` (Cloudflare Pages Function エントリ、`handleExplain(context.request, context.env)` を呼ぶ)
  - 挙動: キー無し→503 `{error:'ai_unavailable'}`。body が JSON でない→400 `{error:'bad_request'}`。Claude 成功→200 `{explanation}`。Claude 非2xx/例外→503 `{error:'ai_failed'}`。モデルは `claude-sonnet-5`。

- [ ] **Step 1: 失敗するテストを書く**

`functions/explain.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildExplainPrompt, handleExplain, type ExplainPayload } from './explain';

const payload: ExplainPayload = {
  input: { buyPrice: 100, sellPrice: 150, quantity: 2, feeType: 'percent', feeValue: 0.1, otherIncome: 3_000_000 },
  result: { netPnl: 99.5, pnlPercent: 49.75, totalAdditionalTax: 270_000, assumedOtherIncome: true },
};

function req(body: unknown): Request {
  return new Request('https://x/explain', { method: 'POST', body: JSON.stringify(body) });
}

describe('buildExplainPrompt', () => {
  it('損益と税額を含む', () => {
    const p = buildExplainPrompt(payload);
    expect(p).toContain('99.5');
    expect(p).toContain('270000');
  });
});

describe('handleExplain', () => {
  it('キー無しは503', async () => {
    const res = await handleExplain(req(payload), {});
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'ai_unavailable' });
  });

  it('不正なJSONは400', async () => {
    const bad = new Request('https://x/explain', { method: 'POST', body: 'not json' });
    const res = await handleExplain(bad, { ANTHROPIC_API_KEY: 'k' });
    expect(res.status).toBe(400);
  });

  it('Claude成功で200と解説', async () => {
    const fakeFetch = async () =>
      new Response(JSON.stringify({ content: [{ type: 'thinking', thinking: 'x' }, { type: 'text', text: '解説文です' }] }), { status: 200 });
    const res = await handleExplain(req(payload), { ANTHROPIC_API_KEY: 'k' }, fakeFetch as typeof fetch);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ explanation: '解説文です' });
  });

  it('Claude失敗は503', async () => {
    const fakeFetch = async () => new Response('err', { status: 500 });
    const res = await handleExplain(req(payload), { ANTHROPIC_API_KEY: 'k' }, fakeFetch as typeof fetch);
    expect(res.status).toBe(503);
  });

  it('fetch例外は503', async () => {
    const fakeFetch = async () => { throw new Error('network'); };
    const res = await handleExplain(req(payload), { ANTHROPIC_API_KEY: 'k' }, fakeFetch as typeof fetch);
    expect(res.status).toBe(503);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run functions/explain.test.ts`
Expected: FAIL (`explain` モジュール未定義)

- [ ] **Step 3: explain.ts を実装**

`functions/explain.ts`:
```ts
export interface ExplainPayload {
  input: {
    buyPrice: number;
    sellPrice: number;
    quantity: number;
    feeType: string;
    feeValue: number;
    otherIncome: number | null;
  };
  result: {
    netPnl: number;
    pnlPercent: number | null;
    totalAdditionalTax: number;
    assumedOtherIncome: boolean;
  };
}

const MODEL = 'claude-sonnet-5';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function buildExplainPrompt(p: ExplainPayload): string {
  const otherIncomeText =
    p.input.otherIncome === null ? '未入力' : `${p.input.otherIncome}円`;
  return `あなたは日本の暗号資産(仮想通貨)の税金にくわしい、中立的な解説者です。
以下は利用者が損益計算ツールに入力した1回の取引と、その概算結果です。

【入力】
買値: ${p.input.buyPrice}円 / 売値: ${p.input.sellPrice}円 / 数量: ${p.input.quantity}
手数料: ${p.input.feeType} ${p.input.feeValue}
その年の他の所得: ${otherIncomeText}

【概算結果】
実現損益: ${p.result.netPnl}円 (損益率: ${p.result.pnlPercent ?? '—'}%)
概算の追加税額: ${p.result.totalAdditionalTax}円
${p.result.assumedOtherIncome ? '' : '※他の所得が未入力のため、損益額のみを課税所得と仮定した目安です。'}

この結果を、専門用語を避けて3〜5文で平易に解説してください。
日本の暗号資産は雑所得・総合課税で、他の所得と合算して累進課税される点に触れてください。
最後に必ず「これは概算であり、正確な申告は専用ツールや税理士にご相談ください」という趣旨の一文を添えてください。
解説文の本文のみを出力してください。`;
}

export async function handleExplain(
  request: Request,
  env: { ANTHROPIC_API_KEY?: string },
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'ai_unavailable' }, 503);

  let payload: ExplainPayload;
  try {
    payload = (await request.json()) as ExplainPayload;
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const prompt = buildExplainPrompt(payload);

  try {
    const r = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!r.ok) return json({ error: 'ai_failed' }, 503);
    const data = (await r.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (data.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('')
      .trim();
    return json({ explanation: text }, 200);
  } catch {
    return json({ error: 'ai_failed' }, 503);
  }
}

export const onRequestPost = (context: {
  request: Request;
  env: { ANTHROPIC_API_KEY?: string };
}) => handleExplain(context.request, context.env);
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run functions/explain.test.ts`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit**

```bash
git add functions/explain.ts functions/explain.test.ts
git commit -m "feat: add AI explanation Pages Function"
```

---

## Task 5: 計算機 React 島 (Calculator.tsx)

**Files:**
- Create: `src/components/Calculator.tsx`

**Interfaces:**
- Consumes: `calcPnl`/`TradeInput`/`FeeType` (calc.ts), `estimateCryptoTax` (tax.ts), `POST /explain` (Task 4 のエンドポイント、body は `{ input, result }`)
- Produces: `export default function Calculator(): JSX.Element` — Astro から `client:load` で読み込む React コンポーネント

- [ ] **Step 1: Calculator.tsx を実装**

`src/components/Calculator.tsx`:
```tsx
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
      <div className="fields">
        <label>買値 (円)<input inputMode="decimal" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} /></label>
        <label>売値 (円)<input inputMode="decimal" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} /></label>
        <label>数量<input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
        <label>手数料の種類
          <select value={feeType} onChange={(e) => setFeeType(e.target.value as FeeType)}>
            <option value="percent">パーセント (%)</option>
            <option value="fixed">定額 (円)</option>
          </select>
        </label>
        <label>手数料の値<input inputMode="decimal" value={feeValue} onChange={(e) => setFeeValue(e.target.value)} /></label>
        <label>その年の他の所得 (円・任意)<input inputMode="decimal" value={otherIncome} onChange={(e) => setOtherIncome(e.target.value)} /></label>
      </div>

      {!coreValid && <p className="hint">買値・売値・数量に数値を入力してください。</p>}

      {computed && (
        <div className="results">
          <p>実現損益: <strong>{yen(computed.pnl.netPnl)}</strong></p>
          <p>損益率: <strong>{computed.pnl.pnlPercent === null ? '—' : computed.pnl.pnlPercent.toFixed(2) + '%'}</strong></p>
          <p>手数料合計: {yen(computed.pnl.totalFee)}</p>
          <p>概算の追加税額: <strong>{yen(computed.tax.totalAdditionalTax)}</strong>
            {' '}(所得税 {yen(computed.tax.additionalIncomeTax)} + 住民税 {yen(computed.tax.additionalResidentTax)})</p>
          {!computed.tax.assumedOtherIncome && (
            <p className="note">※他の所得が未入力のため、損益額のみを課税所得と仮定した目安です。</p>
          )}
          <p className="disclaimer">
            税額は概算であり、税務上の助言ではありません。正確な損益計算・確定申告には専用ツールや税理士をご利用ください。
          </p>

          <button onClick={explain} disabled={aiLoading}>
            {aiLoading ? 'AIが解説中…' : 'AIに解説してもらう'}
          </button>
          {aiError && <p className="note">解説は今使えません。計算結果はそのまま有効です。</p>}
          {aiText && <div className="ai-explain">{aiText}</div>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 型チェックとビルドが通ることを確認**

Run: `npx astro check 2>/dev/null || true; npm run build`
Expected: build 成功 (Calculator を後続タスクで index に載せるまではツリーシェイクされるが、型エラーが無いこと)。`astro check` が未導入ならスキップ可。

- [ ] **Step 3: Commit**

```bash
git add src/components/Calculator.tsx
git commit -m "feat: add Calculator React island"
```

---

## Task 6: ページ・免責・導線・README

**Files:**
- Modify: `src/pages/index.astro`
- Create: `README.md`

**Interfaces:**
- Consumes: `Calculator` (Task 5)
- Produces: 公開可能なトップページとデプロイ手順

- [ ] **Step 1: index.astro を仕上げる**

`src/pages/index.astro` を以下で置き換え:
```astro
---
import Calculator from '../components/Calculator.tsx';
const title = '仮想通貨 損益計算ツール｜税金もAIがザックリ解説';
const description = 'ビットコインなど仮想通貨の1取引の損益・損益率・税金の概算を無料で計算。日本の雑所得・総合課税に対応し、結果をAIが平易に解説します。';
---
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content={description} />
    <title>{title}</title>
  </head>
  <body>
    <main>
      <h1>仮想通貨 損益計算ツール</h1>
      <p>買値・売値・数量を入れると、実現損益と日本の税金(雑所得・総合課税)の概算を計算します。結果はAIが平易に解説します。</p>
      <Calculator client:load />
      <footer>
        <p class="disclaimer">
          本ツールの計算結果はすべて概算であり、税務・投資の助言ではありません。
          正確な損益計算・確定申告には専用ツールや税理士をご利用ください。
        </p>
        <p><a href="https://crypto-bot-blog.pages.dev/">仮想通貨・自動売買ボットの解説ブログ「ボット運用ラボ」はこちら</a></p>
      </footer>
    </main>
  </body>
</html>
```

- [ ] **Step 2: README.md を作成**

`README.md`:
````markdown
# crypto-pnl-calc

仮想通貨1取引の損益・税金をザックリ計算し、結果をAIが解説する Web ツール (Astro + React + Cloudflare Pages)。

## 開発

```bash
npm install
npm run dev      # ローカル開発サーバー
npm test         # 単体テスト (Vitest)
npm run build    # 本番ビルド (dist/)
```

## 計算ロジック

- 損益・税額はすべてクライアント側の純粋関数 (`src/lib/calc.ts`, `src/lib/tax.ts`)。
- 日本の暗号資産は雑所得・総合課税。所得税は累進7区分、住民税は一律10%で概算 (復興特別所得税は含まない)。

## AI解説 (Cloudflare Pages Function)

- `functions/explain.ts` が `POST /explain` を受け、Claude API (`claude-sonnet-5`) を呼ぶ。
- **デプロイ時に Cloudflare Pages の環境変数 (Secret) に `ANTHROPIC_API_KEY` を設定**すること。未設定でも計算機は動作し、AI解説だけが無効になる。

## デプロイ (Cloudflare Pages)

1. GitHub リポジトリを Cloudflare Pages に接続
2. ビルドコマンド: `npm run build` / 出力ディレクトリ: `dist`
3. `functions/` ディレクトリは Cloudflare Pages Functions として自動認識される
4. 設定 → 環境変数 に `ANTHROPIC_API_KEY` を Secret で追加
````

- [ ] **Step 3: ビルドと全テストを確認**

Run: `npm run build && npm test`
Expected: build 成功、全テスト PASS (smoke 1 + calc 4 + tax 8 + explain 6 = 19)。

- [ ] **Step 4: ローカルでプレビューし表示を確認 (preview_* ツール)**

`.claude/launch.json` に dev サーバー設定を追加し、preview ツールで起動 → トップページに計算機フォームが表示され、値を入れると損益・税額が更新されることを確認。AI解説ボタンはローカルにキーが無ければフォールバック文言が出る (正常)。

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.astro README.md
git commit -m "feat: finish page, disclaimer, blog link, README"
```

---

## Self-Review 結果

- **Spec coverage:** クライアント計算(Task2,3)、AI解説サーバーレス(Task4)、React島UI(Task5)、免責(Task5,6)、ブログ導線(Task6)、税率テーブル/住民税/損失ゼロ/他所得有無(Task3)、キー保護とフォールバック(Task4,5)、レート制限なし・二重送信防止(Task5 disabled)、デプロイ/env(Task6 README) — すべてタスクに対応。
- **Placeholder scan:** なし。全コード実物。`astro check` はオプション明記。
- **Type consistency:** `TradeInput`/`FeeType`/`PnlResult`/`TaxEstimate`/`ExplainPayload` のフィールド名、`calcPnl`/`estimateCryptoTax`/`incomeTax`/`handleExplain`/`buildExplainPrompt` のシグネチャはタスク間で一致。Calculator が送る `{input, result}` は explain.ts の `ExplainPayload` と一致。
