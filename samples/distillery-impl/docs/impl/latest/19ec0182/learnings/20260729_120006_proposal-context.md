# プロジェクトコンテキスト(実装先リポのCLAUDE.md/dev-rules)への提案(採否はユーザー判断。このファイル自体は既存ファイルを編集していない)

## 提案1: 大文字小文字のみが異なるファイル名ペアを禁止する命名規約を coding-rules.md に追加

- **対象ファイル**: `docs/dev-rules/coding-rules.md`(frontendの命名規約セクション、または
  ファイル構成規約セクション)。
- **現状の記述**: コンポーネントファイルとロジックファイルの命名規約(PascalCase/camelCase)の
  区別は存在するが、同一語幹で大文字小文字のみが異なるファイル名ペア(例: `loanConfirmation.ts` /
  `LoanConfirmation.tsx`)を避けるべきという明文化はない。
- **提案する変更**: 「同一ディレクトリ内で、既存ファイルと語幹が同じで大文字小文字のみ異なる
  ファイル名(例: `foo.ts` と `Foo.tsx`)を新設しない」旨を明記する。
- **根拠となった出来事**: `frontend/src/components/` 配下で新設コンポーネントを一時
  `LoanConfirmation.tsx` という名前にしたところ、既存の `loanConfirmation.ts`(値変換ロジック)と
  macOS(大文字小文字非区別ファイルシステム)上で衝突し、自己参照的なimport誤解決が発生した
  (詳細: `learnings/20260729_120004_macos_case_insensitive_filename_self_import_collision.md`)。
  開発環境がmacOSであることが多いプロジェクトでは再現しやすい種類の事故であり、命名規約で
  未然に防げる。

## 提案2: 契約生成物(packages/contracts)のbarrelが構文エラーの場合の回避手順を tier-rules.md に明記する

- **対象ファイル**: `docs/dev-rules/tier-rules.md`(または `coding-rules.md` rule 1
  「契約型の直接編集禁止」の周辺)。
- **現状の記述**: 「契約型は packages/contracts/ の生成物を直接編集禁止」という制約はあるが、
  生成物自体が(codegenのバグ等で)構文エラーを含み barrel 経由の import が不能になった場合に
  どう回避すべきかの手順が無い。
- **提案する変更**: 「barrel(`index.ts`)経由の import が失敗する場合、個別ファイル
  (`models/*.ts`, `runtime.ts` 等)が独立にパース可能かをまず確認し、可能であれば個別importに
  切り替えて回避する(契約自体は編集しない)。回避した場合は issues/ に起票し、根本修正は
  契約生成(S0/S3)側で行う」という手順を明記する。
- **根拠となった出来事**: `packages/contracts/{api-types,api-client}/apis/DefaultApi.ts` の
  enum生成コードが構文エラーを含み barrel 全体が import 不能になった。backend-api・frontendの
  両実装が独立に同じ回避策(個別モデルファイルの直接import)へたどり着いたが、これは既存の
  coding-rules.md に明文化された手順ではなく、両Implementerがそれぞれ独自に判断・実測確認する
  コストを払った(詳細: `learnings/20260729_120003_generated_contract_barrel_syntax_error_workaround.md`)。
  手順として明記しておけば、次に同種の問題を踏んだ Implementer が独自に手探りする必要がなくなる。
