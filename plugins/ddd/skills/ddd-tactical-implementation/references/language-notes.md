# 言語別ノート(Java 主軸からの翻訳)

このスキルのコード例は Java 主軸。他言語では「考え方は同じ、書き方は各言語のイディオムに翻訳」する。**Java を写経しない**。以下は言語ごとの翻訳指針と、特に外しやすい「実行時境界の再検証」の注意。

## 共通の落とし穴: 実行時境界の再検証(最重要)

Always-Valid(`oo-practices.md`)は「生成時に不変条件を検証し、不正なら作らせない」が原則。だが**型注釈・コンパイル時の型は実行時を守らない**。次の境界では、生成の関所(コンストラクタ/ファクトリ)を**通らずに**不正な状態が入り込みやすい:

- **永続化からの復元(reconstitution)**: DB/JSON から復元する経路がガードを迂回し、`request()` 等で弾く不正状態を作れてしまう。
- **API/外部入力の境界**: 外部由来の値(状態文字列・日付・数値)を型注釈だけで信用する。
- **共有DB由来データ**: 別システムが書いた値は「潜在的に不正」と仮定して再検証する。

→ **復元経路にも生成時と同じ検証を通す**(または専用の検証付きファクトリを設ける)。「新規生成」と「復元」を別ファクトリに分け、両方で実行時検証する。

## TypeScript

- **区分/状態**: `enum` でなく **`as const` + string-literal union**(`const STATUSES = [...] as const; type Status = typeof STATUSES[number]`)。runtime JS を余計に emit せず、永続化も自然に文字列。判別可能ユニオン(discriminated union)で variant がデータを持つ場合に対応。
- **不変**: `readonly` / `Readonly<>`。値等価は構造比較メソッド(`equals`)を用意。
- **⚠️ union はコンパイル時のみ安全**: 外部から来た文字列を `as Status` でキャストしただけでは実行時に不正値が混入する。**境界で実行時バリデーション**(値が許可リストに含まれるかチェック)を必ず入れる。`reconstitute` / API 入力は型を信用せず検証する。
- **⚠️ Date の罠**: `new Date("不正")` は `Invalid Date`(`getTime()` が `NaN`)。比較は通過してしまうので `Number.isNaN(d.getTime())` を生成時に弾く。日付ドメインなら時刻成分の扱いも決める。

## Python

- **値オブジェクト**: `@dataclass(frozen=True)` で不変+値等価。生成時ガードは `__post_init__`。
- **区分/状態**: `enum.Enum` にメソッド(`can_transition_to`/`is_terminal`)を持たせる。遷移表は `dict` だが**モジュール外から書き換えられないよう `types.MappingProxyType` で読み取り専用化**すると堅い。
- **⚠️ 型ヒントは実行時を守らない**: `status: LoanStatus` と書いても `Loan(status="foo")` が通る。集約は **公開 `__init__` を避け、`request()` / `reconstitute()` の classmethod に分け、両方で `isinstance(status, LoanStatus)` 等を実行時検証**する。
- **⚠️ `__init__` を公開のまま残すと生成ルールを迂回できる**: `request()`/`reconstitute()` を分けても、公開 `__init__` が status を引数で受けると `Loan(status=APPROVED)` で「新規は必ず審査中」という業務ルールを飛ばせる。回避策: `__init__` を「型検証だけの内部口」にして status を受けない/受けても検証する、もしくは `__init__` を `_private` 規約にし、生成は必ず `request()`/`reconstitute()` を通す設計にする。**「正しい状態でしか作れない」入口を1つに絞る**のが要点。
- **⚠️ 単一アンダースコアは弱い保護**: `loan._status = ...` で外から壊せる。破壊経路を減らすため、状態変更はメソッド経由に寄せる(必要なら `__status` の name mangling)。

## Go

- **値オブジェクト**: 小さな struct + 値レシーバ。不変は「**非公開フィールド + コンストラクタ関数 `NewMoney()` が `(値, error)` を返す**」で表現(関所を一本化)。
- **区分/状態**: **`type LoanStatus string` + 定数群 + メソッド**、遷移表は `map`。string 基底にすると ORDINAL 問題(並べ替えで保存値が化ける)を回避できる。例外が無いので **`error` を返す**(`panic` を例外代わりにしない)。
- **集約**: 非公開フィールド + ポインタレシーバのメソッド(`Approve()` 等)で状態変更、不正遷移は `error`。これで Always-Valid を担保。
- **⚠️ 値等価**: `time.Time` を含む VO の `==` はモノトニック時計成分で罠がある。`func (p LoanPeriod) Equal(other) bool` を明示する。
- **⚠️ 日付ドメインで `time.Time` をそのまま使わない**: 時刻成分が残り「同じ日」でも比較がズレる。`time.Date(y,m,d,0,0,0,0,loc)` へ正規化するか、日単位の VO(`LocalDate` 相当)を切る。

## Kotlin / Rust / Scala(参考)

- 区分で variant が異なるデータを持つ/成長するなら、**Kotlin は `sealed class`、Rust/Scala は `enum`(ADT)** が自然。閉じた安定集合・同一形状なら通常の enum で十分。
- Kotlin の `data class` は値オブジェクト向き(`copy` で不変更新)。`init` ブロックで生成時ガード。
