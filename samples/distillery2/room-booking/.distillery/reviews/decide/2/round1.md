## (1) 観点サマリ表

| # | 観点 | 判定 | 該当指摘 | 一言根拠 |
|---|------|------|---------|---------|
| P1 | 要求との縦の整合 | CONCERN | 指摘 1 | 二重予約と取消の反映が中核要求だが、復旧時に前日のバックアップ以降の変更を失う水準を採用している |
| P2 | ADR どうしの横の整合 | CONCERN | 指摘 2 | 認証 ADR は外部の認証基盤を前提とする一方、ティア構成 ADR と構成図にはその依存が反映されていない |
| P3 | 決めずに残した点 | CONCERN | 指摘 3 | 復旧に許容できる時間とデータ損失量が入力に無いまま、確認事項に返されていない |

## (2) 指摘

### 指摘 1
- **perspective**: P1
- **対象**: [docs/nfr/nfr-grade.md:43](<repo>/docs/nfr/nfr-grade.md:43) A.4.1.1 RPO
- **severity**: high
- **claim**: 「前日の最終バックアップまで」の復旧を許す水準は、予約と取消を正しく反映するという業務の重さに合っていない。
- **evidence**: 原文は二重予約と取消の未反映を解消したいとしている（[docs/input/要望-20261104.md:3](<repo>/docs/input/要望-20261104.md:3)）。NFR は RPO を前日の最終バックアップとし、日次バックアップを定めている（[docs/nfr/nfr-grade.md:75](<repo>/docs/nfr/nfr-grade.md:75)）。
- **why_raised**: バックアップ後に成立した予約や取消が障害で失われると、復旧後の空き表示が実際の利用者の認識と食い違い、同じ部屋を再予約できてしまう。
- **suggested_fix**: 許容できるデータ損失量と、失った予約を照合・復元する手順を決めた上で RPO を設定する。

### 指摘 2
- **perspective**: P2
- **対象**: [docs/adr/0001-tier-structure.md:52](<repo>/docs/adr/0001-tier-structure.md:52)、[docs/adr/architecture.md:9](<repo>/docs/adr/architecture.md:9)
- **severity**: medium
- **claim**: ティア構成 ADR の「外部システムは無い」という前提と、認証 ADR の社内認証基盤への依存が食い違う。決定済みの構成図にも認証基盤が現れない。
- **evidence**: ADR 0001 は外部システムが無いと記す。ADR 0006 は frontend が社内認証基盤からトークンを取得し、backend-api が検証すると決める（[docs/adr/0006-authn-authz.md:31](<repo>/docs/adr/0006-authn-authz.md:31)）。構成図には社員、frontend、backend-api、データストアだけが描かれている。
- **why_raised**: 認証基盤との接続や障害時の依存関係を構成図から読み取れず、ティア構成・認証の決定を基に設計する担当者に影響する。
- **suggested_fix**: ADR 0001 の前提を訂正し、認証基盤と frontend・backend-api の関係を構成図に反映する。

### 指摘 3
- **perspective**: P3
- **対象**: [docs/nfr/nfr-grade.md:43](<repo>/docs/nfr/nfr-grade.md:43) A.4.1.1・A.4.1.2、[docs/adr/_review-summary.md:73](<repo>/docs/adr/_review-summary.md:73)「確認してほしいこと」
- **severity**: medium
- **claim**: 許容するデータ損失量と復旧時間が未確認のまま、RPO「前日の最終バックアップ」、RTO「1営業日以内」と決められている。確認事項には両方の問いがない。
- **evidence**: 要望原文は障害復旧の許容値を指定していない。NFR は上記の値を採用し、RTO の根拠をモデルシステムのデフォルトとしている。確認事項には稼働保証時間の問いはあるが、RPO・RTO の問いはない。
- **why_raised**: 業務担当者が予約の消失や最大1営業日の停止を許容しない場合、バックアップ方式と運用設計を後から変更する必要が生じる。
- **suggested_fix**: 予約・取消を何件または何時間分まで失ってよいか、停止を何時間まで許容するかを確認事項に加える。

## (3) below-threshold

なし。

Codex session ID: 01a1a66c-c31d-7002-945f-ae9c8fc8888c
Resume in Codex: codex resume 01a1a66c-c31d-7002-945f-ae9c8fc8888c
