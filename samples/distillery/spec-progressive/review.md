# 段階的開示の独立レビュー

対象: 分割 AsyncAPI の compiler/helper、分割 RDB の compiler、生成サンプル、latest-linked-spec / progressive-rdb-schema / distillery-impl の契約読込規約。2026-09-06 に生成担当と別のレビュアーが全スクリプトを読み、以下を実行した。

## 検証結果

- `node --test tests/dist-spec-split-asyncapi.test.js`: 8 件成功。分割正本を変更せず bundle と UC slice を生成し、payload 修正で古い投影を検出する。再生成で伝播し、欠けた参照は出力前に拒否する。consumer の依存 operation / channel / message / payload / server が揃い、無関係な operation は provider の slice に混入しない。循環 payload の参照も有限のまま保持する。公式 AsyncAPI parser でも bundle の error 診断は 0 件。
- `node --test tests/dist-spec-split-rdb.test.js`: 8 件成功。宣言済み所有者、テーブル所有の一意性、列・キー・参照先・型・無条件 unique の検証、推移的/循環 FK の閉包、正本変更後の更新漏れを確認した。実サンプルの 3 テーブルは現行 latest と構造一致する。
- 両サンプルの compiler `--check` は成功。さらに RDB サンプルの隔離コピーで FK の列を 1 個増やし、`FK arity mismatch` により生成を拒否することを独立に確認した。

## レビューで修正した点

初期の汎用 AsyncAPI bundle では `operation.messages` が `components/messages` への参照に短縮されていた。生成担当へ指摘し、解決先オブジェクトの同一性を確認して参照中の channel の message に戻す処理と回帰テストが追加された。同名でも異なる payload を持つ message の付け替えは拒否する。これは [AsyncAPI 3.0 の Operation Object 規定](https://www.asyncapi.com/docs/reference/specification/v3.0.0#operationObject) に必要な保持であり、単に JSON Pointer が解決できるだけでは十分でない。

正本一覧の RDB 行が arch 配下の schema を示し、詳細規約が specs 配下を示していたため、統合担当へ表記修正を依頼し、修正を確認した。所有境界・entity の正本は arch/latest、列・型・制約の編集正本は specs の分割 RDB schema と区別する。

## 読み手が判断できる範囲

入口から担当 domain/operation を選び、必要な依存だけを追加で開く構造になっている。RDB slice は自領域の型・制約を保持し、外部領域には参照キーと所有者の正本リンクを残す。非キー列が必要な照会では、その正本を追加で読む。キーだけの外部投影から完全な row 型や DDL を生成してよいという意味ではない。

サブドメインによる文書分割から、物理 DB 分離・FK 禁止・分散トランザクション化を導いていない。RDB サンプルが引き継ぐ現行の「要確認」事項を承認済みに変えておらず、3 テーブルの分割実演は上流の意味や全システム仕様の再承認ではない。

今回の検証は構造・参照・投影更新・限定した AsyncAPI 標準検証である。実 DB への migration、イベント broker 実行、全 UC の再生成は対象外。
