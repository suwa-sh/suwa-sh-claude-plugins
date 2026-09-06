# バージョン間の変更ガイド

対象はDistillery出力の移行。変更の導入版はplugin版であり、成果物内のschema_versionとは別に扱う。
今回の移行範囲は1.9.4以降、移行先は下表の導入版まで。表にない版を対応済みと推測しない。
未登録の版、ダウングレード、他pluginの版指定は、範囲を調査してガイドを追加するまで移行実施を保留する。

| 導入版 | 項目ID | 出力の変更点 | 読むガイド |
|---|---|---|---|
| 1.9.5 | SPEC-CONCISE | UC・tierの重複を減らす | [仕様本文](spec-writing.md)のSPEC-CONCISE |
| 1.10.0 | API-CATALOG | 正本契約・summary v2・UC slice | [契約](contracts.md)のAPI-CATALOG |
| 1.11.0 | LATEST-OWNERS | 業務・UIの正本をlatest参照にし、HTTP契約を分割 | [仕様本文](spec-writing.md)のLATEST-OWNERS、[契約](contracts.md)のHTTP-SPLIT |
| 1.12.0 | ASYNC-RDB-SPLIT | AsyncAPIとRDBを分割 | [契約](contracts.md)のASYNC-RDB-SPLIT |
| 1.12.1 | RDB-OWNER-INDEX | テーブル所有索引から段階的に読む | [契約](contracts.md)のRDB-OWNER-INDEX |
| 1.13.0 | PRODUCT-SPEC | 本文は採用後の姿、採用状況は別記録 | [仕様本文](spec-writing.md)のPRODUCT-SPEC |
| 1.13.1 | SAMPLE-ONLY | 公開サンプルの差し替え。利用者の出力への一律変更なし | この表のみ |
| 1.13.2 | README-INDEX | READMEからADR・イベントのdomain索引を参照 | [派生ビュー](derived-views.md)のREADME-INDEX |
| 1.13.3 | TRACE-MATRIX | RDRA要素を行、全UCを列にする | [派生ビュー](derived-views.md)のTRACE-MATRIX |
| 1.13.4 | TRACE-TYPE | 要素の種類を日本語の列で示す | [派生ビュー](derived-views.md)のTRACE-MATRIX |
| 1.13.5 | TRACE-SUMMARY-JA | サマリーの種類も日本語にする | [派生ビュー](derived-views.md)のTRACE-MATRIX |
| 1.13.6 | API-DIRECTORIES | OpenAPIとAsyncAPIの編集ディレクトリを分離 | [契約](contracts.md)のAPI-DIRECTORIES |
| 1.13.7 | REPO-ONLY | 開発用plans・testsの整理。利用者の出力への一律変更なし | この表のみ |
| 1.14.0 | MIGRATION-GUIDE | dist-migre追加。出力契約は1.13.7と同じ | この表のみ |
| 1.14.1 | INSTALLED-TARGET | インストール済み版への移行とdist-impl-migreへの引継ぎを明記。出力契約の変更なし | この表のみ |

## 選び方

- `from < 導入版 <= to`の行を候補にする。候補の各項目は現物を見て適用要否を決める。
- 上流や一部UCだけ既に新形式なら、その範囲は適合済みとして証拠を残す。版だけで全域を作り直さない。
- 移行元と移行先が同じ場合は修正を予定せず、現物との整合確認だけ行う。
- 1.13.5 → 1.14.0ならAPI-DIRECTORIESを判断し、REPO-ONLYとMIGRATION-GUIDEは出力変更なしと記録する。
- 1.9.4 → 1.14.0なら全行を検討する。API型・制約の正本化を確認してから本文の重複を削除する。
- この表の変更なし行を理由に利用者の`plans/`や`tests/`を削除しない。公開サンプルを利用者固有の成果物へコピーしない。

## 中間版を移行先にする場合

各項目は導入版時点の差分である。後の項目を先取りしない。
現在の生成スクリプト・テンプレートが移行先より新しい出力を作る場合、そのまま使用しない。
移行先のplugin資材を隔離環境に用意して確認する。用意できない場合は計画と差分調査までとし、対象版への移行完了を報告しない。
