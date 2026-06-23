# ファーストクラスコレクション(First-Class Collection)

「一覧・履歴・集合」という関心事をオブジェクト化する。生の `List`/`Set`/`Map` を引き回さず専用クラスでラップし、コレクション操作(=ビジネスルール)を1クラスに閉じ込める。操作の**意図を公開し、実装(for/while/Stream)を隠蔽**する。

## 規約

- **コレクションを1つだけ持つ専用クラス**を作る(例: `Offers`,`MailBox`,`SkillSet`)。
- コレクション操作を**業務語彙のメソッド**として公開する(下表)。
- **不変を保つ**: 内部コレクションを直接外に返さず、操作結果は新しいコレクションオブジェクトとして返す(防御的コピー / 不変公開)。
- null を流通させない。空のときは空コレクションを返す。

## メソッドの候補表(増田 DevLOVE 2019 網羅表より)

| 計算の種類 | メソッド例 | 結果の型 |
|---|---|---|
| サイズ | `count()` | int |
| 要素の検査 | `contains(要素)`,`isEmpty()`,`notEmpty()` | boolean/enum |
| 部分集合 | `select(条件)`,`reject(条件)` | コレクション |
| 集約演算 | `sum()`,`min()`,`max()`,`average()` | 集約結果の型 |
| 集合演算 | `intersect(other)`,`minus(other)`,`add(other)` | コレクション |
| 変換 | `unique()`,`sort()`,`groupBy()` | コレクション |
| 要素の取り出し | `first()`,`last()`,`at(index)` | 要素の型 |
| 要素の追加 | `add()`,`addAll()`,`append()`,`insertAt()` | void(または新コレクション) |
| 文字列表現 | `show()`,`describe()` | 文字列 / 文字列[] |

## アンチパターン

- 生 `List<Xxx>` を getter で露出し、利用側で `stream().filter()...` を書く。
- 同じ集計・抽出ロジックが複数の利用側に重複する(バグの温床)。
- **コレクションが要素の内部状態を直接覗く**(`loan.status == 承認済` を集合側で判定する)。これは Tell Don't Ask が一段弱く、状態語彙がコレクションに漏れる。要素側に業務語彙の述語メソッド(`loan.isActiveOn(date)` / `loan.isUnderReview()`)を持たせ、コレクションは**それを呼ぶ**だけにする。フィルタ条件が複数コレクションに散らばらず、判定が要素に凝集する。

## コード例(Java)

```java
class Offers {
    private final List<Offer> list;
    Offers(List<Offer> list) { this.list = List.copyOf(list); } // 不変公開
    Offers 有効なものだけ() {
        return new Offers(list.stream().filter(Offer::isValid).toList());
    }
    Amount 合計金額() {
        return list.stream().map(Offer::amount).reduce(Amount.ZERO, Amount::plus);
    }
    int 件数() { return list.size(); }
}
```

> 引数列のラッパ(`Arguments`)など小さな集合も、生成時に個数・形式をガードすればファーストクラスコレクションになる(`suwa-sh/enum-example` の `Arguments` 参照)。
