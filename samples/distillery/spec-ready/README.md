# 実装に渡す出力の統合サンプル

貸出登録の業務本文・画面・API・共有DB定義をcatalog modeで接続した修正版。
Codexが既存出力を読み、矛盾を解消した編集例。特定モデルの生成再現ではない。

## 読む順序

1. [spec.md](蔵書利用業務/書籍を貸し出すフロー/貸出を登録する/spec.md): 業務ルール・状態・受入条件。
2. [Frontend](蔵書利用業務/書籍を貸し出すフロー/貸出を登録する/tier-frontend-staff.md): 画面、状態の所有者、送信・再送・再取得。
3. [Backend](蔵書利用業務/書籍を貸し出すフロー/貸出を登録する/tier-backend-api.md): 認証・業務エラー・データ操作への接続。
4. [共有の原子性・再送規則](_cross-cutting/datastore/loan-commit.md): 同一DB取引で貸出と成功応答を保存する手順。
5. [受入確認](_review/implementation-readiness.md): 解消した判断、検証範囲と未実施事項。

## ファイルの役割

| 編集する正本 | 機械生成する出力 |
|---|---|
| UCのspec.md / tier-*.md | BUCのbuc-spec.md（一覧・依存） |
| _model-summary.yaml、共有datastore/とux-ui/ | — |
| [_cross-cutting/api/contracts.json](_cross-cutting/api/contracts.json) | openapi.yaml、各UCの_api-summary.yamlと_contract-slice.json、build manifest |
| 選択したRDRA条件、各UCの_trace-links.json | traceability-index.json / traceability-matrix.md |

summaryは型を再定義しない索引。sliceはそのUCが使うAPIと参照先の完全な定義。
貸出登録のsliceにはcreateLoanと照会3操作が入るので、実装者は元の巨大なOpenAPIを探し回る必要がない。
業務ルールはspec.md、障害回復は共有規則、型はcontracts.jsonに一度だけ書く。

## 対象範囲

受入対象は貸出登録1UC。貸出可否・書籍詳細・利用者特定の3UCは、所有者を持つ参照依存として元仕様を同梱した。
照会3UCの既存画面全体、通知worker、全41UCの実装可能性を受入完了とはしていない。
このUCは非同期イベントを発行しないためAsyncAPIはない。形式の非同期例は[契約fixture](../spec-contracts/README.md)を参照。
共有UIは既存出力を再利用し、キー管理部分を新規則に揃えた。新しいデザイン・Storybookの生成は対象外。

元の[縮約比較例](../spec-concise/README.md)は、情報保持の比較資料として変更せずに残してある。
本例では不整合の修正に必要な設計判断を追加しているため、旧BDDの文字列の完全一致を完了条件にしない。
採用した変更には、成功記録の期限なし保存がある。元の24時間TTLとの違い・保存量の影響は共有規則に明記した。

## 再生成と検証

リポジトリのルートで実行する。Python 3は障害回復probeだけに必要（標準ライブラリのみ）。

```sh
node plugins/distillery/skills/dist-spec/scripts/compileContracts.js samples/distillery/spec-ready
node plugins/distillery/skills/dist-spec/scripts/compileContracts.js samples/distillery/spec-ready --check
node plugins/distillery/skills/dist-spec/scripts/buildSpecViews.js samples/distillery/spec-ready samples/distillery/spec-ready/_inputs/rdra
node plugins/distillery/skills/dist-spec/scripts/validateSpecEvent.js samples/distillery/spec-ready --json
npm test
```

RDRAの機械ビューの分母は[選択範囲](_inputs/rdra/README.md)に明示した業務条件4件。
リンク4/4は対応先の実在確認であり、全RDRAの網羅率や実アプリのE2E成功率ではない。
