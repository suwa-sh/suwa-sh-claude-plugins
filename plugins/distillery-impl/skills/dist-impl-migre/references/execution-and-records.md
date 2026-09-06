# 実行と記録

## 着手

1. 実装ルート、現在のspecs_root、移行元の版と根拠、実行中pluginの版を確認する。
2. 作業ブランチまたは分離したコピーを使い、ユーザーの未コミット変更も保持する。未追跡コードも移行前の現物として扱う。
3. 対象ガイドを選び、現物を読んで計画する。最初に計画を説明し、その後に修正する。

plugin本体を更新するスキルではない。インストール済みの資材からガイドを読む。
必要な前段資材が不足していれば所在を確認する。片方のpluginの版からもう片方の版を決めない。

## 記録先

実装ルートの`docs/impl/migrations/{run_id}/`を使う。run_idは時刻等で重複を避ける。

| ファイル | 内容 |
|---|---|
| plan.md | 元版・先版と根拠、specとの接続状況、対象UC/tier、変更点、保持対象、再検証範囲 |
| checks.md | 実行した検査と結果、意味の比較、残した証跡、退避したdone、未実施の検査 |
| result.yaml | 再開と利用者への報告に使う要約 |

```yaml
migration_schema: distillery-impl.migration/v1
from_version: "0.13.6"
to_version: "0.14.0"
version_evidence: 生成記録と現物の照合
specs_root: ../specification/docs
upstream_migration_record: null
status: in_progress
steps:
  - id: API-SOURCE-PROBE
    status: planned
    evidence: plan.md
changed_files: []
invalidated_records: []
checks: checks.md
implementation_validation: pending
next_stages: []
unresolved: []
```

例の版は実行時の記録に置き換える。上流移行記録がない場合はnullとし、specの現物確認をchecksへ記録する。
statusは`in_progress`、`needs_input`、`completed`。
step statusは`planned`、`applied`、`already_compatible`、`not_applicable`、`needs_input`。
implementation_validationは`not_checked`、`pending`、`verified_for_scope`。verifiedは対象範囲の実検査を記録できる場合だけ。

変更ガイドを適用しない項目にも現物の根拠を書く。同版であっても上流変更があれば接続確認を行う。
再開時は記録だけを信用せず、変更ファイル・入力hash・保留事項の現在の状態と照合する。
移行記録の版を更新するだけで、codegenやstage検証を済ませたことにしない。

## 検証と完了

- 指定sourceと生成物、summary/slice、モデル列、Story/exportへの参照を実物で確認する。
- 対象契約の生成・型検査、影響する接続コードのテストを実行する。依存不足や失敗を未解決として残す。
- configとmanifest、lock、doneの鮮度判定を移行先の規約で確認する。
- 履歴と承認を保持し、再実行待ちの範囲を明示する。
- 全S0〜S9やアプリ動作を確認していなければ、その限界を報告する。

移行のためにアプリDBのmigration実行、デプロイ、feedbackの外部送信、Gitマージ・公開を追加しない。
それらや通常runの継続が別途依頼されている場合は、既存の承認・実行規約を維持して行う。
