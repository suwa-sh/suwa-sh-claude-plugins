| # | 観点 | 判定 | 該当指摘 | 一言根拠 |
|---|------|------|---------|---------|
| P1 | 要求との縦の整合 | FAIL | 指摘 1 | 予約の消失を許す復旧水準と、二重予約を防ぐ要求を照合した |
| P2 | ADR どうしの横の整合 | PASS | なし | 有効なティア・認証・データ・テストの ADR と rules を照合し、閾値以上の矛盾は確認しなかった |
| P3 | 決めずに残した点 | CONCERN | 指摘 2 | 認証基盤への未確認の前提と、確認事項の一覧を照合した |

### 指摘 1
- **perspective**: P1
- **対象**: `docs/nfr/nfr-grade.md:43,75`、`docs/adr/0003-datastore-and-migration.md:20`
- **severity**: high
- **claim**: 前日のバックアップまで戻す方針では、障害当日に成立した予約や取消が消える。復旧後の占有表もその状態に戻るため、既に社員へ成立を知らせた枠を別の社員が予約できる。
- **evidence**: NFR は RPO を「前日の最終バックアップまで」、バックアップを日次と定める。ADR 0003 は有効な予約の占有行に対する一意制約で二重予約を防ぐ。要求 `SPEC-002-02` は重なる有効な予約を受け付けないと定める。
- **why_raised**: 日中の障害から復旧した後、失われた予約を持つ社員と新たに予約した社員が同じ会議室を確保したと認識し、要望の中心である二重予約防止が破れる。
- **suggested_fix**: 許容する予約データの損失を確認し、復旧地点を見直す。損失を許すなら、再開前に予約と取消を照合して占有を復元する手順を決める。

### 指摘 2
- **perspective**: P3
- **対象**: `docs/adr/0015-api-access-token-jwt.md:11,51`、`docs/adr/0014-tier-structure-frontend-oidc.md:96`、`docs/adr/_review-summary.md:73-82`
- **severity**: medium
- **claim**: 認証基盤が必要なトークンを発行できるかという低確信の前提は各 ADR に「確認してほしいこと」と記されているが、人に返す確認事項の一覧には載っていない。
- **evidence**: ADR 0015 は API 向け JWT の発行、`sub` と `aud` を未確認の前提とし、満たさなければ方式を置き換えると記す。ADR 0014 は PKCE 対応と ID トークンの `name` を前提とする。`_review-summary.md` の確認事項は OIDC によるログイン可否だけを尋ねている。
- **why_raised**: 確認事項の一覧に沿って回答を集めると、OIDC ログインが可能でも API 向け JWT を発行できない環境を見逃し、採用済みの API 認証方式を実装できなくなる。
- **suggested_fix**: 確認事項の一覧に、PKCE、`name`、API 向け JWT、`sub`、`aud` の提供可否を明示する。

### below-threshold

なし。

Codex session ID: 01a1a6bd-7fd9-7221-af01-d6a3c35e73c7
Resume in Codex: codex resume 01a1a6bd-7fd9-7221-af01-d6a3c35e73c7
