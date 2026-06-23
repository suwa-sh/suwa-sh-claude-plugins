# サブドメイン分類(Core / Supporting / Generic)

戦略的設計の核心は**投資配分**。ドメインを3種に仕分け、リソース(優秀な人員・モデリング労力)をどこに集中するかを決める。

## 3分類

- **Core(コアドメイン)**: ビジネスの競争優位の源泉。ここで差別化する。最良・最も献身的な開発者を割り当て、最大の DDD 投資(深いモデリング/リファクタ)を集中する。
- **Supporting(支援サブドメイン)**: コアを支えるが差別化要因ではない。必須で時に複雑だが競争はしない。**good enough** に留め、完璧を目指して時間を溶かさない。
- **Generic(汎用サブドメイン)**: 多くの組織に共通(認証・給与・帳票・ドキュメント保管)。**自作しない、買う/借りる**(OSS/SaaS/既製品)。市場に解が無いときのみ自作。

## 判断の問い

- 「ここで他社に勝つか?」が Yes → **Core**。最優秀人材と最大投資をここへ。
- 「必須だが差別化しない」→ **Supporting**。good enough 狙い。
- 「どこにでもある共通機能」→ **Generic**。買う/借りる。

## 注意

- **Distillation(蒸留)**: ドメインを識別・分離・明確化して「より重要なもの(Core)に集中」できるようにする。Generic 部分を既製品で省力化し、Core に労力を回す。
- Bounded Context(解決空間)と Subdomain(問題空間)は理想的には一致するが、現実には misaligned することを前提に分類する。
- コアドメインの重要・高頻度修正の機能ほど、モデリング/リファクタ投資が正当化される(重要度ベースの判断)。

## 出典

- Eric Evans『Domain-Driven Design』Part IV(Strategic Design / Distillation)
- Vaughn Vernon『実践ドメイン駆動設計(IDDD)』戦略的設計章
- (整理) https://blog.jonathanoliver.com/ddd-strategic-design-core-supporting-and-generic-subdomains/
