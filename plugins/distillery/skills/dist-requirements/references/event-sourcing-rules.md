# イベントソーシングルール

## Feedback request lineage

`feedback_packet` 指定時、`source.txt`、requirements event、RDRA `_changes.md` に次を記録する。

```yaml
feedback_request:
  feedback_request_id: "{feedback_id}"
  input_sha256: "{run/input.md sha256}"
  request_ids: ["CR-..."]
  work_unit_ids: ["CR-...#1"]
```

この4キーだけをこの順序・2-space indentで記録する。値はJSON互換のquoted scalar / inline arrayとし、
複数IDも`["CR-1","CR-2"]`のように`JSON.stringify`と同じ表記にする。
`request_ids`は当該stageのcausal work unitから導いた一意な要求ID、`work_unit_ids`は
`causal_work_unit_ids`そのものをplan順で記録する。direct集合やpacket pathはこのenvelopeへ追加せず、
必要ならdomain eventの別top-level field、`source.txt`、controller stage eventへ記録する。

verified owner ledgerで`applied`となったwork unitが生成・変更したREQ/SPECだけに
`feedback_source: {feedback_request_id, work_unit_ids}`を付ける。
`merged / deferred / rejected`と既存無変更entryへcurrent runのmarkerを付けない。
caller指定のexclude listは使わず、persist済みcontroller eventのowner ledgerをfinal verifierが再導出する。
packetのCR本文は複製せず、eventからrequest → work unit → REQ/SPEC → RDRA差分を逆引きできる状態にする。

## Feedback controller checkpoint

成功時の`work_unit_results`はdirect集合、`reconciliation_results`はcausal集合をplan順でexactly once覆う。

requirementsのnormal RDRA eventは`event.json` member manifestで全sibling member path/SHA-256をexactに列挙する。

changedが0件なら`rdra/events`と`usdm/events`の各rootへ`feedback-disposition.json`だけのeventを追記し、latestを変更しない。

`applied`があればcurrent normal `usdm/events/{event_id}/requirements.yaml`をexact 1件参照する。

full verifierはpersist済みowner ledger、requirements full schema、directory/event ID、current lineageを結合して検証する。

feedback requirements eventは増分documentである。

event内の各top-level REQ subtreeは、REQ自身または子SPECにcurrent-run markerを1件以上持つ。

同じUSDM event集合を観測する場合は`usdm/latest/requirements.yaml`も検証する。

event内の各top-level REQ subtree全体を、REQ ID単位でlatestの同ID subtreeへexact一致させる。

latest側だけに存在するhistoric REQは許容するが、current-run markerを持つ余分なREQは拒否する。

USDM merge規則に従い、eventとlatestの`system_name`もexact一致させる。

event追加を伴わないlatest差分は拒否する。

後続runでUSDM event集合とheadが進んだ場合だけhistorical projection検査を省略する。

`validateRequirements.js --feedback-stage-event`の結果は生成中のpreflightであり、final acceptanceではない。

controllerは`created_at / run_id / attempt / post_execution_basis`をartifact rootから内部実測する。

failed時は`work_unit_results / reconciliation_results / work_unit_evidence_refs / domain_event_refs`を空配列にする。

本パイプラインでは、変更を「イベント」として記録し、「スナップショット」を逐次更新する方式を採用する。

## 基本概念

```
events/        — 変更差分の履歴（追記のみ、不変）
latest/        — 現在の最新状態（スナップショット）
```

- `events/` 配下のファイルは一度書き込んだら変更・削除しない（イミュータブル）
- `latest/` は `events/` を順に適用した結果と常に一致する
- 新しい変更は必ず `events/` にイベントとして記録してから `latest/` を更新する

## ディレクトリ構成

```
docs/
  usdm/
    events/{event_id}/requirements.yaml
    latest/requirements.yaml
  rdra/
    events/{event_id}/*.tsv
    latest/*.tsv
  specs/
    events/{event_id}/{UC名}/spec.md, tier-*.md
    latest/{UC名}/spec.md, tier-*.md
```

## イベント ID

- 形式: `{YYYYMMDD_HHMMSS}_{変更名}`
- **日時部分は `date '+%Y%m%d_%H%M%S'` コマンドで取得する。LLM が日時を推測してはならない**
- `created_at` 等のタイムスタンプも `date '+%Y-%m-%dT%H:%M:%S'` コマンドで取得する
- 変更名は変更内容を表す短い snake_case の名前
- 同一タイムスタンプが衝突する場合は秒を +1 する
- 例: `20260326_143000_add_reservation_feature`

## イベントの構成

各イベントディレクトリには、その変更で **追加・変更・削除されたファイルのみ** を含める。

### USDM イベント

```
docs/usdm/events/{event_id}/
  requirements.yaml    # この変更で追加された要求・仕様
  source.txt           # 元の変更要望テキスト
```

### RDRA イベント

```
docs/rdra/events/{event_id}/
  アクター.tsv          # 変更があった TSV のみ
  情報.tsv              # 変更がなければ含めない
  _changes.md           # 変更サマリ（何を追加/変更/削除したか）
```

`_changes.md` は以下の形式:

```markdown
# 変更サマリ

- event_id: {event_id}
- 元USDM: {usdm_event_id}

## 追加
- 情報: 予約情報（属性: 予約ID, 予約日時, 利用者, 会議室）

## 変更
- BUC: 会議室予約管理 → UC「予約確認」を追加

## 削除
- なし
```

### Spec イベント

```
docs/specs/events/{event_id}/
  {UC名}/
    spec.md              # UC の仕様
    tier-frontend.md     # フロントエンド仕様
    tier-backend.md      # バックエンド仕様
    tier-infra.md        # インフラ仕様（必要な場合）
```

## スナップショット更新ルール

### USDM スナップショット

- `latest/requirements.yaml` に新しい要求を追記（マージ）する
- 既存要求の変更は ID で照合し上書き
- 削除された要求は `status: deleted` をマークする（物理削除しない）

### RDRA スナップショット

- イベントの TSV はまずステージング（`_rdra_staging/`）に行単位でマージし、整合性 lint
  （`generateRdraMd.js --lint`）に合格してから latest に反映する（lint エラー時はイベント側を修正して再マージ）
- マージキー: 各 TSV の最初の意味のあるカラム（アクター名、情報名、BUC名など）
- 追加行: latest に存在しないキーの行を末尾に追加
- 変更行: 同一キーの行をイベント側の内容で上書き
- 削除行: `_changes.md` に削除と記載された要素の行を latest から除去
- latest 確定後、関連データ生成スクリプト（makeGraphData.js, makeZeroOneData.js）と RDRA ビュー生成スクリプト（generateRdraMd.js）を再実行

### Spec スナップショット

- `latest/{UC名}/` 配下を丸ごとイベント側の内容で上書き
- 新規 UC はディレクトリごと追加
- 削除された UC はディレクトリごと除去

## 初期構築時の扱い

`docs/rdra/latest/` が空（または存在しない）場合は初期構築モードとなる:

1. 既存の `rdra` スキル（Phase1-5）でフルビルドを実行
2. 結果の `1_RDRA/*.tsv` を `docs/rdra/latest/` にコピー
3. 初期構築もイベントとして `docs/rdra/events/{event_id}/` に記録する（全ファイルを含む）

## 注意事項

- イベントは時系列順に適用すること（event_id のソートで時系列が保証される）
- latest/ のファイルを直接手動編集した場合、events/ との整合性が崩れる — その場合は手動編集もイベントとして記録する
- 関連データ生成（makeGraphData.js, makeZeroOneData.js）と RDRA ビュー生成（generateRdraMd.js）はスナップショット更新後に毎回実行する
