# dist-spec 出力簡素化の比較例

[Opus の貸出登録](../legacy-pipeline/specs/latest/蔵書利用業務/書籍を貸し出すフロー/貸出を登録する/spec.md)を
**手編集**で簡素化した比較用サンプル。新テンプレートでの pipeline 実行結果ではない。
API 定義元の移行に先立ち、Markdown の重複削減と後段互換性を確認する。

## 読み方

- [UC仕様](loan-registration/spec.md): 目的・業務ルール・状態遷移・要件対応・受入条件
- [Backend仕様](loan-registration/tier-backend-api.md): API契約と固有の実行条件
- [Frontend仕様](loan-registration/tier-frontend-staff.md): 画面・状態所有者・PropsとAPIの接続
- [_api-summary.yaml](loan-registration/_api-summary.yaml) / [_model-summary.yaml](loan-registration/_model-summary.yaml): 元と同一

共有定義は元サンプルの `_cross-cutting/` を参照する。summary 内のパスは元イベントの artifact root 基準。
このディレクトリ単独は完全なイベントではない。テストでは元の latest を一時ディレクトリへコピーし、
本 UC を重ね、Markdown の共有定義リンクをイベント内の相対パスへ戻して検証する。

## 分量

| ファイル | 変更前 | 変更後 |
|----------|-------:|-------:|
| spec.md | 319行 | 191行 |
| tier-backend-api.md | 281行 | 235行 |
| tier-frontend-staff.md | 220行 | 201行 |
| Markdown合計 | 820行 | 627行（約24%減） |
| summary 2ファイル | 260行 | 260行 |

行数は空行を含む。共有定義の読込量や生成トークン削減率を表すものではない。

## 情報の保持・移動

| 変更前の記載 | 変更後の定義先 / 確認方法 |
|-------------|-------------------------|
| データフロー図・変換表・シーケンス図 | 業務判断は spec.md の RULE-001〜004、モデル配置・全データ操作は _model-summary、実行順序と原子性は Backend の「データアクセス・実行条件」 |
| 分岐・計算・バリエーションの各表 | spec.md の業務ルールと RULE-004 の対応表に集約。標準14日・短期7日・長期28日、利用者区分別の既定と選択集合を保持 |
| Backend のカラム型表 | rdb-schema.yaml の loans / books / users / reservations。UC固有の設定値・whereは _model-summary |
| 予約完了の同時更新 | rdb-schema.yaml の state_transition_rules「予約状態遷移規則」。Backendから具体的な遷移を参照し、hold_started_at の保持も記載 |
| 貸出可否の再判定・トランザクション・競合 | Backend の「データアクセス・実行条件」。条件付きUPDATEの更新件数0、全体ロールバックを保持 |
| 冪等性・APIの入出力・エラー | Backendの契約節を保持。保持期間、処理中・異なる本文・失敗後・期限後の再送条件は削らない |
| 共通コンポーネント一覧の責務説明・トークン値表 | 共有定義参照へ置換。UC固有のProps・状態・イベント・供給値はFrontendに保持 |
| 引継ぎなしの再取得 | Frontend のUIロジックと _api-summary.consumes の3 operation |
| 受入条件・cross-UC API依存・モデル操作 | 全Gherkinブロックと両summaryを元と同一のまま保持する回帰テスト |

既存BDDはこの比較では一切削除していない。新規生成ではUCとtierで保証を分けるが、
この比較からシナリオ削減の効果は主張しない。元仕様の不整合を全面修正する例でもない。
たとえば冪等キー所有者やキャッシュ対象の表現の揺れは別の仕様レビューで解消する必要がある。

## 検証

```bash
node --test tests/dist-spec-concise-sample.test.js
```

BDDの完全一致、API契約節・summaryの保持、Markdownリンク、既存Spec/summaryバリデータとの互換性を確認する。
これらは生成モデルの出力品質や実装完了を保証するテストではない。フルpipeline再生成は未実施。

## 実装可能性の評価

[実装者視点の再評価と記載例](implementation-review.md)では不足・矛盾が見つかっており、
本比較例は実装可能な完成仕様としては扱わない。行数削減と情報保持の検証結果を、そのまま品質合格としない。
