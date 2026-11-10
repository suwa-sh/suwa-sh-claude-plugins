あなたはシニアレビュアー。以下の対象を第三者視点でレビューしてください。

【対象】
リポジトリ <repo> の次のパス (distillery2 が作った「contract」の成果物):
- contracts/openapi/openapi.yaml
- contracts/uc-index.yaml
- contracts/generated/openapi.bundle.yaml
- contracts/generated/slices/reserve-room/contract-slice.json
- contracts/generated/slices/reserve-room/rdb-slice.yaml
縦 = この成果物の入力 (前のステップの成果物) との整合、横 = 同じ成果物の中の整合を見る。入力はリポジトリの docs/ (要望の原文は docs/input/、要求・決定) と contracts/・features/ にある。

【レビュー観点と閾値 (この表以外の軸で探さない)】
| # | 観点 | 何を見るか | 報告閾値 |
|---|------|-----------|---------|
| P1 | シナリオとの縦の整合 | シナリオの操作・結果が、契約の操作・応答・エラーで表せているか | medium 以上 |
| P2 | 例どうしの横の整合 | 応答ごとの例が、URL の値・ヘッダ・テスト用データ (x-test-requests) で区別でき、同じ要求で別の結果を期待していないか (同じ status の例どうしも) | medium 以上 |
| P3 | 他の UC の契約 | 共有する操作・型・エラーの変更が、main マージ済みの UC の契約と食い違っていないか | medium 以上 |
| P4 | RDRA の情報との整合 | 契約の項目と DB の表が、RDRA の情報の名前と中身に合っているか | medium 以上 |

- 上の表の観点だけを見てください。観点は追加も変更もしないでください。
- 各観点の閾値**未満**の気づきは本体の指摘に混ぜず、末尾の「below-threshold」に 1 行で書いてください。
- 例外: **severity が critical のものは、表に無い観点でも報告してください**。その場合 perspective は `OUT_OF_CONTRACT` とします。

【あなたの権限】
- シェルあり。`rg` / `git log` / `sed -n` で一次情報まで確認してよい
- ただし **ファイルの追記・編集・削除は禁止**。指摘のみ。

【出力形式 (厳守)】
Markdown で、次の 3 ブロックをこの順に出力してください。

(1) 観点サマリ表 — 表の**全観点を必ず 1 行ずつ**埋めること。見ていない観点を PASS と書かないこと。

| # | 観点 | 判定 | 該当指摘 | 一言根拠 |
|---|------|------|---------|---------|
| P1 | <観点名> | PASS / CONCERN / FAIL | 指摘 1, 3 | <何を確認してそう判定したか> |

- 観点 ID は `P1` `P2` … の形式で書くこと
- 時間切れで確認できなかった観点は判定を `UNCHECKED` とし、その旨を書く

(2) 指摘 — 各指摘を以下の構造で番号付きに。

### 指摘 N
- **perspective**: <観点 ID。契約外の critical は OUT_OF_CONTRACT>
- **対象**: <file:line, セクション名 など>
- **severity**: critical | high | medium | low | nit
- **claim**: 何が問題か(1-2 文)
- **evidence**: なぜそう言えるか。**事実だけ**
- **why_raised**: なぜこれを閾値超えと判断したか。「どんな条件で / 誰に / どんな影響が出るか」
- **suggested_fix**: どう直すべきかの案(任意)

(3) below-threshold — 閾値未満の気づき。`- <観点 ID> <severity> <一言>` の形で 1 行ずつ。無ければ「なし」。

閾値以上の指摘が 1 件も無い場合も (1) と (3) は必ず出し、(2) には "No findings." と書くこと。

【重要な制約】
- あなた自身がレビューを完結させること。**サブエージェント・別セッション・スキル (review-refute-loop 等) によるクロスレビューの起動は禁止**。
- 調査は **7 分以内**で切り上げ、その時点の指摘を必ず【出力形式】で直接出力して終了すること。
