# 0.1.16 の再実走 (段階④ だけ) で見つかった課題

2026-09-26 に `/private/tmp/distillery2-run3/` (0.1.13 のフル実走の続き。貸出 UC は main に取り込み済み) で、0.1.16 を使って
2 つ目の UC「返却を登録する」の縦切りだけを headless 実走した結果。claude-opus-5-5 (`--model` 明示)。

## 結果

| 項目 | 値 |
|---|---|
| 所要時間 | 42 分 (0.1.13 の貸出 UC は 53 分。今回は差し戻しなし) |
| ゲート | static (qlty 含む) / unit / contract / uc-bdd / acceptance すべて pass。contract は提供側 backend-api だけ (frontend は skipped) |
| findings (attempt 1) | blocker 0 / major 5 / minor 16。差し戻しなし |
| AssumptionRecord | 16 件 (backend-api 9 / frontend 7)。confirmed 5 / auto 11 |
| Verifier | 報告 1 行目 `model: claude-opus-5-5` (実装役と同じ。方針どおり止めずに進めた) |
| squash | `feat: 返却を登録する` 1 commit。trailer に Basis-Base / Basis-Changed / Co-Authored-By |
| as-built | 2 UC 分 (貸出・返却) が `_system/` にまとまる。checkAsBuilt ok、計装なし / 正常系に部品なしのティアは無し |

## 0.1.14〜0.1.16 の新機能の確認結果

| 機能 | 結果 |
|---|---|
| 契約テストの要求ヘッダ (0.1.16) | 契約に `x-test-headers` (Authorization / Idempotency-Key `{uuid}`) と 401 / 403 の `x-headers` を書き、生成テストがヘッダを送った。提供側のテスト専用ヘッダ補完は削除され、401 のテストが pass |
| `extractAsBuilt --dry-run` (0.1.16) | integrate で使われ、`docs/as-built` を書かなかった |
| `genQlty --refresh` (0.1.14) | integrate で osv-scanner が追加された (lockfile が揃った後に提案が増えた) |
| Verifier の方針 (0.1.16) | 同じモデル ID でも止まらず、`models_resolved` を ID で記録し直した |
| `--tiers` 付きの runGates (0.1.15) | UC に関与しない worker で落ちなかった |

## 新しい気づき

| # | 内容 | 対応 |
|---|---|---|
| 1 | tier 段階の書き込み範囲 (write-set) に `<run>/reports/` が無く、実装者が記録付きで static / unit を回せない (オーケストレータが代行) | 未対応 |
| 2 | scaffold の書き込み範囲に `*.test.ts` 以外が無く、frontend の入口スタブを置けない (`@vite-ignore` の動的 import で回避) | 未対応 |
| 3 | エラーコードの enum を足すと他の UC の契約テスト (`registerLoan.test.ts`) も再生成され、この UC の branch に他 UC の差分が混ざる | 未対応 (仕様どおりだが、報告で目立たせる) |
| 4 | feedback の完了条件「全課題が PR か issue」が headless (push 不可) で満たせない (`status: deferred` で保留) | 未対応 (0.1.13 ④-7 と同根) |
| 5 | branch の開始条件「upstream と HEAD が一致」に、リモートが無いリポの扱いが無い | 未対応 |
| 6 | 実装者の判断で前の UC の振る舞い (403 を 400 より先に返す、エラー文言) も変わった。UC の branch で他 UC の振る舞いが変わることを目立たせる仕組みが無い | 未対応 |
| 7 | 承認の補助スクリプトを `.js` で書き、`"type":"module"` のリポで ESM として読まれ失敗。`| cut` で終了コードが隠れ、review の完了記録とコミットが走った (invalidate で復旧) | TROUBLESHOOTING.md に追記 |
| 8 | headless で `shasum` が承認待ちで止まる (node の crypto で代替) | TROUBLESHOOTING.md に追記 |

## 要求起因の課題 (報告のみ)

- 貸出中でない書籍の返却の扱いが要求に無い (409 を採用)
- 画面の見本にある「返却前の貸出の表」「書籍名」を出せる契約が無い (暫定で書籍 ID 表示)
