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
