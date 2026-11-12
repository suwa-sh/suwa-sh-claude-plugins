# phase の順番の理由と細目

d2-foundation の phase について、本体 (SKILL.md) に書いていない理由と細目をまとめる。

## phase=all の順番の理由

| 順番 | 理由 |
|---|---|
| genCi は genConfig の後 | genCi が config.yaml を読むため |
| genQlty は F5 の最後 | qlty init の自動検出に、package.json、biome.json、workflow を見せるため。未追跡ファイルは一時的に `git add -N` して戻す |
| F7 で `genQlty.js --refresh` を回す | qlty の提案は、その時点でリポにあるファイル種別で決まるため。npm install の後に、増えた分を足す (減らさない) |
| F7 は契約の骨格より前 | 契約の骨格が使う redocly が、F7 で入るため |

qlty の提案が変わる例:
lockfile が無いと osv-scanner が入らない。
python が増えると ruff が入る。

各 UC の integrate の後は、d2-run が同じ `--refresh` を回す。

## .qlty/qlty.toml の作り方 (F5)

`.qlty/qlty.toml` は、**qlty 自身の提案 (`qlty init --dry-run`) を土台**にする。
そこに distillery2 の上乗せを足す。
上乗せは、biome の版固定、生成物の除外、radarlint を low にすることである。
qlty CLI が無ければ、固定リストを使う。

## F6 と画面の土台の CSS

画面の土台の `src/styles.css` は、F5 では Tailwind を直接読む形で置かれる。
importUi が `packages/ui/entry.css` を書けたときだけ、画面部品を読む形に替わる。
そのため、F6 を飛ばしても build は通る。

importUi の出力の `css:` が `none` になるのは、次のどれかのときである。

- 取り込み元の Tailwind の CSS が 0 本である
- 取り込み元の Tailwind の CSS が 2 本以上ある
- 取り込み元に、同じ名前の `entry.css` がある

`none` のときは、画面部品の色や書体が画面に効かない。
d2-design の出力を課題にする。
d2-design の出力は、Tailwind を `@import` する CSS がちょうど 1 本であることが期待である。

## F4 と F6 の受け渡し

**F4 (契約テスト)**: d2-foundation が回すのは骨格分だけである (phase=finish)。
スクリプトは d2-contract のものである。
`<skills>/d2-contract/scripts/genContractTests.js` が `apps/<provider>/test/contract/` を生成する。
UC ごとの契約テストは、d2-contract mode=uc が持つ。
`genRdbDdl.js` による `apps/<datastore_owner>/migrations/*.sql` と DB 契約テストも、d2-contract mode=uc が持つ。

**F6**: d2-design が Storybook の出力を出した後に、phase=finish の中で回す。

`packages/test-support/README.md` が、composition root (`apps/<backend>/src/test-app.ts`) の契約を書く。
composition root は、実装者 (d2-implement mode=integrate) が結線する。
