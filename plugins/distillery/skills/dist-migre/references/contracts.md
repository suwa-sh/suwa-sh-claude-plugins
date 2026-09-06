# 契約の変更点

実装に必要な型・制約・認可・エラー・送受信・DB操作を保持する。
各項目の導入版より後の構成は、移行先にも含まれる場合に適用する。
最新出力の詳細は[dist-specの契約ガイド](../../dist-spec/references/specs/contract-catalog.md)と[RDBガイド](../../dist-spec/references/specs/progressive-rdb-schema.md)を参照する。

## API-CATALOG — 1.10.0

| 観点 | ガイド |
|---|---|
| 判断 | API全体、UCのsummary、tier本文の定義を突合し、どれに固有の情報があるか調べる |
| 修正 | `_cross-cutting/api/contracts.json`へネイティブ契約と全UCのprovides/consumesを記録する。操作の提供者と利用者をLLMが業務・tierから確認する |
| 確認 | method/path、operationId、型・required・format・範囲、security、全response、非同期payload/headerを旧版と比較する |

この版のcatalogはOpenAPI/AsyncAPI文書の埋め込み形式を使える。後続版では分割入口を指す。
`compileContracts.js`でsummary v2と`_contract-slice.json`を生成する。summaryは索引であり型の正本ではない。
操作IDの重複、所有UCの不明、旧資料間の不一致はLLMが差分として説明し、推測で解消しない。

## HTTP-SPLIT — 1.11.0

- OpenAPI文書を、編集入口・Path Item・componentsに分ける。共通定義を複数のUCへ複写しない。
- catalogの`openapi`は入口を指す文字列にする。非対象のAPIは`null`を維持する。
- 1.11.0時点の入口は`api/openapi.yaml`。1.13.6以降への移行ではAPI-DIRECTORIESも適用する。
- 旧ファイルが生成manifestで追跡されている場合、手編集する正本へ変えたファイルが自動削除されないよう、契約ガイドの移行手順に従ってmanifestを調整する。
- bundle生成後、旧統合契約と意味が等しいことを確認する。構造変更による内部`$ref`名の変化は、解決先の型・制約・操作を比較して判断する。

## ASYNC-RDB-SPLIT — 1.12.0

| 対象 | 修正 | 確認 |
|---|---|---|
| AsyncAPI | 入口・operations・channels・messages・schemasを分割し、catalogに入口を記録 | operationのaction/channel/messages、server、payload/header、bindingを保持する |
| RDB | arch latestで所有サブドメインを確認し、`rdb-schema.yaml`を`distillery.rdb-split/v1`の索引とdomain正本に分ける | 全table・column・PK・FK・index・制約を保持し、サブドメイン横断FKを解決できる |

1.12.0時点のAsyncAPI入口は`api/asyncapi.yaml`。1.13.6以降はAPI-DIRECTORIESも適用する。
RDBのdomain分割は文書の所有境界。物理DB・トランザクション境界を新たに分けない。
所有が分からないテーブルは名前で推測せず、archへの照会・提案として記録する。
外部表の参照キーだけを含むsliceを、完全な外部表のrow型やDDLとして使わない。

## RDB-OWNER-INDEX — 1.12.1

入口から`generated/table-index.yaml`の所有索引、対象domain slice、必要な外部列・制約へ辿る構造を確認する。
`compileRdbSchema.js`で索引と派生物を再生成する。UCの`_model-summary.yaml`の取得列・更新列・whereが実在する定義に対応するか確認する。
索引化だけを理由にUC固有の操作条件を削除しない。

## API-DIRECTORIES — 1.13.6

| 編集対象 | 移行後の場所（api相対） |
|---|---|
| OpenAPI入口 | `openapi/openapi.yaml` |
| HTTP Path Item・components | `openapi/paths/`、`openapi/components/` |
| AsyncAPI入口 | `asyncapi/asyncapi.yaml` |
| 非同期操作・channel・components | `asyncapi/operations/`、`asyncapi/channels/`、`asyncapi/components/` |
| 表示・codegen用bundle | `generated/openapi.bundle.yaml`、`generated/asyncapi.bundle.yaml` |

1. 各入口から`$ref`を辿り、ファイルの所属を確認する。ファイル名や共通フォルダ名だけで振り分けない。
2. 両契約から参照されるファイルがあれば、定義を比較して所有方法を決める。無条件の複製や片側の削除を避け、判断理由を残す。
3. 編集ファイルと相対`$ref`、catalogの入口、UC/tier/README/還流要求等の現在の参照を更新する。過去イベントのリンクは変更しない。
4. bundleとsliceを再生成し、操作・型・制約が移動前と一致するか確認する。リンク切れも確認する。

## dist-implへの接続

実装出力の移行は`distillery-impl:dist-impl-migre`へ引き継ぐ。本スキルは移行したspec・契約・未解決項目を示し、実装側のconfig・lock・codegen・stage状態を変更しない。
後段では、実際の最新版規約に従ってbundle・UC slice・RDB・Storybookへの接続を確認する。
両方の移行を依頼されている場合は本スキル完了後に実行する。前段が未完了の範囲を実装可能な確定仕様として渡さない。
