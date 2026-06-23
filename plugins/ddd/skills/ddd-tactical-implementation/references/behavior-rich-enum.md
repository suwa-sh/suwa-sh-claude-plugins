# 振る舞いを持った enum(区分オブジェクト)

if/switch の複雑さをオブジェクトに置換する。区分(種別・状態・ステータス)ごとのロジックを enum 内に凝集させ、区分追加時の変更を局所化する。enum は「クラス」でメソッド・フィールドを持てるので、区分概念にルール・ラベル・判定を閉じ込められる。

## なぜ単なる定数列挙でないのか

- 区分ごとの業務ロジックを enum 内に集約すると、**変更箇所が1箇所に局所化**される。
- 抽象メソッドを各定数が実装する形なら、区分追加時の実装漏れを**コンパイラが網羅性チェック**する。
- `switch`/`if` で区分判定して処理を振り分ける設計は、同じ判定がコード中に散らばり、区分追加のたびに全箇所を直す必要がある。

## 2つのフォーム(使い分け)

### (A) constant-specific method 型 — ロジックが短く区分内で完結するとき
各定数が抽象メソッドを直接オーバーライド。簡潔。

```java
enum FeeType {
    ADULT  { public Yen fee() { return new Yen(100); } },
    CHILD  { public Yen fee() { return new Yen(50);  } },
    SENIOR { public Yen fee() { return new Yen(80);  } };
    public abstract Yen fee();   // 各定数が実装を強制される(コンパイラが網羅チェック)
}
```

### (B) Strategy 委譲型 — ロジックが複雑/状態を持つ/別テストにしたいとき
各定数が Strategy 実装インスタンスを保持し、enum は処理を委譲する。増田さんも「区分ごとのロジックが複雑なら別クラスに切り出して委譲」と述べる。

確定サンプル: `suwa-sh/enum-example`(https://github.com/suwa-sh/enum-example)。文字列定義 `"replace('arg1','arg2')"` をパースして区分ごとに異なる文字列変換を適用する例。`parse()` ファクトリ + interface 分離 + 網羅テスト付き。

```java
enum ExpressionType {
    append(new AppendExpression()),
    replace(new ReplaceExpression());

    private final Expression expression;        // 区分ごとの Strategy を保持
    ExpressionType(Expression e) { this.expression = e; }

    static ExpressionType parse(String exprDef) {   // "replace('arg1','arg2')"
        var type = ExpressionType.valueOf(typeName(exprDef));  // "replace"
        type.expression.init(argsDef(exprDef));     // 引数を Strategy に渡して初期化
        return type;
    }
    String evaluate(String value) {                 // 利用側は区分を意識せず委譲
        return expression.evaluate(value);
    }
    // typeName / argsDef … 文字列パース補助
}

interface Expression {
    void init(String argsDef);
    String evaluate(String value);
}
class ReplaceExpression implements Expression {
    private Argument from, to;
    public void init(String argsDef) {
        var args = new Arguments(argsDef, 2);       // 生成時に個数ガード
        this.from = args.get(0); this.to = args.get(1);
    }
    public String evaluate(String value) { return value.replaceAll(from.value(), to.value()); }
}
```

**使い分け基準**: ロジックが短く区分内で完結 → (A)。複雑/状態を持つ/区分単位でテストを分けたい → (B)。

## 状態遷移を表データ化する2方式

状態遷移ルールを if 連鎖でなく**表(テーブル)として一望**する。遷移ルールの追加・変更が表の編集に閉じる。

### 方式1: EnumMap で状態遷移表
```java
enum State {
    審査中, 承認済, 却下, 取消;
    private static final Map<State, Set<State>> ALLOWED = new EnumMap<>(State.class);
    static {
        ALLOWED.put(審査中, EnumSet.of(承認済, 却下));
        ALLOWED.put(承認済, EnumSet.of(取消));
        ALLOWED.put(却下,   EnumSet.noneOf(State.class));
        ALLOWED.put(取消,   EnumSet.noneOf(State.class));
    }
    boolean canTransitionTo(State next) { return ALLOWED.get(this).contains(next); }
}
```

### 方式2: Transition リスト(`(from, to, event)` を持つ)
enum がメソッドを持ち、遷移は `Transitions` クラスに委譲(増田 `business-logic-patterns` の `gate/State.java` 形式)。`next(from, event)`(次状態)・`expectedEvents(from)`(現状態で期待されるイベント)を引ける。イベント駆動の遷移に向く。

> 単純〜中規模はデータ化(EnumMap/リスト)、複雑な状態遷移は State パターン(各状態を別クラス)や状態遷移図と併用。

## 複合区分 → 結果の表引き

「遅延状況 × 会員種別」のような**複数区分の組合せ**を `Map` で結果に対応づける(増田 `conditions/RestrictionMap` 形式)。区分は enum、表は初期化ブロックで宣言的に定義し、`of(複合キー)` で結果を引く。

## アンチパターン / 区分への疑い

- 単なる定数列挙にして処理を利用側 switch/if に書く。
- getter で区分値を取り出し利用側で `if (type == X)` 判定する(区分判定の散在)。
- 遷移ルールを各所の if でハードコードし、表が一望できない。
- **区分を常に疑いの目で見る**: 誤った区分体系に enum でロジックを寄せると**コードが歪む** → それは区分体系を見直す気付き(ブレイクスルー)。

## 言語差(読み替え)

- **Java**: enum(constant-specific method / interface 実装)、複雑なら sealed class。
- **Kotlin**: variant がデータを持つ・成長するなら `sealed class` が適切。
- **Rust/Scala**: `enum`(ADT)が variant ごとのデータを自然に持てる。
- **TypeScript**: `enum` より **string-literal union / `as const`** が好まれる場面が多い(runtime JS を emit、`const enum` は isolatedModules 系で制約)。判別可能ユニオン(discriminated union)が (B) の代替。

詳しい適用条件・落とし穴(永続化の ORDINAL 問題、type discriminator の SRP/OCP 違反など)は `applicability-and-pitfalls.md` を参照。
