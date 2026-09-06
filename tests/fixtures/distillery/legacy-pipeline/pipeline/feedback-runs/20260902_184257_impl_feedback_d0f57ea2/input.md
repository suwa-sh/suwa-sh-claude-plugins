---
schema_version: distillery.feedback-request/v1
feedback_id: 20260902_184257_impl_feedback_d0f57ea2
created_at: 2026-09-02T18:42:57+09:00
source: distillery-impl
uc_id: d0f57ea2
---

# 実装からの変更要求

## CR-d0f57ea2-001: cross-UC API依存を機械可読に宣言できない

- severity: spec-gap
- related_ids: [REQ-002, SPEC-002-01]
- related_files: [docs/specs/latest/蔵書利用業務/書籍を貸し出すフロー/貸出を登録する/_api-summary.yaml, docs/specs/latest/_cross-cutting/api/openapi.yaml]

### 観測した事実

貸出画面は蔵書情報取得APIを呼ぶが、対象UCのAPI summaryにはその依存が無く、実装時に全体OpenAPIを探索した。

### 現在の仕様と問題

UCが所有しないAPIを利用する関係が機械可読でないため、実装入力をUC単位に限定すると必要契約を発見できない。

### 変更してほしいこと

各UCが利用するcross-UC APIを、所有UCとは別に機械可読な依存として仕様へ記録する。

### 完了条件

対象UCの入力だけから、利用する全API operationと契約ファイルを列挙できる。

## CR-d0f57ea2-002: AsyncAPI payloadが匿名型として生成される

- severity: improvement
- related_ids: [ASYNCAPI-CONTRACT]
- related_files: [docs/specs/latest/_cross-cutting/api/asyncapi.yaml]

### 観測した事実

AsyncAPI message payloadにtitleが無く、型生成物が`AnonymousSchema_1`などの名前になった。

### 現在の仕様と問題

生成型の名前から業務イベントを識別できず、複数messageの保守時に誤用しやすい。

### 変更してほしいこと

各message payloadへ業務上安定したschema titleを付与する。

### 完了条件

生成型が業務イベントを表す安定名を持ち、匿名schema名が残らない。

## CR-d0f57ea2-003: OpenAPI enumがTypeScript構文エラーを生成する

- severity: spec-gap
- related_ids: [OPENAPI-CONTRACT]
- related_files: [docs/specs/latest/_cross-cutting/api/openapi.yaml]

### 観測した事実

日本語ラベルを含むgenreとmaterial_typeのenumから、TypeScriptとしてparseできないキーが生成された。

### 現在の仕様と問題

契約codegenの標準出力がコンパイル不能であり、実装側の手修正なしに利用できない。

### 変更してほしいこと

wire valueと安全なコード識別子を分離し、利用generatorで有効なenumが生成される契約にする。

### 完了条件

OpenAPIから生成したTypeScriptを無修正でparse・typecheckできる。

## CR-d0f57ea2-004: 認証ヘッダーと401応答の契約が未定義

- severity: spec-gap
- related_ids: [REQ-002, SPEC-002-01]
- related_files: [docs/specs/latest/蔵書利用業務/書籍を貸し出すフロー/貸出を登録する/tier-backend-api.md, docs/nfr/latest/nfr-grade.yaml]

### 観測した事実

統合テストでは利用者識別子が必要だったが、API契約に送信方法が無く、暫定ヘッダーを注入した。

### 現在の仕様と問題

認証方式はNFRにある一方、対象APIの認証情報と欠落・不正時の応答が定義されていない。

### 変更してほしいこと

利用者識別情報の送信方法、検証責務、401応答をAPI契約とUC仕様で一貫して定義する。

### 完了条件

クライアントとサーバーが推測なしに同じ認証ヘッダーとエラー応答を実装できる。

## CR-d0f57ea2-005: 予約状態遷移とDB制約の記述が一致しない

- severity: spec-gap
- related_ids: [REQ-002, SPEC-002-01]
- related_files: [docs/specs/latest/_cross-cutting/datastore/rdb-schema.yaml, docs/specs/latest/蔵書利用業務/書籍を貸し出すフロー/貸出を登録する/_model-summary.yaml]

### 観測した事実

予約履行時に必要な状態更新を実装したが、model summaryとDB schemaで許容状態と更新条件が揃っていなかった。

### 現在の仕様と問題

同じ予約状態について参照先ごとに異なる情報があり、正しい遷移を一意に決められない。

### 変更してほしいこと

予約履行時の遷移元・遷移先・同時更新条件を一つの業務規則として整合させる。

### 完了条件

UC仕様、model summary、DB制約が同じ予約状態遷移を表す。

## CR-d0f57ea2-006: 必要なSkeletonとSpinnerがUI資産に存在しない

- severity: spec-gap
- related_ids: [REQ-002, SPEC-002-01]
- related_files: [docs/specs/latest/蔵書利用業務/書籍を貸し出すフロー/貸出を登録する/tier-frontend-staff.md, packages/ui/.imported.yaml]

### 観測した事実

画面仕様がloading表示に要求するSkeletonとSpinnerを、取り込み済みStorybook componentsから参照できなかった。

### 現在の仕様と問題

frontendはdesign systemの生成物だけを使う規則だが、要求された状態を表すcomponentが生成されていない。

### 変更してほしいこと

loading状態を表現する共通componentと利用条件をdesign成果物に追加する。

### 完了条件

画面実装が独自UIを追加せず、指定componentだけでloading状態を再現できる。

## CR-d0f57ea2-007: 冪等キー重複時の挙動が仕様間で矛盾する

- severity: spec-gap
- related_ids: [REQ-002, SPEC-002-01]
- related_files: [docs/specs/latest/_cross-cutting/datastore/kvs-schema.yaml, docs/specs/latest/蔵書利用業務/書籍を貸し出すフロー/貸出を登録する/tier-backend-api.md]

### 観測した事実

同じ冪等キーの再送について、KVS仕様は保存済み応答の再利用を示す一方、tier仕様は競合応答を要求していた。

### 現在の仕様と問題

正常な再送と異なるpayloadによる衝突を区別する規則がなく、実装とテストの期待が分かれる。

### 変更してほしいこと

同一payload再送と異なるpayload衝突の判定・応答を明示して、両仕様を統一する。

### 完了条件

冪等キーの各ケースについてHTTP応答と保存状態が一意に決まる。

## CR-d0f57ea2-008: 返却期限の表示形式が統一されていない

- severity: improvement
- related_ids: [REQ-002, SPEC-002-01]
- related_files: [docs/specs/latest/蔵書利用業務/書籍を貸し出すフロー/貸出を登録する/tier-frontend-staff.md]

### 観測した事実

同じtier仕様内で返却期限がスラッシュ区切りとハイフン区切りの両方で記述されていた。

### 現在の仕様と問題

表示テストとUI実装がどちらを正とするか判断できない。

### 変更してほしいこと

利用者向け返却期限の表示形式と、API上の日付形式を区別して統一する。

### 完了条件

仕様例と受け入れテストが一つの表示形式を使う。

## CR-d0f57ea2-009: 貸出完了結果の受け渡し経路が閉じていない

- severity: improvement
- related_ids: [REQ-002, SPEC-002-01]
- related_files: [docs/specs/latest/蔵書利用業務/書籍を貸し出すフロー/貸出を登録する/tier-frontend-staff.md]

### 観測した事実

LoanConfirmationの`onLoan`と画面状態`loanResult`の型・所有者が仕様から決まらなかった。

### 現在の仕様と問題

イベント結果を親子componentのどちらが保持するか曖昧で、同じ仕様から異なる実装が成立する。

### 変更してほしいこと

貸出完了結果の型、状態所有者、component間の受け渡しを明記する。

### 完了条件

componentのPropsとevent契約だけで完了状態への遷移を実装できる。

## CR-d0f57ea2-010: 実URLへ接続するアプリシェルの責務がない

- severity: spec-gap
- related_ids: [REQ-002, SPEC-002-01]
- related_files: [docs/specs/latest/蔵書利用業務/書籍を貸し出すフロー/貸出を登録する/tier-frontend-staff.md]

### 観測した事実

`/loans/new`の画面componentは実装できたが、routerとentry pointの生成物・所有者が存在しなかった。

### 現在の仕様と問題

各画面はURLを持つ一方、それらを実際のアプリケーションへ結線する責務が定義されていない。

### 変更してほしいこと

共通アプリシェル、router、entry pointの生成・保守責務と画面結線規則を定義する。

### 完了条件

E2Eテストが実URLから対象画面へ到達でき、結線の所有者が一意になる。

## CR-d0f57ea2-011: UCと受け入れ基準の対応が機械可読でない

- severity: spec-gap
- related_ids: [REQ-002, SPEC-002-01, SPEC-002-02, SPEC-001-01]
- related_files: [docs/usdm/latest/requirements.yaml, docs/impl/latest/uc-map.yaml]

### 観測した事実

S1はUCに属する受け入れ基準を自動確定できず、criterion単位の対応をユーザー確認で補った。

### 現在の仕様と問題

affected modelにBUCが無いSPECや、一つのSPECに複数UCのcriterionがあるため、SPEC単位では対応できない。

### 変更してほしいこと

UCとSPEC acceptance criterionを結ぶ機械可読な対応を仕様生成物へ追加する。

### 完了条件

dist-implが文字列推測やユーザー確認なしに、UCのATDD scenarioを一意に選択できる。
