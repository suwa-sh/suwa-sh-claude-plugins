# 課題ドラフト (非ブロッキング): createLoan に 401 / 403 応答を契約として載せていない

- UC: register-loan
- 段階: d2-contract mode=uc
- 重大度: low (契約の網羅性。UC のシナリオは満たしている)

## 事実

- 条件「操作権限」により、貸出登録は司書だけが行える。
- 未認証は 401、利用者区分が利用者なら 403 を返すべきである。
- 生成される契約テストは、status ごとに「同名の request example の body」だけを送る。認証ヘッダーは送らない。
- 401 / 403 は body ではなく認証ヘッダーで決まる。同じ body で 201 と 401 を両立する入力を契約に書けない。
- examples 必須ルールでは、文書化した 4xx ごとに同名の request example が要る。

## 採用した判断 (⭐推奨を自動採用)

- createLoan の responses には 201 / 400 / 404 / 409 だけを載せた。
- 401 / 403 は operation の description に明記した。グローバルの `security: bearerAuth` は維持した。
- 共通の `components/responses` (Unauthorized / Forbidden) は残してある。

## 後続への提案

- 認証の分岐は単体テストと UC BDD (司書 / 利用者のログイン状態) で検証する。
- 生成器が request example 単位のヘッダー (例: `x-test-auth`) に対応したら、401 / 403 を契約に戻す。

## 補足

- 画面 (LoanCheckoutForm) の蔵書 ID のプレースホルダーは `C-000101` 形式である。
- 契約と DB の copy_id は uuid (`Id`) である。人が読む蔵書コードが要るかは、書籍登録 UC などで決める。
