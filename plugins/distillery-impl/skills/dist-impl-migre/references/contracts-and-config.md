# 契約と設定の移行

生成済みの実装リポジトリに新bootstrapを全面適用しない。
現物と移行先の[契約レジストリ](../../dist-impl-bootstrap/references/contract-registry.md)、[状態スキーマ](../../dist-impl-run/references/state-schema.md)を比較する。

## UC-CONTRACT-SLICE — 0.13.2

| 判断対象 | 修正・確認 |
|---|---|
| summaryがv2 | 型・制約はUCの_contract-slice.jsonから読み、実ファイルとsummaryのSHA-256を照合する |
| manifest | 対象UCのslice path/hashを現行read-setに含める。providesだけでなくconsumesも確認する |
| contracts.lock | 各契約のsource、input hash、generated audience/lang、source_read、scopeを現物に合わせる |
| 縮退codegen | v2 summaryの名前だけから型を復元せず、検証したsliceから生成する。欠落をlegacyとして補わない |

lockのschema_versionとplugin版を混同しない。旧lockからの移行は状態スキーマの既存手順に従う。
生成物を作り直していないのにinput hashや生成時刻だけ更新しない。

## LATEST-HTTP-SOURCE — 0.13.3

catalogのopenapiが入口文字列なら、実装側のsourceは`_cross-cutting/api/generated/openapi.bundle.yaml`。
入口はcatalog値をapiディレクトリ相対で解決し、入口・到達する分割正本・bundleを変更検知へ含める。
Distillery側の対象版compileContracts `--check`で正本との一致を確認する。検証手段が未導入なら依存を解決し、未検証のまま代替契約を生成しない。
bundleが無い・古い場合に、残っている旧単一ファイルを採用して検証を迂回しない。

## ASYNC-RDB-SOURCE — 0.13.4

| 形式 | 実装側の扱い |
|---|---|
| 分割AsyncAPI | generated/asyncapi.bundle.yamlをsourceにし、入口と参照ファイルも変更検知する |
| 分割RDB | datastore/generated/rdb-schema.bundle.yamlをcodegen入力にする。入口・domain正本・bundleの整合を確認する |
| legacyまたは対象なし | 現物とレジストリに沿って維持する。存在しない契約を新規作成しない |

codegenは既存の言語・provider/consumer・scopeを保持する。生成した型・client・stubと利用側コードの互換性を確認する。
FK参照キーだけを含むsliceを完全な外部tableのrow型やDDLに使わない。

## RDB-OWNER-READ — 0.13.5

入口 → generated/table-index.yaml → 対象domain slice → 必要な外部列・制約の順で読む。
_model-summaryの取得列・更新列・whereと所有tableを照合する。文書のdomain分割を物理DBの再構成に置き換えない。

## API-SOURCE-PROBE — 0.13.7

古いbootstrapがapi/asyncapi.yamlだけを探してhas_asyncapiをfalseとしていないか、capabilityと入力存在フラグを確認する。
現在のcatalogから形式を判定し、レジストリで選んだsourceの実在をprobeする。
設定値をtrueへ書き換えるだけで完了しない。sourceの鮮度、契約宣言、生成物と影響するPhaseを再評価する。

## 再生成とコードへの反映

まず変更対象だけを作業場所で生成し、既存生成物と比較する。
手編集された生成物・wrapper・追加テストがあれば内容を保持できる統合方法を選ぶ。無条件に削除しない。
移行に必要なimport・型・接続の修正を行い、対象tierの型検査・テストを実施する。
UCの業務挙動や公開API自体を変える必要があれば、移行の構造変更と区別して問題・提案として記録する。
