# RDB スキーマのサブドメイン別開示

新規生成では小さな入口 → 担当サブドメイン → 必要な参照先の順に読む。これは文書の分割単位であり、DB・SQL schema・サービス・トランザクションの物理的な分割を指示しない。

## 編集する正本

```text
_cross-cutting/datastore/
  rdb-schema.yaml                    # 所有者と読み込み先だけ
  domains/
    SD-001.yaml                      # このサブドメインが所有する全テーブル
    SD-002.yaml
  generated/                         # 編集禁止、以下は再生成する
    table-index.yaml                 # テーブル名 → 所有者と正本の小索引
    rdb-schema.bundle.yaml           # 従来の version/datastore/tables 形
    domain-slices/
      SD-001.yaml                    # 自領域全文 + 他領域の参照キー
      SD-002.yaml
```

入口例:

```yaml
schema_version: distillery.rdb-split/v1
version: '1.0'
datastore: rdb
architecture_ref: ../../../../arch/latest/arch-design.yaml
domains:
  - id: SD-001
    file: domains/SD-001.yaml
  - id: SD-002
    file: domains/SD-002.yaml
```

`architecture_ref` は入口からの相対パスで、その配置に合わせて計算する。上のパスは `docs/specs/latest/_cross-cutting/datastore/` の例。参照先は常に `arch/latest/arch-design.yaml`。イベントパスへの固定は禁止する。

各領域ファイルは `subdomain_id: SD-001` と `tables: [...]` を持つ。テーブルの型・列・PK・FK・索引は従来の `datastore-rules.md` と同じ。各テーブルに `entity_id: E-004` を追加し、arch の `bounded_contexts[].owned_entity_ids` → `related_subdomain_id` で所有者を検証する。テーブル定義は一度だけ記載する。

arch が未定義、所有者が不明・複数候補、技術テーブルの対応 entity が未合意の場合は architecture へ還流する。便宜的な「共通」領域や新しい境界を spec で作らない。既存一枚形式は引き続き読めるが、分割への移行時に所有者を確定する。

## 読む順番

1. 入口で分割形式とサブドメイン一覧を確認し、`generated/table-index.yaml` で対象テーブルの `subdomain_id` と `source` を引く。全領域の本文を開く必要はない。索引にはテーブル名・所有者・正本への相対パスだけを置き、型や制約は複製しない。
2. その `domains/{id}.yaml` または生成 slice を読む。自領域は型・制約・索引・利用 UC の全文が揃う。
3. FK の参照先は slice の `external_tables` に所有者、正本への相対 `source`、`read_only: true`、必要なキー列のみを示す。自領域の制約を理解するための投影であり、書き込み権限を定義しない。
4. 参照先の非キー列や業務上の解釈が実装に必要な場合だけ、その所有者ファイルを追加で読む。全 bundle は全体整合性の検証やマイグレーション生成時に読む。

生成 slice は FK の参照キー、PK、および推移的な FK を追うための列と関連を保持する。非 PK の unique キーを参照する場合は、その一意性索引も含める。無関係な表示列・検索索引・業務説明を他領域へ丸ごと複製しない。循環参照は訪問済み集合で終端させる。

## 生成と検証

```sh
node plugins/distillery/skills/dist-spec/scripts/compileRdbSchema.js \
  docs/specs/latest/_cross-cutting/datastore/rdb-schema.yaml
node plugins/distillery/skills/dist-spec/scripts/compileRdbSchema.js \
  docs/specs/latest/_cross-cutting/datastore/rdb-schema.yaml --check
```

実際の新規生成はイベントのドラフトディレクトリで行い、レビュー後に latest を更新する。コマンドの引数はその入口に置き換える。

Node.js と `yaml@2.9.0` が必要。リポジトリでは `npm ci`、インストールしたプラグインでは `YAML_MODULE=/absolute/path/to/node_modules/yaml` または `NODE_PATH` で用意した依存を解決する。実行中の無断インストールは行わない。

`--check` は生成しない。所有者の重複、未宣言 subdomain、entity の所有不一致、列/PK/索引の不整合、FK の参照先・列・型・複合キー長・無条件の一意性、更新漏れを検出する。部分 unique 索引は FK 対象の無条件一意性を満たさない。出力先と領域ファイルの symlink/path traversal を拒否する。削除した領域の古い slice はエラーとし、明示的に除去してから再生成する。

JavaScript 統合 API は `compileRdbSchema(entryPath, { check: true|false })`。入口の判別には `schema_version === 'distillery.rdb-split/v1'` を使う。返却値に `inputs` と `outputs` を含むため、イベント検証側の入力監査と生成物マニフェストへ追加できる。bundle 自体は従来形を保ち、分割用の `entity_id` は含めない。全体 ER 図は必要時に bundle から描画し、編集可能な第二の定義として保持しない。
