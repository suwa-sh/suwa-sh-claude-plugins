# 更新済みspecとの接続

## 前段の確認

出力の場所は既存impl-configのspecs_rootを起点に解決する。パスが無効なら移転先を確認する。
Distilleryとdistillery-implのplugin版は独立して記録し、数値が一致することを互換条件にしない。
Distilleryの移行記録がある場合は結果・未解決項目・変更されたlatestを読む。記録がない場合は現物の入力形式・整合性を確認する。

| 確認対象 | 比較する情報 |
|---|---|
| UCとtier | 現在のspec-event、UC本文、既存uc-mapのID・業務/BUC/UCパス・tier対応 |
| API/RDB | catalog、bundle、slice、モデル操作と既存contracts宣言・lock |
| UI | design latestの実在するexport・Story・variantと既存packages/ui・画面結線 |
| 実行条件 | 最新の技術ルール・業務条件とdev-rules・コード・テスト |
| 採用状態 | 未採用の提案、needs-spec-change、上流の不足・矛盾 |

欠落を「新形式なので不要」と解釈しない。参照元が未採用・矛盾ありなら、影響する実装の完了を判定しない。
対象外のUC・tierまで巻き戻さず、依存を辿って影響範囲を特定する。

## CONCISE-SPEC-READ — 0.13.1

旧dev-rulesやローカルの作業指示が、型表・状態遷移表・Props説明の本文内展開を必須としていないか確認する。
本文が簡潔になった箇所は参照先を読み、実装に必要な条件が残っているか判断する。
移行先の[読み込み規約](../../dist-impl-implement/SKILL.md)と[tier規約](../../dist-impl-bootstrap/references/dev-rules/tier-rules.md)を基準に、ローカルルールの必要部分だけを修正する。
ユーザーが追記したコーディング規約・テスト命令・UCタグ等を、テンプレートの再生成で消さない。

## LATEST-HTTP-SOURCE — 0.13.3の接続確認

意味の正本はspecs/rdra/design等のlatest。過去イベントを監査証跡として参照する箇所とは区別する。
latestの対象要素が旧参照と同じ意味か確認してから接続を更新する。
版変更だけで新しい業務条件を決めず、不足は具体的な変更要求として上流へ返す。

## PROPOSAL-READINESS — 0.13.6

本文に記載された具体案が、上流で採用済みかを本文外のレビュー記録から照合する。
採用後の姿が書かれているだけでは実装着手可能とみなさない。未採用のdraftをlatestの確定仕様の代わりに選ばない。
[dist-impl-runの入力確認](../../dist-impl-run/SKILL.md)に従い、上流latest・契約・BDDが整合した範囲を使う。
還流待ちなら影響箇所を記録し、既存承認や完了記録を新しい仕様にも有効だと推測しない。

上流の移行が必要な場合はdist-migreへ渡す対象と不足を示す。両方の移行を依頼されていれば順に実行する。
別pluginのファイル位置や利用可能性を推測せず、実際にインストールされたskillを解決する。
