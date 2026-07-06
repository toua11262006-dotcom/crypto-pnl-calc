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
