# S4: tier-impl 追加指示（固定部）

このファイルは dist-impl-run が S4 サブエージェントに渡す追加指示の固定部の正本。
サブエージェントはこの指示すべてに従うこと。tier_id・findings パス等の可変部はプロンプト側の引数で渡される。

`_api-summary.yaml` の `schema_version: distillery.api-summary/v2` は索引である。
対象UCの `_contract-slice.json` を追加で読み、summaryの `contract_sha256` と実ファイルのSHA-256を照合する。
型・認可・エラー・イベントpayload/headerはslice内のOpenAPI/AsyncAPIから取得する。
欠落やhash不一致をlegacy形式として補完しない。提供操作だけでなく `consumes` の依存操作も対象にする。

## read-set の限定

入力（read-set）は次に限定すること:

- 該当 UC の spec.md（業務ルール・状態遷移）と {tier_id}.md（例 tier-frontend.md）、_api-summary.yaml、_model-summary.yaml
- 実装リポの docs/dev-rules/
- packages/contracts/ と契約 source のうち、impl-config の contracts[] で自 tier が provider または consumers に含まれる契約のもの
  - 生成物 dir は docs/impl/latest/contracts.lock.yaml の該当契約の generated[] のうち、audience が自 tier の role または both で、lang 指定があれば自 tier の lang と一致するもの
  - 契約 source は lock の source_read が none 以外の契約のみ・scope 指定時は scope 範囲
- tier 種別の追加入力（tier-rules.md。frontend は uc-map の ui_screens が指す design-event.yaml の該当 screens[] 全行 + 結線 story + story から到達する packages/ui 内の推移的 import closure。ui_screens が空で ui_screen_resolution が記録済みの場合は UI 突合をスキップ）

spec / tier に明示された共有定義はファイル + 見出し / ID の該当箇所だけ追加で読める。
契約 source の source_read / scope 制限は維持し、範囲外が必要なら issues に記録する。
それ以外（無関係な他 UC・関与しない契約・契約 source の全量読み）は読まないこと。
図・DB型表・共通Propsの再掲は不要。参照先にある定義を欠落や未確定の前提と誤認しない。

## findings の扱い

プロンプトに findings パスが渡された場合（blocker 由来の attempt++ 直後の再実行のみ渡される。verify の findings パス、当該 tier で ui-review が dispatch されていれば ui-review の findings パスも併せて渡される）は、その blocker を修正対象に含めること
（stale 由来の再実行では渡されない — 旧 spec 前提の指摘を新実装に持ち込まないため）。

## frontend tier の DOM 一致

dom_snapshot が true な frontend tier は、S2 が生成した not-implemented stub の画面 adapter を実装画面へ結線し、DOM 一致テストを green にすること
（署名 extractor・adapter は S2 生成の共通 helper をそのまま使い、独自の署名生成ロジックを作らない）。

## 前提の記録(AssumptionRecord)

仕様・契約・dev-rules・この固定指示に明示されていないため**自分で決めた設計判断**を、
`attempt-{n}/S4_tier-impl.{tier_id}.assumptions.yaml` に `dist-impl-implement/references/assumption-record.md` の
スキーマで書くこと(0 件でも `assumptions: []` で必ず書く。欠落は受理されない)。
明示されていた事項の復唱は含めない。各前提に「どこを探して無かったか」(`spec_refs`)を付けること。
書いたら `validateAssumptions.js record` を実行して ok を確認し、`count / by_category / sha256` を done に転記すること。
可変プロンプト(この dispatch の引数・findings パス等)の内容を実装判断に使った場合は、それも前提として書くこと。

## その他

formatter/lint は check-only で実行すること。
