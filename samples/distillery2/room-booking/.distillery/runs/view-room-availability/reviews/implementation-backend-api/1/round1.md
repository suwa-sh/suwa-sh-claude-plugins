| # | 観点 | 判定 | 該当指摘 | 一言根拠 |
|---|------|------|---------|---------|
| P1 | シナリオと契約との縦の整合 | PASS | — | 照会の入力、200 応答、400・401・422・500 の扱いを feature と OpenAPI に照合し、閾値以上の差は見つからなかった |
| P2 | ルールと ADR | CONCERN | 指摘 1 | ADR 0011 が求める社員 ID が、認証済み要求の開始ログに入らない |
| P3 | ティアどうしの横の整合 | PASS | — | 対象の API 応答項目とエラーコードを、画面・usecase・DB 側の扱いに照合した |
| P4 | 補った前提 | PASS | — | 日時の精度、エラー理由、認証順序について、閾値以上の矛盾は見つからなかった |

### 指摘 1
- **perspective**: P2
- **対象**: `apps/backend-api/src/presentation/httpApp.ts:68`
- **severity**: medium
- **claim**: 認証済みの要求でも、要求開始ログに社員 ID が記録されない。
- **evidence**: 開始ログはトークン検証前の行 68–71 で出され、fields に `employeeId` がない。社員 ID は行 99–104 で確定し、終了ログには行 77 で記録される。`docs/adr/0011-logging.md:14` は、社員を特定できる要求のログに社員 ID を持たせると定める。
- **why_raised**: 認証済み社員の要求を開始ログから調査・集計する際、社員 ID で直接追えず、終了ログとの相関 ID による突き合わせが必要になる。
- **suggested_fix**: 認証後に社員 ID を含む開始ログを出す。認証失敗の要求についても開始ログを残せるよう、ログを出す位置と内容を整理する。

### below-threshold
- P1 low `timeRangeRequest.ts:10` は RFC 3339 で許されるうるう秒 `:60` を形式エラーにするが、該当する日時は限定的。
- P4 low `businessError.ts:18` の `reason?` はコードとの対応を型で制約しないが、現行の domain は対応した値を返している。

Codex session ID: 01a1c388-51f6-7e40-8912-94003cb7546e
Resume in Codex: codex resume 01a1c388-51f6-7e40-8912-94003cb7546e
