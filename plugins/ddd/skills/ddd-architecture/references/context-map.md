# コンテキストマップ(統合パターン)

複数の境界づけられたコンテキスト間の関係を俯瞰する。**上流(upstream)/ 下流(downstream)の力関係**で読む。

## パターン一覧

| パターン | 概要 | 使う場面 |
|---|---|---|
| **Shared Kernel(共有カーネル)** | 2チームがモデルの一部(小サブセット)を共有し密に協調。変更は双方合意 | 密結合を許容できる小領域のみ。基本は避け独立性優先 |
| **Customer-Supplier(顧客/供給者)** | 上流(供給)と下流(顧客)に優先順位の交渉関係。下流ニーズが上流計画に反映 | 下流の要求を上流が汲める関係のとき |
| **Conformist(順応者)** | 下流が上流のモデルをそのまま採用(命名・癖ごと) | 下流が上流に影響を及ぼせないとき |
| **Anti-Corruption Layer / ACL(腐敗防止層)** | 上流モデルが下流を汚染しないよう境界で翻訳する層(Facade/Adapter) | 上流の汚いモデルを取り込みたくない。レガシー統合・外部API連携 |
| **Open Host Service / OHS(公開ホストサービス)** | アクセスをサービス群のプロトコルとして公開 | 下流が多数。個別対応をやめ公開プロトコルで一括対応 |
| **Published Language(公表された言語)** | 共有された明示フォーマット(業界標準・標準スキーマ) | OHS と組で使う |

## 選び方

- 自分が上流か下流か、影響力を持てるかで選ぶ。
- 影響力ゼロ → **Conformist** か **ACL**。
- 上流の汚いモデルを取り込みたくない → **ACL** を必ず挟む(コスト増だが下流モデルの純度を守れる)。
- 下流が多数 → 個別対応をやめ **OHS + Published Language**。
- 2チームの密結合を許容できる小領域のみ **Shared Kernel**(基本は避け、独立性を優先)。
- マイクロサービス境界では「同一プロセス内 = ACL 翻訳」「クロスプロセス = 統合イベント + 共有 ID(共有エンティティは持たない)」。

## 出典

- Open Group, DDD Strategic Patterns: https://pubs.opengroup.org/architecture/o-aa-standard/DDD-strategic-patterns.html
- Context Mapper: https://contextmapper.org/docs/context-map/
- Fowler「BoundedContext」https://martinfowler.com/bliki/BoundedContext.html
