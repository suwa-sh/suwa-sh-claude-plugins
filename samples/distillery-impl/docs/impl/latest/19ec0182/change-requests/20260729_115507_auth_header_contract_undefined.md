---
source: distillery-impl
uc_id: "19ec0182"
business: "貸出管理業務"
buc: "貸出管理フロー"
uc: "書籍を貸出する"
discovered_at_stage: "S4 tier-impl (tier-backend-api) / S5 verify attempt-1〜3 (security)"
related_ids: [REQ-002, SPEC-002-01]
related_files:
  - "docs/specs/latest/貸出管理業務/貸出管理フロー/書籍を貸出する/tier-backend-api.md"
  - "docs/specs/latest/貸出管理業務/貸出管理フロー/書籍を貸出する/tier-frontend.md"
  - "docs/specs/latest/貸出管理業務/貸出管理フロー/書籍を貸出する/_api-summary.yaml"
  - "nfr/latest/nfr-grade.yaml"
severity: spec-gap
---

# 変更要望: 認証(OAuth2/OIDC)の実装契約(ヘッダ・401応答)が仕様に未定義

## 現状の仕様

- `tier-backend-api.md` 13行: 認証は「OAuth2/OIDC (利用者ロール)」とだけ記載され、リソースサーバーが
  実際にどうトークンを受け取るか(ヘッダ名・claim名)の記載が無い。
- `tier-backend-api.md` のエラーレスポンス表(35-40行)には 400/404/409 のみが列挙され、
  「トークン欠落・不正」時の応答(401想定)が記載されていない。
- `_api-summary.yaml` の `CreateLoanRequest` スキーマに認証ヘッダの定義が無い。
- `nfr/latest/nfr-grade.yaml` E.5.2.1(827-834行)はロールベースアクセス制御(RBAC)を grade 2 で
  要求しているが、ロールをどう表現するか(claim名、値の集合)は仕様のどこにも定義が無い。

## 実装で判明した問題

- 認証基盤(OAuth2/OIDCのリソースサーバー検証)tier がこのリポジトリ・仕様のいずれにも存在しないため、
  backend-api は `X-User-Id` ヘッダの値をそのまま利用者IDとして信用する仮実装とした
  (`backend-api/src/http/server.ts:77`)。S5 verify は attempt-1〜3 いずれも security 観点で
  major finding(なりすまし可能・RBAC未実装)として継続追跡している。
- frontend の `LoanConfirmationApiClient`(`createLoan`/`getBook`)は `X-User-Id` ヘッダを一切送信しない。
  `_api-summary.yaml`/`tier-frontend.md` のいずれにもこのヘッダの契約が無いため、frontend 側は
  自身が参照すべき契約には違反していない(S5 attempt-3 tier-frontend F-004参照)。
- 結果として「予約確保済の予約者本人による貸出」シナリオは実運用導線では成立せず(空文字列 userId のまま
  予約者本人判定に失敗し409になる)、S6/S7の統合テストではオーケストレータのユーザー確定方針
  「ハーネス注入を許容」に従い `features/uc/steps/19ec0182.steps.ts` 等のテストコード側で
  `X-User-Id` を注入することでゲートを通過させた(本番導線には存在しない迂回)。

根拠: `docs/impl/latest/19ec0182/issues/20260729_011215_auth_and_missing_header_gap.md`,
`docs/impl/latest/19ec0182/stages/attempt-3/S5_verify.tier-frontend.findings.yaml`(F-004)

## 提案する変更

1. 認証基盤tierが用意されるまでの間の暫定契約として、利用者IDをどのヘッダ/claimで受け渡すかを
   `_api-summary.yaml`(または `_cross-cutting` の認証仕様)に機械可読で明記する
   (例: 暫定的に `X-User-Id` ヘッダを正式な契約として定義するか、認証基盤設計を先行させる)。
2. エラーレスポンス表に 401(トークン欠落/不正)の行を追加する。
3. frontend の API クライアント(`loanConfirmationApiClient.ts` 等)が認証情報をどう送信すべきかを
   `tier-frontend.md` に明記し、backend 側の契約と一致させる。

## 影響範囲

- 状態変更を伴う全UC(貸出・返却・予約作成・予約キャンセル等)が同じ認証未定義の影響を受ける可能性が高い。
- 対象パイプライン: dist-spec(`tier-backend-api.md`/`tier-frontend.md`/`_api-summary.yaml` の認証記載)。
