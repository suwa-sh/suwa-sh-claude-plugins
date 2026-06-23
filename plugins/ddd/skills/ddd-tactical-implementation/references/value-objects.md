# 値オブジェクト(Value Object)

基本型(int/String/Date)を裸で引き回さず、振る舞い/不変条件を持つ値をドメイン固有型に包む。型自体が事前条件(引数)・事後条件(返り値)の表明になり、利用側の防御的チェックが不要になる。

## 規約(増田流 + Fowler 定義)

- **値等価**: 全プロパティの値が等しければ等しい(`equals`/`hashCode` を値ベースで、または record/struct)。識別子(identity)は持たない。
- **不変(immutable)**: 値を変えるときは内部を書き換えず**新しいインスタンスを返す**(例: `basePrice.minus(1000)`)。
- **完全コンストラクタ + 生成時ガード**: すべてのフィールドを生成時に設定し、不正値はコンストラクタ/ファクトリで例外。半端な状態のオブジェクトを作らせない。
- **計算ロジックを内蔵**: 値に関する計算・判断・加工を型の中に閉じ込め、基本型をそのまま外に返さない。
- **メソッド名は目的特化(What を表す)**: `add`/`minus`/`isAfter`/`isBefore`/`dayOfFinalAlert` など。How でなく業務意図。

## アンチパターン

- 内部値の直接書き換え(`price.setValue(2000)` のような mutable)。
- 料金・数量を `int`/`String` のまま引き回す(意味が消え、不正値チェックが分散)。
- VO のメソッドが基本型をそのまま露出して、計算を利用側にやらせる。

## 値オブジェクトのカタログ(型の2次元マトリクス)

増田亨「ドメイン駆動設計 本格入門」(DevLOVE 2019)の網羅表。値を **「数値/時間/空間」×「単一の値/範囲型(from-to)/範囲型のコレクション」** で分類すると、必要な型と計算が機械的に導ける。

| 分類 | 単一の値 | 範囲型(from-to) | 範囲型のコレクション |
|---|---|---|---|
| **数値** | 金額型(`Amount`,`Money`) | 金額範囲(x円以上 y円未満) | 金額範囲のコレクション(価格帯) |
| **数値** | 数量型(`Quantity`,`NumberOfXxx`) | 数量範囲(m人以上 n人以下) | 数量範囲のコレクション(数量別割引率) |
| **時間** | 日付型(`DueDate`,`XxxDate`) | 期間(開始日−終了日) | 期間のコレクション(シーズン) |
| **時間** | 時刻型(`HourTime`,`XxxTime`) | 時間(開始時刻−終了時刻) | 時間のコレクション(時間帯) |
| **空間** | 地点型(`Point`) | 接続(`Path`:出発点−到達点) | 接続のコレクション(`Route[Path,...]`) |
| **空間** | — | 地域型(`Area`,`Zone`) | 地域のコレクション(階層,隣接関係,…) |

## 計算(メソッド)の候補表

設計時に「この型にどの計算が意味を持つか」を問うチェックリストとして使う。**「便利そう」は作らない。必要最低限を作り、必要になったら足す。**

### 単一の値
| 計算の種類 | メソッド例 | 結果の型 |
|---|---|---|
| 等値判定 | `isEqual`,`notEqual` | boolean/enum |
| 大小判定 | `greaterThan`,`lessThan` | boolean/enum |
| 加算・減算 | 同じ型同士 | 同じ型 |
| 乗算 | 同じ型同士の乗算は意味がないことが多い | 別の数値型 |
| 除算 | 同じ型の除算と異なる型の除算で意味が異なる | 別の数値型 |
| 境界 | `Max`,`Min` | 同じ型(固定値) |
| 列挙 | `prev`,`next`(循環の可/不可) | 同じ型 |
| 文字列表現 | `toString` | 文字列 |
| 文字列からの生成 | `parse` | 同じ型 |

> 加減算と乗除算は性格が違う。金額同士の加減算は普通、金額同士の乗算はたぶん無い、金額同士の除算はたぶん割合。

### 範囲型(from-to)
| 計算の種類 | メソッド例 | 結果の型 |
|---|---|---|
| 範囲に含まれる | `contains(element)`,`encloses(other)` | boolean/enum |
| 範囲が重複する | `isOverlapped(other)` | boolean/enum |
| 厳密に隣接する | `isConnectedTo(other)` | boolean/enum |
| 境界の値 | `Max`,`Min` | 要素の型 |
| 範囲演算 | `intersect`,`minus`,`add` | 範囲型 |

### コレクション(ファーストクラスコレクションに対応)→ `first-class-collection.md`

## 契約による設計(増田流)

- `assert` による表明より **型による表明** を進める。防御的コードを書かない / null を返さない文化を前提に、事前条件・事後条件を型で表現。
- **不正なオブジェクトは生成しない**。生成してしまったら、生成側が外に出す前に破棄する。

## コード例(Java、`suwa-sh`/増田の公開実装より)

```java
// 単価 × 数量 = 金額。型(単位)の不一致を計算時に弾く。
class UnitPrice {
    Amount 金額;
    static final Unit 単位 = Unit.キログラム;
    Amount 掛ける(Quantity 数量) {
        if (単位 != 数量.単位) throw new IllegalArgumentException("単位の不一致");
        return new Amount(金額.額() * 数量.量);
    }
}
record Amount(int 額) {}

// 範囲の値オブジェクト。private ctor + static ファクトリで生成時ガード、判定を内蔵。
class DateRange {
    private final LocalDate 開始日, 終了日; // 両端含む
    private DateRange(LocalDate s, LocalDate e) { this.開始日 = s; this.終了日 = e; }
    boolean 期間内(LocalDate 日付) {
        return !日付.isBefore(開始日) && !日付.isAfter(終了日);
    }
    static DateRange create(LocalDate s, LocalDate e) {
        if (e.isBefore(s)) throw new DateTimeException("終了日が開始日より前");
        return new DateRange(s, e);
    }
}
```

> ドメインの言葉(金額/数量/掛ける)をそのままコードに使うのが増田流の近年のスタイル。英語識別子でも考え方は同じ。

## 公開カタログ(skill リファレンス)

- **網羅表の出典**: 増田亨「ドメイン駆動設計 本格入門」DevLOVE Premium 第3回(2019-03-22)。イベントレポート https://note.com/suwash/n/n019c1199eac1 (公開情報・転記可)
- **実コードの型定義カタログ**: `masuda220/business-logic-patterns` — https://github.com/masuda220/business-logic-patterns(レベル別 beginner/intermediate/advanced の実装例)。**⚠️ ライセンス未設定のため丸写し不可・リンク参照を基本にする**。
- やりすぎ(VO 乱造)への懸念は `applicability-and-pitfalls.md` を参照。
