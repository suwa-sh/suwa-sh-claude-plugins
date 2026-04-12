# Step2: ユーザー確認（対話）

## 対話フロー

Step1 の分析結果をユーザーに提示し、承認・調整を行う。
各ステップで **選択肢を提示** し、ユーザーに選んでもらう。

## 確認1: ポータル構成

> 💡 この選択は決定記録（design-decision-{NNN}.yaml）として記録される（カテゴリ: ブランドアイデンティティ方向性、ポータル構成戦略）

### 提示内容
- 導出したポータル一覧
- 各ポータルのプライマリカラー案
- 各ポータルの対象アクターと画面数

### 選択肢
```
ポータル構成を確認してください:

  ポータル          カラー         対象             画面数
  User (利用者)     Blue #2563EB   {アクター名}     {N}画面
  Owner (提供者)    Teal #0D9488   {アクター名}     {N}画面
  Admin (管理者)    Slate #334155  {アクター名}     {N}画面

選択肢:
  A: この構成で承認
  B: カラーを変更したい（変更したいポータルと希望カラーを教えてください）
  C: ポータルを追加・削除したい（詳細を教えてください）
```

## 確認2: デザイントークン方針

> 💡 この選択は決定記録（design-decision-{NNN}.yaml）として記録される（カテゴリ: トークンアーキテクチャ）

### 提示内容
- 3層トークン構造のサマリー
- フォントファミリー案
- カラースケール案（primary以外のstatus/accent色）
- dark mode 対応方針

### 選択肢
```
デザイントークン方針を確認してください:

  フォント:       {sans-serif}, {monospace}
  Status Colors:  Success=Green, Warning=Orange, Destructive=Red, Info=Blue
  Accent:         Rating=Amber, Virtual=Violet
  Dark Mode:      CSS class (.dark) + prefers-color-scheme

選択肢:
  A: この方針で承認
  B: フォントを変更したい
  C: カラースケールを変更したい
  D: その他の調整
```

## 確認3: ドメインコンポーネント構成

> 💡 この選択は決定記録（design-decision-{NNN}.yaml）として記録される（カテゴリ: コンポーネント戦略）

### 提示内容
- RDRA から導出したドメインコンポーネント一覧
- 各コンポーネントの概要と対応画面

### 選択肢
```
ドメインコンポーネント構成を確認してください:

  コンポーネント名              対応画面                 用途
  {ComponentName}              {画面名1, 画面名2}       {概要}
  ...

選択肢:
  A: この構成で承認
  B: コンポーネントを追加したい（名称と用途を教えてください）
  C: コンポーネントを削除したい（対象を教えてください）
  D: コンポーネントの仕様を変更したい（対象と変更内容を教えてください）
```

## 確認4: Storybook プロジェクト構成

> 💡 この選択は決定記録（design-decision-{NNN}.yaml）として記録される（カテゴリ: コンポーネント戦略）

### 提示内容
- Tech stack (Next.js + TypeScript + Tailwind CSS)
- Storybook バージョンと addon 構成
- Stories 構成 (UI/ と Domain/ のカテゴリ分け)

### 選択肢
```
Storybook 構成を確認してください:

  Framework:  Next.js + TypeScript + Tailwind CSS
  Storybook:  v10 + addon-docs + addon-a11y
  Categories: UI/ (汎用) + Domain/ (ドメイン特化)
  Docs:       Introduction, Design Tokens, Screen Mapping (MDX)

選択肢:
  A: この構成で承認
  B: フレームワークを変更したい（React SPA, Vue 等）
  C: Stories のカテゴリ構成を変更したい
  D: ドキュメントページを追加したい
```

## 対話後

すべての確認が完了したら、確定した内容を `_inference.md` に追記し、Step3 に進む。
