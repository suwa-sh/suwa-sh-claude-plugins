# P5 invalidate + config ユーザー確定

- P5(ui)を invalidate: storybook-app 配置と P5 プローブの競合で取り込みが 4/6 ファイルに欠落(BookCard.tsx / LoanCheckout.stories.tsx)。bootstrap 部分再実行で回収する
- config ユーザー確定: verifier_model=claude-opus-5 / backend_framework=express / 残り(tier→dir・kind・datastore_owner・lang・toolchain)は推定案どおり一括承認
- 発見した設計ギャップ(SKILL 改善候補): inputs_sha256.design が design-event.yaml のみで storybook src の内容変更を検知できない / イベント型に config 確定を表す型が無い
