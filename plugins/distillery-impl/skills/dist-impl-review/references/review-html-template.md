# レビュー HTML 骨格テンプレート(dist-impl-review)

単一 HTML・逆ピラミッド構成。各セクションのデータ取得元を固定する。

| # | セクション | 内容 | データ取得元 |
|---|---|---|---|
| 1 | 結論カード(冒頭 1 画面) | UC 名(日本語)+ 1 行説明 / 結論バッジ(承認可能・要修正・仕様ブロック)/ 根拠 3 点 / 次の行動 | status.yaml(state, stages)+ change-requests 件数 |
| 2 | この UC は何か | 前提知識ゼロ向け: 業務/BUC/UC の位置づけ、実装した tier と役割(用語は初出で 1 行説明) | uc-map.yaml + spec.md の概要節 |
| 3 | 6 段ゲート結果表 | ゲート名 / 意味(1 行)/ 結果 / 分母つき件数(例 シナリオ 8/8)/ 実施 stage | stages/ の done ファイル gates 記録 |
| 4 | Verifier 反証と解決 | attempt ごと: findings 件数(blocker/major/minor)→ 修正 → 再検証の推移。未解決 minor は一覧 | attempt-*/S5_*.findings.yaml |
| 5 | 残課題と仕様への変更要求 | 変更要求の一覧(severity / タイトル / 提案)と「distillery へ渡す手順」 | change-requests/ |
| 6 | 判断ポイント | 「承認すると何が確定するか」「差し戻すならどこへ戻るか」を番号リストで | status.yaml + 本テンプレの規則 |
| 7 | 技術詳細(折りたたみ) | input-manifest(入力の版)/ resolved models / attempt 履歴 / 学び | input-manifest.yaml, status.yaml, learnings/ |

## 結論バッジの判定規則

- **承認可能**: 全ゲート pass かつ open blocker 0
- **要修正**: ゲート fail または open blocker > 0(戻り先 stage を明記)
- **仕様ブロック**: blocked_on_spec(blocker の変更要求を提示し、distillery 側の対応が先であることを明記)

## 様式規則

- セクション 1 だけで判断できることを目標にし、2 以降は根拠の展開にする
- 表の数値は必ず「n/分母」形式。欠測は「unknown」
- 色だけに意味を持たせない(pass/fail はテキストでも表記)
- desktop 幅と狭幅の両方で、結論・ゲート表・残課題が読めること(wide 表は overflow-x: auto)
