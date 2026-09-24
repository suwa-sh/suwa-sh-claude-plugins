---
kind: rule
uc: register-loan
tier: frontend-staff
status: open
---

# frontend-staff で画面部品の結線と lint / format の検査に使う依存が入っていない

## 事実

- `docs/rules/tier-frontend.md`: 画面は Storybook の story を構造の正として `packages/ui/` の部品で組む
- `packages/ui/` の部品 (`*.tsx`) は `react` を import するが、リポには `react` / `@types/react` / `react-dom` が入っていない
- `packages/ui/` に `package.json` が無く、`@repo/ui` のような workspace パッケージとして import できない
- `docs/rules/common.md` 必須 4: 「formatter / linter を通過する」。しかし ESLint / Prettier がリポに入っていない
- `apps/frontend-staff/package.json` の `format:check` / `lint` は、そのため echo のプレースホルダのまま残した (`typecheck` は `tsc -p tsconfig.json` に置き換えた)

## frontend-staff での暫定対応 (attempt-1)

- 貸出受付画面は、描画に依存しない画面状態 (`src/screens/loan-checkout/loan-checkout-state.ts`) と操作 (`submit-loan-checkout.ts`) までを実装した
- story (`packages/ui/stories/LoanCheckout.stories.tsx`) の 4 variant と、部品へ渡す値 (CounterLookup の patronError / bookError、Alert、貸出内容) を状態として組み立てる
- `packages/ui` の部品を使った TSX の画面コンポーネント (StaffLayout / PageHeader / CounterLookup / Card / Alert / BookInfoPanel / DueDateDisplay の結線) は未実装

## 必要なパッケージ (npm install は実行していない)

- 画面の結線: `react`、`react-dom`、`@types/react`、`@types/react-dom` (+ SPA のビルドに `vite`、`@vitejs/plugin-react`)
- lint: `eslint`、`typescript-eslint` (flat config)
- format: `prettier`
- `packages/ui` の workspace 化 (package.json と exports)

## 確認したいこと

- 上記依存の導入と `packages/ui` の workspace 化を d2-foundation で行うか
- 導入後、`format:check` を `prettier --check src`、`lint` を `eslint src` に置き換える
