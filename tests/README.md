# テストの配置と実行

## 配置

| 配置先 | 対象 |
|---|---|
| `<plugin>/<skill>/*.test.js` | 1つのskillの処理・出力契約 |
| `<plugin>/integration/*.test.js` | 同じplugin内の連携・公開サンプル・参照整合性 |
| `integration/<連携名>/*.test.js` | 複数plugin間の契約 |
| `<plugin>/<skill>/fixtures/` | そのskillだけが使う固定入力 |
| `fixtures/<plugin>/` | 複数skillで共有する固定入力・過去形式の回帰検証用データ |

新しいテストは対象の所有先へ追加する。複数pluginの双方を検査するテストは `integration/` に置く。
テストと固定入力はpluginの配布ディレクトリから分離する。
公開例は `samples/`、互換性検証用の過去データは `fixtures/` で管理する。

## 実行

リポジトリのルートで `npm ci` を実行した後、次のコマンドを使う。

| 範囲 | コマンド |
|---|---|
| 全件（CIと同じ） | `npm test` |
| distillery | `npm run test:distillery` |
| distillery-impl | `npm run test:distillery-impl` |
| toolbox | `npm run test:toolbox` |
| plugin間連携 | `npm run test:integration` |
| 指定skill | `npm test -- distillery/dist-spec` |
| 複数範囲 | `npm test -- distillery/dist-pipeline integration` |

`run-tests.js` は対象ディレクトリの `.test.js` を再帰的に列挙する。
`fixtures/` 内のコードはテストとして実行しない。指定範囲が存在しない場合は失敗する。
実行時の作業ディレクトリはリポジトリルートに統一し、fixtureや実装への参照を解決する。
同じテストが複数の範囲に含まれる場合も1回だけ実行する。

旧コマンド `npm run test:feedback` は既存の呼び出しとの互換性を保つため、従来どおり全件を実行する。
新しい呼び出しには上記の範囲別コマンドを使う。
