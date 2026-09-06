# dist-impl-migreのガイド選択例

以下は仮想入力に対する移行計画の例です。この実装サンプル全体を新スキルで移行した実績ではありません。

## 通常の使い方

1. 旧版で生成したspec・実装outputを保持してskillsを新版へ差し替える。
2. spec側の移行が必要なら`distillery:dist-migre`を実行する。
3. 実装リポジトリで`distillery-impl:dist-impl-migre`を実行する。

移行先は各pluginのインストール済み版から取得します。移行元は生成記録等から確認します。
記録がない場合は、schema_versionをplugin版と読み替えず、現物調査と利用者への確認を行います。

## 0.13.6から、インストール済み0.14.0へ

仮定: 利用者が元版を0.13.6と指定し、現物にも旧パス固定のhas_asyncapi判定が残っている。
上流は分割済みAsyncAPIのbundleが存在する構成とする。

| 項目 | LLMが行う作業 |
|---|---|
| API-SOURCE-PROBE | catalogとbundleを読み、source選択とcapability・入力存在フラグを再評価する |
| IMPL-MIGRATION-GUIDE | スキル追加自体による生成契約・stage schema変更はないため対象外と記録する |
| 上流specの変更 | 版差分とは別に、既存lock・manifest・実装との接続を比較する |
| 影響する状態 | Phase/tierの依存から再検証範囲を決め、影響のないdone・コード・履歴を保持する |

hashを書き換えるだけで生成・検証済みにはしません。未実施のstageがあれば、移行結果と次の再開範囲を分けて報告します。

## 複数版をまたぐ例

0.12.0から0.14.0なら、[変更ガイド](../../../plugins/distillery-impl/skills/dist-impl-migre/references/migration-catalog.md)の全項目を候補にします。
S4のAssumptionRecordやS9の証跡がない場合は、旧承認を新しい証拠へ後付けせず再検証・再レビュー対象として扱います。
既存コード、ユーザー編集、UC ID、過去event・approvalは保持します。

## 確認範囲

この例はガイド選択と計画の確認用です。codegen、既存アプリの修正、stage再実行、人レビューは実施していません。
