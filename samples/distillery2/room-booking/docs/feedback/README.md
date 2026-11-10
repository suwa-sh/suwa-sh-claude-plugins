<!-- この一覧は distillery2 (genDocsReadme.js) が課題ファイルから生成する。手で書かない -->

# 未処理の課題

実装で見つかった上流 (要求・決定・契約) の穴。要求の課題は要求の段階が、ルール・契約の課題は還流が反映し、反映したら課題ファイルを削除する (中身は git の履歴に残る)。

要求・ルール・契約の課題なし。

## プラグインへ持ち帰る課題

還流で「直す場所は distillery2 (生成器・テンプレート・手順書) 側」と分かった課題。還流の対象ではなく、このリポジトリでは何もしない。プラグインを直したら人が課題ファイルを削除する。

| 種類 | 題名 | 出どころの UC | 元の種類 |
|---|---|---|---|
| プラグイン | [契約テストの生成が query の引数を送れない](20261104_212550_contract_contract-20261104T211921Z_contract-test-query-params.md) | view-room-availability | - |
| プラグイン | [tracedFetch の親 span が画面を指す](20261104_215913_integrate_integrate-20261104T215038Z_tracer-span-header.md) | view-room-availability | - |
| プラグイン | [抽出が閉じると決めた課題も未決に数える](20261105_001434_asbuilt_asbuilt-refute-20261105T001154Z_extract-counts-closed-issues.md) | view-room-availability | - |
| プラグイン | [DB 契約テストが一意制約の弾きを確かめない](20261109_221603_refute_foundation-refute-20261109T220912Z_db-contract-unique-not-checked.md) | - | - |
| プラグイン | [秘密の検出が生成物の除外を受け継ぐ](20261109_221603_refute_foundation-refute-20261109T220912Z_secrets-scan-inherits-excludes.md) | - | - |
| プラグイン | [シーケンス図が並行の呼び出しを順に描く](20261110_000610_asbuilt_asbuilt-refute-20261110T000412Z_sequence-parallel-calls.md) | view-room-availability | - |
| プラグイン | [業務の拒否の戻りを図で ok と描く](20261110_012536_refute_refute-asbuilt-20261110T012020Z_asbuilt-business-reject-as-ok.md) | reserve-room | - |
| プラグイン | [取り消された書き込みを分岐の表で書き込みと数える](20261110_025303_asbuilt_asbuilt-20261110T024639Z_asbuilt-rolled-back-write-as-write.md) | reserve-room | - |
