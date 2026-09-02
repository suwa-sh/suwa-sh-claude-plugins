# アーキテクチャ設計 YAML スキーマ定義

RDRA モデルと NFR グレードから推論したアーキテクチャ設計を YAML 形式で管理するスキーマ。
全てのテクノロジー記述はベンダーニュートラル（FaaS, CaaS(k8s), RDB, KVS 等）とし、特定クラウドベンダーのサービス名は使用しない。

## 目次（セクション別ファイル）

スキーマはセクションごとに分割されている。**推論 subagent は自分の Part に対応するファイルと `common.md` だけを読む**。
Step3 の出力 subagent は出力対象セクションのファイル + `common.md` を読む（domain 無しモードでは `domain.md` を読まない）。

| ファイル | 内容 |
|---------|------|
| `references/schema/common.md` | トップレベル / technology_context の YAML 例と説明、Policy / Rule（共通構造）、ID プレフィックス体系、confidence 値、ベンダーニュートラル用語ガイド、ディレクトリ配置、決定記録スキーマ、スクリプト実装メモ |
| `references/schema/domain.md` | domain_architecture（optional）: Subdomain / BoundedContext / UbiquitousLanguageEntry / ContextMapRelation / AggregateHypothesis |
| `references/schema/system.md` | system_architecture: Tier / cross_tier_policies / cross_tier_rules |
| `references/schema/app.md` | app_architecture: TierLayer / Layer |
| `references/schema/data.md` | data_architecture: Entity / Attribute / Relationship / StorageMapping |

`arch-design.yaml` 全体の YAML 例は各ファイルの「YAML 例」を上から順に連結したもの（version / event_id / created_at / source →
technology_context → domain_architecture → system_architecture → app_architecture → data_architecture）。
分割書き出し（`arch-design.parts/`）の並び順も同じ。
