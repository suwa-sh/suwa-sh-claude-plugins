# 適用条件と落とし穴(when not to / やりすぎ兆候)

戦術DDD批判の大半は「DDDが間違い」ではなく「**適用条件・分離設計・集約サイズ・永続化整合を外すと逆効果**」。各パターンに「適用条件(when)」「やりすぎ兆候(smell)」「ORM/言語による妥協点」をセットで持たせる。以下は SKILL.md 本文の判断ゲート/レビュー観点を支える根拠と but/except 条項。

## 1. 適用判断ゲート(最重要)

- **Core/複雑ドメインか?** を最初に問う。単純CRUD・Genericサブドメイン・短命MVP・1〜2人/数週間では**トランザクションスクリプト/アクティブレコードを許容**し、戦術パターンを適用しない。
- 根拠: 完全DDDは素朴実装の**約8〜9倍のコード量**になりうる(実測: Controller 直接80行/1〜2ファイル vs 完全DDD 700行/20+ファイル)。大規模再編で「ROI ほぼゼロ」の体験談もある。
- 戦術パターンを domain discovery より先に適用すると「巨大な泥団子」化(dogmatic/pattern-driven DDD)。

## 2. 貧血モデルが正しい場面

- **ステートレス HTTP / 関数型(FP)/ CQRS の read 側・projection・DTO** では貧血が最適。リクエストごとにロード&破棄される object に振る舞いを貼る必要はない。
- リッチを要求するのは「振る舞いを持つべき write 集約」に限定する。

## 3. Always-Valid は invariant 限定

- 入力検証(input validation)はアプリケーション層で Result 型などで返し、不変条件(invariant)のみ集約内で例外。「全部 entity 内で検証」は SRP 違反。
- 妥当性が操作文脈で変わるドメイン、共有DB/外部由来データは reconstitution 時に再検証する。

## 4. 値オブジェクトの乱造を避ける

- **振る舞い/不変条件を持つ値だけ VO 化**。単なる型安全のためのラップは費用対効果で判断(値が単一 scope に閉じ振る舞いを持たないなら primitive で可)。
- ロジックが複数の値にまたがるなら、VO に早期固定せず集約/サービスに置く(早期固定で修正が複数箇所に拡散)。
- 補足: 実務では VO の overuse より underuse のほうが問題、という反対意見もある(バランスで判断)。

## 5. 集約は小さく

- 子コレクション無制限の大集約は性能劣化(基本操作で数千 object をロード)・楽観ロックの false contention を招く。Vernon 自身が "Design Small Aggregates" を説く。
- eager fetch を既定にしない。即時 cross-aggregate 整合が必須なら境界を見直す。

## 6. ORM 採用時の妥協(Java/.NET)

- Hibernate/JPA は no-arg constructor + reflection で再構成 → invariant 強制コンストラクタをバイパスし得る。embeddable は final フィールド不可で真の不変 VO を作りにくい。→ `protected no-arg ctor + static factory` で妥協し、reflection 裏口の存在を認識する。
- EF Core owned type(VO 推奨機構)は optional/共有/polymorphic/global query filter で破綻する場合がある(soft-delete が漏れる等)。
- 楽観ロックは coarse 集約で false contention・子コレクション変更で root version が bump されない落とし穴がある。

## 7. 振る舞いを持った enum の限界

- **閉じた安定集合に限定**。variant が異なるデータを持つ/集合が成長する/per-instance の可変状態が要るなら **sealed class / ADT / 判別可能ユニオン**へ。
- **永続化**: JPA `@Enumerated(ORDINAL)` は並べ替えで silent corruption → **STRING / AttributeConverter** を使う(ORDINAL 禁止)。
- type discriminator として外部で switch するのは SRP/OCP 違反 → ポリモーフィズム(各状態を別クラス)で。
- **言語差**: TypeScript の enum は string-literal union/`as const` が好まれる場面が多い。Kotlin は sealed class、Rust/Scala は ADT。

## 8. イミュータブルデータモデルは履歴/監査に限定

- INSERT only は二重管理コスト(イベント+スナップショット)・検索性能の壁を伴う。スナップショット併用前提。
- 削除フラグ等の物理パターンを一律「悪」と決めつけない。

## 9. 戦略 ≥ 戦術の順序

- 戦術パターンを domain discovery より先に適用しない。境界づけられたコンテキスト/集約境界が未確定なら ddd-architecture スキルで戦略を先に固める。

## メタ含意

各プラクティスに「適用条件(when)」「やりすぎ兆候(smell)」「ORM/言語による妥協点」をセットで添えれば、推奨を大きく変えずに頑健化できる。「DDDを使うべきでない場面(when not to use)」を明示することが、DDD への最大の批判(その欠如)への回答になる。

## 出典(主要)

- sho_fcafe「DDDは本当に必要か?(8-9倍実測)」https://qiita.com/sho_fcafe/items/517035a31bcc3fe5743a
- Vernon「Effective Aggregate Design / Design Small Aggregates」
- Stefan Tilkov (INNOQ)「Is DDD overrated?」 / Derek Comartin「STOP doing dogmatic DDD」
- これらの反証は「DDDが間違い」でなく「適用条件を外すと逆効果」を示すもの。各プラクティスに適用条件をセットで添えること。
