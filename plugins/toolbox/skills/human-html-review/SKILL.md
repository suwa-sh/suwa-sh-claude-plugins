---
name: toolbox:human-html-review
description: 前提知識ゼロのレビュアーがメンタルモデルを再構築して判断できる、自己完結型の decision-ready なレビュー HTML を生成するスキル。自律コーディングエージェントの成果、実装レビュー・設計レビュー、プランレビュー、アーキテクチャ変更、調査成果物、選択肢からの意思決定など、背景・代替案・レビュー対象の構造/振る舞い/データモデル・根拠・リスク・承認や選択後に起きることを人間が理解する必要がある場面で使う。
metadata:
  dependencies:
    - diagram-design # https://github.com/cathrynlavery/diagram-design — install: npx skills add cathrynlavery/diagram-design
---

# Human HTML Review

事前コンテキストのないレビュアーが、根拠を持って判断できる状態まで到達するための派生レビュービューを作る。Git・PR・CI・仕様書・ソースファイルが正本（system of record）であることは維持する。

## 入力とデフォルト

`$ARGUMENTS` は「レビュー対象 + 任意の判断モード・base/head リビジョン・出力パス」として扱う。対象の指定がなければ、現在のリポジトリの変更をレビューする。

例:

```text
$human-html-review current changes --mode approval
$human-html-review choose auth migration approach --mode selection
$human-html-review PR 123 --output tmp/reviews/pr-123.html
```

- 完成した成果を「承認するか、修正を求めるか」判断してもらうときは `approval` を使う。
- 未確定の選択肢から選んでもらうときは `selection` を使う。
- 依頼内容からモードが明確なら推論する。それでもあいまいなら `approval` を使い、その仮定をレビュー契約に明記する。
- 出力先のデフォルトは現在のリポジトリ配下の `tmp/reviews/<target>-review.html`。
- 明示的な依頼がない限り既存のレビューを上書きしない。代わりにリビジョンサフィックスを付ける。
- 明示的な依頼がない限り、コミット・公開・デプロイ・正式承認の記録は行わない。

レビュー作成の前に [references/review-contract.md](references/review-contract.md) を最後まで読むこと。[assets/review-template.html](assets/review-template.html) をコピーして改変すること。レイアウトをゼロから作り直さない。

## 依存関係

### diagram-design（Step 4 の図に必須）

このスキルのすべての図（構造 / 振る舞い / データモデル、Step 4）は **diagram-design** スキルに従う: スタイルガイドのトークン、ノードの装飾、コネクタの必須ルール、複雑さの予算、出力前の taste gate。3 つのビューは次の型に対応づける:

| ビュー | diagram-design の型リファレンス |
|---|---|
| 構造 | `references/type-architecture.md` |
| 振る舞い | `references/type-flowchart.md`（メッセージ順序や状態遷移が主役なら `type-sequence.md` / `type-state.md`） |
| データモデル | `references/type-er.md` |

**存在チェック（Step 4 の前に実行）:** `~/.claude/skills/diagram-design/SKILL.md` またはプロジェクトの `.claude/skills/diagram-design/SKILL.md` にスキルが存在するか確認する。無ければ、次の内容をそのままユーザーに提示し、インストールするか確認する:

> `diagram-design` スキルがインストールされていません。レビューの図の作成に必要です。
>
> - ソース: <https://github.com/cathrynlavery/diagram-design>
> - セキュリティ監査: <https://skills.sh/cathrynlavery/diagram-design>
> - インストール: `npx skills add cathrynlavery/diagram-design`

ユーザーが拒否した場合は、[references/review-contract.md](references/review-contract.md) のみに従った素のインライン SVG にフォールバックし、レビュー契約セクションに `diagram-design: not installed (fallback)` と記録する。

**制約の競合解決 — 競合時はこのスキルが勝つ:**

- **外部アセット禁止。** diagram-design の Google Fonts `<link>` は含めない。代わりにシステムフォントスタックを使う（sans: `"Hiragino Sans","Noto Sans JP",Inter,system-ui,sans-serif`、mono: `"SF Mono",Menlo,Consolas,monospace`）。
- **自己完結の 1 ファイル。** 各図はレビュー HTML 内のインライン SVG として埋め込む。diagram-design の個別 `.html` ファイルは出力しない。
- **アクセシビリティは維持。** レビュー契約が求めるとおり、`role="img"`、アクセシブルネーム、各図の下の文章説明を保つ。

## ワークフロー

### 1. レビュー契約を確立する

冒頭に明記する:

- 判断モード: `approval` または `selection`
- 人間に求める判断そのもの
- レビュー対象と base/head リビジョン
- 目的、成功基準、制約、スコープ、除外スコープ
- 既知の不明点と、入手できない根拠

コード、diff サマリ、エージェントのトランスクリプトから書き始めない。

### 2. すべての主張を根拠づける

成果を生んだソースを検分する: リポジトリの指示、関連する仕様や issue、ソースコード、base/head diff、スキーマ、テスト、コマンド、ログ、スクリーンショット、いまも有効な過去の意思決定。

HTML を書く前に根拠台帳（evidence ledger）を作る。各記述を次に分類する:

- `observed`: コード、diff、コマンド出力、スキーマ、その他の一次成果物が直接裏づける
- `agent-claim`: 生成したエージェントの報告だが、独立には確認されていない
- `inference`: 論理的な解釈。前提を明記する
- `human-decision`: レビュアーに委ねる

欠けた背景や図のエッジを捏造しない。欠落は `unknown` または `unverified` として明示する。

### 3. 因果のタイムラインを構築する

本文の語り順はこれを使う:

1. トリガーと目的
2. 制約と成功基準
3. 検討した代替案
4. 採用した成果、または現在開いている選択肢
5. レビュー対象そのもの
6. 検証と例外
7. 人間の判断
8. 判断のあとに起きること

判断の説明に必要な出来事だけを要約する。時系列の作業ログを再現しない。

### 4. 採用結果・選択肢のあとにレビュー対象を説明する

判断に関わるスライスについて、3 つのビューをすべて作る:

1. **構造**: コンポーネント、責務、依存関係、境界、変更されたノード。
2. **振る舞い**: トリガー、メインパス、出力、副作用、失敗パス、変更前後の振る舞い。
3. **データモデル**: エンティティ、関係、所有、永続化、ライフサイクル/状態遷移、マイグレーションの影響。

3 つのビューはすべて **diagram-design** スキルで描く（依存関係の節を参照）: まず存在チェックを実行し、描く前に SKILL.md と対応する `references/type-*.md` を読み込み、スタイルガイドのトークンとコネクタの必須ルールを適用し、各図に出力前の taste gate をかける。読めるテキストのインライン SVG を使う。すべてのノードにラベルを付け、接続する。observed な事実と inference を区別して示し、可能なら図の要素をソースのアンカーにリンクする。図の境界と省略した領域を明記する。

### 5. 対象モデルのあとに根拠を提示する

根拠は、それが支える主張やモデル要素の隣に置く。「テストが通った」だけでなく、コマンド・範囲・リビジョン・終了ステータス・除外を示す。

次の項目は折りたたみを開かなくても見えるようにする:

- 失敗と警告
- `not-run`、`unknown`、`unverified`
- 破壊的変更、権限、データマイグレーション、外部契約、セキュリティの変更
- 古くなった根拠やリビジョン不一致
- 未解決のレビュアーからの質問

折りたたむのは、繰り返しの成功ログや低リスクの補足詳細だけ。生の根拠への経路を用意する。

### 6. 判断ブランチを描画する

`approval` の場合:

- 採用した成果、残存リスク、blocking / non-blocking の指摘を示す
- `Approve` と `Request changes` を別々のアクションまたは注記対象として提供する
- 承認が何をトリガーし、何が可逆のままかを説明する

`selection` の場合:

- 実在する選択肢を 2 つ以上、非推奨の選択肢を弱めずに比較する
- すべての選択肢について、ユーザーへの結果・構造・振る舞い・データへの影響・コスト・リスク/不明点・可逆性・次のアクションを示す
- 機能差だけでなく、各選択のあとに生じる状態を説明する
- どの仮定や評価軸が変われば推奨が変わるかを明記する
- 選択のあとにエージェントと人間が何をするかを説明する

### 7. 自己完結の HTML を 1 ファイル生成する

同梱テンプレートを 1 回の完全な書き込みで改変する。

- `<html lang>` と内容がわかる `<title>` を設定する。
- インライン CSS とインライン SVG を維持する。外部アセット、フォント、Mermaid ランタイム、CDN、iframe、フォーム、JavaScript は使わない。
- セマンティックな見出し、ランドマーク、テーブル、figure、キャプション、キーボードで見えるフォーカス、色以外のステータスラベルを維持する。
- 注記ツールがフィードバックをアンカーできるよう、テンプレートの `data-*` 契約と安定した要素 ID を維持する。
- 使わない approval/selection ブランチとすべての `{{PLACEHOLDER}}` を除去する。
- 390 px と 1440 px の幅で成果物が使えることを保つ。

### 8. 検証と目視確認

実行する:

```bash
# <skill-base-dir> = このスキルのロード時に表示される "Base directory for this skill"
python3 "<skill-base-dir>/scripts/validate.py" "<output.html>"
```

すべてのエラーを修正する。その後、利用可能なブラウザまたはスクリーンショットツールで HTML を開き、狭い幅と広い幅の両方のレイアウトを目視確認する。確認事項:

- 因果の順序がすぐに見えるか
- 対象モデルの 3 つの図が読めるか
- 例外が視覚的に埋もれていないか
- 承認/選択のコントロールが宣言したモードと一致しているか
- 各選択肢の将来の状態と次のアクションが明示されているか
- 生の根拠に到達できるか

ブラウザが使えない場合は、目視確認を実施しなかったと報告する。合格したと主張しない。

## 完了時の応答

次を返す:

- 出力の絶対パス
- 判断モードとソースリビジョン
- バリデータの結果と目視確認を実施したか
- 残っている失敗、未検証項目、除外スコープ
- レビュアーがいまどんな判断を下せるのかを 1 文で

実際の承認システムと統合されていない限り、HTML 自体が正式な承認を記録すると主張しない。
