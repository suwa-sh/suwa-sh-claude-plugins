---
name: distillery-impl:dist-impl-migre
description: >
  古いdistillery-implで作成した実装出力を、インストール済みの新版へ移行する。
  バージョン間の変更ガイドを選び、LLMが設定・契約生成物・実行状態・既存コードを確認して修正・検証する。
  「dist-implの出力を新版へ移行」「dist-impl-migre」で使う。
  pluginのインストール更新、アプリDBのデータ移行、新規UCの実装とは区別する。
---

# dist-impl-migre

旧版で実施したoutputが残り、skillsだけが新版に差し替わっている状態から使う。
変更ポイントをガイドとしてLLMが現物を比較・修正する。機械的な一括変換は行わない。

## 入力を確認する

| 入力 | 確認方法 |
|---|---|
| 実装ルート | `docs/impl/`、`docs/dev-rules/`、tierのコード・テスト・生成物を含む場所。通常は作業リポジトリ |
| 参照する仕様 | 既存impl-configの`specs_root`を解決し、実際の`specs/latest`等を確認する |
| 移行元の版 | 生成時のplugin version、過去の移行記録、ユーザー指定を現物と照合する |
| 移行先の版 | 実行中pluginの`${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json`から読み取る |
| 対象範囲 | 全体または指定UC。既存コード・ユーザー編集・中断中runの状態を含めて確認する |

成果物の`schema_version`や現在のplugin版から移行元を推測しない。
移行元を特定できなければ現物調査と候補を示して確認する。独立した調査は続け、版を未確定のまま移行完了にしない。
通常、ユーザーによる移行先版の指定は不要。別の版を明示された場合、その版のplugin資材を使えるかを確認し、現在の規約で代替しない。

## 実行

1. `references/migration-catalog.md`で元版より後、先版以下の変更点を選び、該当ガイドだけを読む。版はmajor/minor/patchの数値で比較する。
2. `references/spec-handoff.md`に従い、現在のspecと前回入力との差分も調べる。plugin更新による変更とspec変更による影響を区別する。
3. `references/execution-and-records.md`に従い、影響ファイル、修正方針、保持対象、再検証範囲を計画して説明する。
   移行実施を依頼されている場合は計画説明だけを理由に再承認を求めない。計画だけの依頼ではoutputを変更しない。
4. LLMが対象ガイドに沿って設定・参照・生成物・必要な接続コードを修正する。既存実装を新規bootstrapで上書きしない。
   旧情報と新しい正本が矛盾する場合は具体的な差分を記録する。推測で業務仕様を変えない。
5. `references/state-and-code.md`に従い、入力の鮮度、完了判定、承認証跡を再評価する。必要な検証を実行して、保持・無効化・再実行待ちを記録する。
6. 適用した変更、検証結果、残課題、次に再開するstageを報告する。移行完了とアプリ実装・レビューの完了を区別する。

両方の出力を新版へ移行する場合は、`distillery:dist-migre` → 本スキルの順に使う。
前段が既に対応済みなら再実行を要求せず現物を検証する。本スキルからspecを黙って書き換えない。

```text
/distillery-impl:dist-impl-migre この実装リポジトリを現在のスキルに合わせて移行して
/distillery-impl:dist-impl-migre この実装出力の移行計画だけ作って
```

将来の版を追加するときだけ `references/maintaining-guides.md` を読む。
