# 移行の進め方と記録

## 作業単位

既存の作業ブランチがあれば使い、なければ移行用の作業場所を分ける。
原本のイベントは保持する。相対参照を検証できるよう、出力ルート全体のディレクトリ関係を維持した作業コピーで編集する。
元の`latest/`を作業コピーへ取り込む前に差分の有無を確認し、未コミットのユーザー変更を基点へ含める。
既存のmigration recordがある場合は、その記録と現在のファイル内容を照合して再開する。

## 計画と判定

`{output_root}/migrations/{run_id}/`へ計画・検証結果・結果要約を記録する。
`run_id`は時刻等で重複を避ける。業務specの概要・本文へ移行作業の説明を混ぜない。

| 記録 | 内容 |
|---|---|
| `plan.md` | 元版・先版と根拠、対象範囲、選んだガイド、影響ファイル、修正方針、各項目の判定 |
| `checks.md` | 旧記載と新しい正本の対応、実行した検査と結果、意味の比較、未実施の検査 |
| `result.yaml` | 下記の再開・報告用情報 |

項目ごとの判定は、適用予定・適用済み・適合済み・対象外・要確認のいずれか。
適合済みと対象外には現物の根拠を付ける。入力の版だけを根拠にスキップしない。
依存する正本が要確認なら、その正本の完成を前提にした削除や完了判定を先行しない。

```yaml
migration_schema: distillery.migration/v1
from_version: "1.13.5"
to_version: "1.14.0"
version_evidence: ユーザー指定と生成記録を照合
scope: specs/latest と現在の参照リンク
status: in_progress
steps:
  - id: API-DIRECTORIES
    status: planned
    evidence: plan.md
changed_files: []
checks: checks.md
new_events: []
unresolved: []
```

全体statusは`in_progress`、`needs_input`、`completed`。step statusは`planned`、`applied`、`already_compatible`、`not_applicable`、`needs_input`。
`completed`は全対象項目を検証できた場合だけ。移行元の版情報を先に移行先へ書き換えない。
再実行では`applied`の記録だけを信用せず、現物を確認する。既に整合している成果物を再生成し続けない。

## 検証

選んだガイドに応じて、対象版に付属する以下の検証手段を使う。各スクリプトのCLIを確認して実行する。

| 対象 | 検証手段 | LLMが追加で確認する意味 |
|---|---|---|
| API | dist-specのcompileContracts `--check`、summary/slice照合 | 操作・型・制約・認可・失敗結果の保持 |
| RDB | compileRdbSchema `--check`、モデル参照の照合 | テーブル所有と取得・更新列・条件の保持 |
| spec | validateSpecEvent、UCごとのvalidateSpecProse | 業務挙動と受入条件、参照したlatest定義の一致 |
| 派生ビュー | 再生成結果と元の要素・件数の比較 | 対応記録を捏造していないこと |
| 全体 | 相対リンク、ID、Story/exportの実在確認 | リンク先だけで必要な情報が取得できること |

構造検査だけ通った場合は、意味の確認が完了するまで移行完了としない。
検証用依存が不足する場合は環境を用意するか未実施として報告し、検証したことにしない。

## イベントとlatest

変更対象domainの既存イベント方式を読む。specの変更ならdist-specの[イベント規約](../../dist-spec/references/event-sourcing-rules.md)と[スナップショット更新](../../dist-spec/references/specs/spec-snapshot-update.md)に従い、新しいイベントを追記する。
新イベントから再現できる変更ファイルと削除一覧を記録する。旧構成の不要ファイルがlatestに残らないことも確認する。
生成物のメタデータはそのdomainのschemaに従う。migration recordの版とイベントschemaの版を混同しない。
検証済みの新イベントからlatestを更新し、過去のイベント本文を上書きしない。

上流への提案が必要なら、具体的な差分と完了条件を現在のfeedback request形式で記録する。
既に許可された範囲でpipelineへ還流できる場合は実行し、戻ったlatestと再照合する。未採用・未解消の項目は`unresolved`へ残す。
アプリの実装・デプロイ・Gitマージ・公開は、別途依頼されている場合に実施する。

完了時は変更した成果物とその意味、参照先へ移した情報、適用しなかった項目、検証範囲と残課題を短く報告する。

実装側の移行を続ける場合は、この記録のパス・変更したlatest・未解決項目をdist-impl-migreへ渡す。実装側の版はdistillery-impl自身から独立に判定する。
