# ddd

ドメイン駆動設計(DDD)の戦術設計(実装)と戦略的設計(アーキテクチャ)を、増田亨・little_hands(松岡幸一郎)・Martin Fowler の知見に沿って適用する2スキル。

## 概要

DDD のプラクティスは「1つの境界内でドメインモデルをどうコード化するか(戦術)」と「大きな問題をどう分割し境界をどう結ぶか(戦略)」の二層に分かれる。本プラグインはこれを2スキルに対応させている。

- **`ddd-tactical-implementation`(実装常用)** — ドメインモデルの実装・レビュー時に使う。値オブジェクト / 振る舞いを持った enum(区分)/ ファーストクラスコレクション / 集約 / ドメイン貧血回避。冒頭に**適用判断ゲート**があり、単純な CRUD・Generic な機能では「DDD を盛らない」判断を促す。コード例は Java 主軸だが、TypeScript / Python / Go / Kotlin への翻訳指針(`language-notes.md`)を備え、各言語のイディオムで適用できる。
- **`ddd-architecture`(アーキテクチャ設計)** — 新規サブシステムの設計・境界の見直し・モジュール/サービス分割の判断時に使う。サブドメイン分類(Core/Supporting/Generic)→ 境界づけられたコンテキスト → コンテキストマップ → 戦術への落とし込み・配置形態、を「設計の問い」のチェックリストで進める。

2スキルは「戦略 → 戦術」の順序で接続し、相互参照する。各スキルは段階的開示(薄い SKILL.md + 必要時に読む `references/`)で構成。

### 特徴

- **適用判断ゲート**: 戦術DDDを単純対象に適用すると逆効果(コード量が数倍に膨らむ)。「Core/複雑ドメインか」を最初に問い、不要なら無理に適用しない。
- **やりすぎ兆候を併記**: 各プラクティスに「いつ裏目に出るか」「ORM/言語による妥協点」をセットで持たせている(貧血が正しい場面、Always-Valid の invariant 限定、大集約の害、enum の限界など)。
- **言語横断**: Java 主軸 + 言語別翻訳ノート。区分は TS では union、Go では typed const、Python では frozen dataclass + enum、というイディオム翻訳と「実行時境界の再検証」を明記。

## インストール

```
/plugin marketplace add suwa-sh/suwa-sh-claude-plugins
/plugin install ddd@suwa-sh-claude-plugins
```

## 使い方

実装時・設計時に自動で発火する(description ベース)。明示呼び出しも可能:

- `/ddd:ddd-tactical-implementation` — 「このビジネスロジックをどこに置く」「値オブジェクトにしたい」「区分を enum で」「集約の境界」「貧血モデルを直す」など
- `/ddd:ddd-architecture` — 「どこで境界を切る」「マイクロサービスの分割線」「モジュラモノリスの構成」「コアドメインはどこ」など

## 出典

増田亨『現場で役立つシステム設計の原則』/ 値オブジェクトのカタログ(business-logic-patterns)、little_hands(松岡幸一郎)DDD質問箱・モデリングガイド、Eric Evans『Domain-Driven Design』、Vaughn Vernon『実践ドメイン駆動設計』、Martin Fowler bliki、Vladimir Khorikov(Always-Valid)など。各 reference ファイル末尾に出典 URL を記載。
