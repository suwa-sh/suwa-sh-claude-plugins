# mode=scenario: UC のシナリオを書く (固定指示)

UC 着手の最初に、その UC の Gherkin を `features/<業務>/<slug>.feature` に書く。これは**要求の一部** (living documentation) であり、
人が承認してから先に進む。v1 の「個別仕様の E2E 完了条件 → 転写」を、シナリオを直接書く形に置き換えたもの。

## 読むもの

- `docs/requirements/use-cases.yaml` の該当行 (業務 / BUC / UC / slug / spec_ids / actors)
- `docs/requirements/requirements.yaml` の spec_ids に対応する要求・仕様・受入基準 (`acceptance_criteria[]`)
- `docs/requirements/rdra/` の該当行: `条件.tsv` (業務条件)、`状態.tsv` (状態遷移)、`情報.tsv` (扱う情報)、`BUC.tsv` (フロー内の前後 UC)
- `docs/rules/testing.md` (Gherkin の書き方・タグ規約)
- 既存の `features/**/*.feature` (用語と step 文言を揃えるため。同じ意味の step は同じ文にする)

## 書くもの

`features/<業務>/<slug>.feature` 1 ファイル。先頭にコメントで basis を書く (`# basis: requirements@<sha>`)。

```gherkin
# basis: requirements@abc123...
# language: ja
@uc:register-loan
機能: 貸出を登録する
  司書が利用者に書籍を貸し出し、返却期限を自動で設定する

  背景:
    前提 利用者 "m1" が登録されている

  @acceptance:SPEC-002-1
  シナリオ: 在庫のある書籍を貸し出す
    前提 書籍 "b1" は在庫ありである
    もし 司書が "b1" を "m1" に貸し出す
    ならば 貸出が記録され、返却期限は 14 日後である
    かつ "b1" の状態は貸出中になる

  @acceptance:SPEC-002-3 @browser
  シナリオ: 貸出画面から貸し出す
    ...
```

## 規則

1. **受入基準との対応**: UC の spec_ids が持つ `acceptance_criteria` の各項目を、少なくとも 1 つのシナリオに
   `@acceptance:<SPEC-ID>-<連番>` タグで対応させる (受入基準の文言を意訳せず、シナリオの Then に反映する)。
   UC をまたぐ受入基準 (この UC だけでは確かめられないもの) は `features/acceptance/<SPEC-ID>.feature` に書くか、
   既にあればそのシナリオに `@uc:<slug>` を追加する
2. **業務条件と状態遷移を網羅する**: `条件.tsv` の該当条件ごとに、成立する場合と成立しない場合のシナリオを書く。
   `状態.tsv` の該当遷移は Then で状態を確かめる
3. **観測できる結果だけを Then に書く**: 内部実装 (テーブル名・関数名) を書かない。API の応答、状態、発行されるイベント、画面表示
4. **ブラウザで確かめるものは `@browser`**: 画面の操作で業務が決まるシナリオだけ。API 面で確かめられるものには付けない
5. **ドライバに依存しない文**: 同じシナリオを API ドライバとブラウザドライバの両方で実行できる文にする
   (「司書が〜を貸し出す」であって「POST /loans を送る」「ボタンを押す」ではない)
6. 値は具体的に書く (境界値・失敗時に変わらない状態)。契約の型・制約を満たす値にする (正常系が入力検証で落ちる例にしない)
7. 要求に無い業務ルールを発明しない。要求が曖昧で書けない箇所は `issues/<ts>_<slug>.md` (`kind: requirement`) に書き、
   シナリオ側には `# TODO(issue: <path>)` を残す

## 完了条件

- `node ${CLAUDE_PLUGIN_ROOT}/skills/d2-implement/scripts/checkScenario.js <feature> --use-cases docs/requirements/use-cases.yaml --requirements docs/requirements/requirements.yaml`
  が ok (parse できる、`@uc:` タグがある、spec_ids の受入基準がすべてタグで対応済み、未対応があれば列挙)
- 報告に「シナリオ数 / 受入基準の対応 / @browser の数 / 起票した issue」を書く。人の承認は d2-run が取る (このモードでは聞かない)
