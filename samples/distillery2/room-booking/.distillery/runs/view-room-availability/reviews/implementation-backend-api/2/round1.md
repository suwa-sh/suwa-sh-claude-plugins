| # | 観点 | 判定 | 該当指摘 | 一言根拠 |
|---|------|------|---------|---------|
| P1 | シナリオと契約との縦の整合 | PASS | — | 照会の入力、認証、200・400・401・422・500 応答を feature と OpenAPI に照合した |
| P2 | ルールと ADR | CONCERN | 指摘 1 | 未定義の経路では、ADR 0011 が必須とするハンドラ名がログから欠ける |
| P3 | ティアどうしの横の整合 | PASS | — | 画面からの日時とエラーコード、API 応答と usecase・repository の項目を照合した |
| P4 | 補った前提 | PASS | — | 日時の精度、認証順序、エラー理由の扱いに閾値以上の矛盾は見つからなかった |

### 指摘 1
- **perspective**: P2
- **対象**: `apps/backend-api/src/presentation/httpApp.ts:53–57, 83–101`
- **severity**: medium
- **claim**: 未定義の経路への要求では、開始・終了ログのハンドラ名が欠ける。
- **evidence**: `handlerOf` は契約に一致する method と path がなければ `undefined` を返す。その値を開始・終了ログの `handler` にそのまま渡している。`docs/adr/0011-logging.md:14` はログにハンドラ名を必ず持たせると定める。
- **why_raised**: 誤った経路への要求や探索的なアクセスをログから調査・集計する際、ハンドラ名で分類できない。
- **suggested_fix**: 契約に一致しない要求にも、未定義経路を示す一定のハンドラ名を記録する。

### below-threshold

なし。

Codex session ID: 01a1c3a5-013a-7021-9fc6-5b1f6deb203b
Resume in Codex: codex resume 01a1c3a5-013a-7021-9fc6-5b1f6deb203b
