# distillery-implの変更ガイド

初期の対応範囲は移行元0.12.0以降、移行先は下表にある版。Distilleryの版とは別の版系列として扱う。
導入版はgit履歴のplugin.jsonと差分で確認した。ガイドの存在は、その全バージョンの実装出力で移行を実行検証済みという意味ではない。
未登録の版、0.12.0より前、ダウングレードは調査と計画までとし、差分ガイドを補ってから実施する。

| 導入版 | 項目ID | 変更ポイント | ガイド |
|---|---|---|---|
| 0.13.0 | ASSUMPTION-EVIDENCE | Implementerの補完判断とVerifier・人レビューの証跡 | [状態とコード](state-and-code.md)のASSUMPTION-EVIDENCE |
| 0.13.1 | CONCISE-SPEC-READ | 簡潔なUC/tier仕様と参照先を読む | [仕様との接続](spec-handoff.md)のCONCISE-SPEC-READ |
| 0.13.2 | UC-CONTRACT-SLICE | summary v2・slice・SHA-256・manifest/read-set | [契約と設定](contracts-and-config.md)のUC-CONTRACT-SLICE |
| 0.13.3 | LATEST-HTTP-SOURCE | 分割HTTPのbundle、latest参照、上流不足の扱い | [契約と設定](contracts-and-config.md)のLATEST-HTTP-SOURCE、[仕様との接続](spec-handoff.md) |
| 0.13.4 | ASYNC-RDB-SOURCE | 分割AsyncAPI/RDBの入力と変更検知 | [契約と設定](contracts-and-config.md)のASYNC-RDB-SOURCE |
| 0.13.5 | RDB-OWNER-READ | 小さいテーブル所有索引から読む | [契約と設定](contracts-and-config.md)のRDB-OWNER-READ |
| 0.13.6 | PROPOSAL-READINESS | 採用後のspec本文と本文外の採用状況を区別 | [仕様との接続](spec-handoff.md)のPROPOSAL-READINESS |
| 0.13.7 | API-SOURCE-PROBE | AsyncAPIの旧パス固定probeを契約レジストリに統一 | [契約と設定](contracts-and-config.md)のAPI-SOURCE-PROBE |
| 0.14.0 | IMPL-MIGRATION-GUIDE | dist-impl-migre追加。生成契約・stage schemaの変更なし | この表のみ |

`from < 導入版 <= to`の行を候補とし、現物を見て適用・適合済み・対象外・要確認に分ける。
同じ入力ファイルを複数の項目が変更するときは、導入順に判断し、編集は移行先の最終形にまとめてよい。
同じ版への移行は互換性の再確認とし、既に整合しているファイルを作り直さない。

例: 0.13.6からインストール済み0.14.0へはAPI-SOURCE-PROBEとIMPL-MIGRATION-GUIDEを選ぶ。
ただし上流specも変わっていれば、版差分とは別に[接続確認](spec-handoff.md)で依存する契約とstageを調べる。

中間版を明示された場合は、その版の資材を隔離環境で使う。新しいテンプレート・状態規約を古い移行先へ適用しない。
