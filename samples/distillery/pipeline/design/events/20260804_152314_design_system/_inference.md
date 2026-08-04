# 推論メモ

## 入力

- `latest/design-event.yaml` のデザイントークン、コンポーネント、画面定義
- `specs/latest/` の全 16 UC の Presentation 層仕様
- 既存の不完全な `latest/storybook-app/`

## 方針

1. `storybook-app/` はイベント履歴へ複製せず、`latest/` で全量再ビルドする
2. Storybook 単体で起動・ビルドできる設定と依存関係を固定する
3. デザイン定義と全 16 画面の Story を再現し、静的アセットもリポジトリ内で完結させる
4. デザイン定義そのものは変更せず、再現成果物の修復だけを記録する
