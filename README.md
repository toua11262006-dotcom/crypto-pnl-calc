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
