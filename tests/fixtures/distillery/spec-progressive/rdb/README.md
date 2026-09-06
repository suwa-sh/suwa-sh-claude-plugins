# RDB 分割の実行サンプル

現行 legacy-pipeline の `specs/latest/_cross-cutting/datastore/rdb-schema.yaml` から **books / users / loans の 3 テーブルをそのまま抽出**し、arch/latest が宣言する所有者で分割した。全テーブルの移行や業務仕様の再承認を行ったサンプルではない。現行に含まれる「要確認」の説明も勝手に解消せず、そのまま維持する。

| 正本 | arch の対応 | 自領域全文 | 外部参照 |
|---|---|---|---|
| domains/SD-001.yaml | BC-003 / E-004 / 蔵書貸出・予約 | loans | books.book_id、users.user_no |
| domains/SD-002.yaml | BC-001 / E-001 / 蔵書目録 | books | なし |
| domains/SD-003.yaml | BC-002 / E-002 / 利用者管理 | users | なし |

人が編集するのは `rdb-schema.yaml` の一覧と `domains/*.yaml` の所有テーブル。貸出の実装者は入口 → `generated/table-index.yaml` の `loans` → `domains/SD-001.yaml` の順に開き、FK 対象の型は `generated/domain-slices/SD-001.yaml` で確認する。書籍タイトルや利用者連絡先など参照先の非キー列まで必要なら、該当所有者の正本を追加で開く。

実行は `/private/tmp/dist-progressive-rdb-JuV5pR` に現行 arch/latest と編集用 3 ファイルを置いて行った。`compileRdbSchema.js` で bundle と 3 slice を生成し、`--check` 成功後に本ディレクトリへコピーした。その後、テーブル所有者の小索引を生成対象へ追加し、本ディレクトリで再生成・検証した。編集ファイルに追加した情報は arch で確認済みの `entity_id` とサブドメインの所有宣言だけ。生成 bundle の 3 テーブルは現行の定義と構造一致する。

再実行（リポジトリルート）:

```sh
npm ci
node plugins/distillery/skills/dist-spec/scripts/compileRdbSchema.js samples/distillery/spec-progressive/rdb/rdb-schema.yaml
node plugins/distillery/skills/dist-spec/scripts/compileRdbSchema.js samples/distillery/spec-progressive/rdb/rdb-schema.yaml --check
```

これは文書の段階的開示の例であり、別 DB への分離や分散トランザクション化を意味しない。arch 参照は入口の `architecture_ref` が指定する **latest**。
