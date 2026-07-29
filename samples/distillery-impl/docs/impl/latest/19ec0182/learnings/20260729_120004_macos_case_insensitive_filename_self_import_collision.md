# learning: macOSの大文字小文字非区別ファイルシステムで、TSファイル名の衝突により自己参照的import誤解決が起きた

## 何が起きたか

`frontend/src/components/LoanConfirmationScreen.tsx`(画面コンポーネント、attempt-2で新設)を
当初 `LoanConfirmation.tsx` という名前で作成したところ、既存の
`frontend/src/components/loanConfirmation.ts`(値変換ロジック、attempt-1から存在)と
ファイル名が(大文字小文字の違いのみで)衝突し、自己参照的な import 誤解決が発生した。

## なぜ(根本原因)

macOS標準のファイルシステム(APFS既定設定)は大文字小文字を区別しない。
`loanConfirmation.ts` と `LoanConfirmation.tsx` は拡張子込みでは異なる文字列だが、
モジュール解決の途中経路(拡張子なし参照 `./LoanConfirmation` 等)やOS側のファイル検索では
大文字小文字を区別しないため同一ファイルとして扱われ、新設した `LoanConfirmation.tsx` が
自分自身(または既存の `loanConfirmation.ts`)を誤って解決するimportエラーを引き起こした。
TypeScriptのソース自体は大文字小文字を区別する言語仕様のため、コード上は問題ないように見えても
実行環境(ファイルシステム)側で衝突する、気づきにくい種類の不具合だった。

## どう回避したか

新設コンポーネントを `LoanConfirmationScreen.tsx` に改名し、既存の `loanConfirmation.ts`
(小文字始まり、値変換ロジック)と名前空間を明確に分離することで解消した。

## 次回どうすべきか

同一ディレクトリ内で「既存の小文字始まりユーティリティファイル」と「新設する大文字始まり
コンポーネントファイル」が同じ語幹(例: `loanConfirmation` / `LoanConfirmation`)を持つ命名を
避ける。特にmacOS上で開発・実行するtierでは、大文字小文字のみが異なるファイル名のペアを
作らないことを命名規約(coding-rules.md等)に明記しておくと、同種の事故を予防できる。
