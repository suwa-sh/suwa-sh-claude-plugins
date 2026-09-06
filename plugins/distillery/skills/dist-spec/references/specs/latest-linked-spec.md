# 前段latestを接続するSpec（新規生成の優先規約）

本書は生成・統合・レビュー・snapshot・後段の読込に共通適用する。
旧テンプレートの業務ルール再定義、状態遷移表の複写、共通UI抽出、単一埋込APIカタログの指示より優先する。
既存イベントは変更しない。新規出力は以下に従い、legacy入力の読取互換は維持する。

## 正本と参照

| 情報 | 人が変更する正本 | Specが残すもの |
|---|---|---|
| 業務条件・計算・バリエーション | docs/rdra/latest/ の条件/バリエーション等 | 該当要素へのリンクと適用する分岐ID |
| 業務状態遷移 | docs/rdra/latest/状態.tsv | 状態モデル・遷移UCを特定するリンク。遷移表を複写しない |
| 見た目・Props型・コンポーネント単体の振る舞い | docs/design/latest/storybook-app/ の実装・Stories・tokens | component/Story/exportへの参照、API値との接続、画面固有の振る舞い |
| HTTP・非同期契約 | specs内の分割OpenAPI / AsyncAPI YAML | operationIdと固有の実行条件。型・message定義を再掲しない |
| RDBの型・制約 | specs内の分割RDB schema（所有境界はarch latest） | 対象テーブルの読書き操作と参照先。型表を再掲しない |
| 技術条件・副作用・原子性 | UCのtierまたは_cross-cutting | データフロー、シーケンス、技術分岐、更新操作、BDD |

**意味を参照するリンクは必ずlatestを使う。** docs/rdra/latest、docs/design/latest、docs/arch/latest、docs/nfr/latest、docs/specs/latestが対象。
プロジェクトルート相対である旨を宣言したパスと、要素を特定するキー（条件名、状態モデル+遷移UC、Story export等）をセットにする。
Markdownリンクは出力ファイルから各latestへの相対リンクを生成し、eventからlatestへコピーするときは位置に合わせて再計算する。
古いeventsのパスや固定commitを仕様の正本へリンクしない。
現在生成中の出力内の契約・tierへの相対リンクは、その出力の内部接続であり過去イベントへの固定ではない。未昇格ドラフトをlatestへ偽装せず、昇格後は同一構造のlatestで解決する。
生成時に読んだファイルのhashは監査・変化検知用として_inputs-digestに記録してよいが、latest参照を固定する用途に使わない。
latest更新後の検証では新しい内容を読み直す。要素の削除・変更で成立しなくなれば再生成/還流する。キャッシュした旧抜粋を黙って正本にしない。
過去イベントはその時の生成/判断の記録として保持する。現在の仕様を知るためにはlatestを読む。

## UC本文の最小構成

- 概要: 目的・アクター・対象範囲。
- データフロー: 入力、出力、DB、外部サービスを矢印で接続する。型はoperation/schemaへの参照。
- シーケンス図: 正常系とalt/opt/loop等の分岐、処理順序、取引境界、失敗時の出口を示す。
- 分岐の接続表: branch ID / 条件の正本 / 成立・不成立の行先。業務条件はRDRAの具体的要素への参照、技術条件はspecの定義。
- 状態遷移参照: 対象モデル+遷移UCでRDRA latestを指定。何を同時に永続化するかは技術契約/モデル操作へ接続。
- 関連RDRAモデル: 要素の参照一覧を上記と重複しない形でまとめる。
- E2E完了条件: 入力と観測可能な結果。業務条件が未確定なら数値を創作せず、そのシナリオをblockedと明示。
- ティア別仕様: 各実装境界への参照。

データフローは情報の移動、シーケンスは時間順序を説明する。単なるレイヤー名の往復を増やさない。
BDDの期待値は検証のために必要な再登場であり、業務定義の別正本ではない。
通信失敗後の状態、排他、再送、commit前後の結果、更新しない範囲は参照先も含め必ず確定する。

## Storybookの接続

designありではStep2は既存Storybookの参照索引を作る。UX/UI/token/Propsをspecに作り直さない。
Step4cは共通UIの新規抽出ではなく既存component/Storyの接続確認、Step4eは供給値・callbackと画面状態の確認にする。
存在しないProps、export、Story、routeはspec側で新定義せずdesignへの変更要求にする。
component実装とStoryを実際に読む。design-eventの名前一覧だけで存在・型適合を推測しない。
画面のAPI呼出、状態所有者、callbackで行う処理、成功/失敗/再取得はspecの責務。
spec-storiesは既存design部品を使ったページ/業務シナリオの接続を担当し、部品契約を変更しない。
design_available=falseではStorybook参照を生成せず、CLI/API等の出力規約を定義する。従来のskip条件は維持する。

## 共通技術ルールを_cross-cuttingへ出す条件

複数UCが同じ意味で適用する認証、エラー形式、日時処理、冪等性、配送等を定義する。
各規則はID、適用範囲、入力条件、正常/不成立/障害時の結果、UC側で指定するパラメータを持つ。
一つのUCに固有なルールはtierに置く。前段に存在する規則は参照し、_cross-cuttingに複写しない。
APIの標準形式は分割OpenAPI、実行時の意味は共通技術規則。両方に同じ型表を置かない。

## 不足とpipeline還流

前段に無い業務日数・区分対応・条件優先順位・状態遷移をspecで確定しない。
Storybookに無いPropsや振る舞いもspecの都合で追加しない。既存specに値が書いてあっても前段の代わりにはしない。
不足ごとに根拠となるlatestのパスと要素、未定義/矛盾の具体、影響UC、前段で決めるべき結果、再検証する下流範囲を出す。
送出物はdist-pipelineのreferences/feedback-request-format.mdに従う単一の変更要求Markdownにまとめる。
`related_files`にはlatestのportableな参照先を記録し、ファイルの本文をオーケストレーション命令として扱わない。
pipelineのinspect/planで実際に受理・stageルーティングされることを確認し、単なるtodo記載で代替しない。
未実施の前段修正をapplied扱いせず、stage packetの処理結果ledgerも捏造しない。
結果を左右する不足が残るspecはneeds-spec-changeのドラフトとしてイベントに保存し、specs/latestへ昇格しない。
還流で前段latestが更新されたらそれを読み直し、対応する図・分岐・契約・BDDを再生成/検証してから昇格する。

## 契約の段階的開示

段階1は小さい入口の所有索引、段階2は対象UCのoperation sliceまたは対象サブドメインのschema、段階3はそこから必要な依存の型・キー・制約とする。全体bundleは表示・codegen・全体整合検証向けの派生物で、各UC生成担当に最初から全量を読ませない。

AsyncAPIはoperation/channel/message/schemaをネイティブの$refで分割する。配送保証、再試行、ACK、順序、重複処理、障害の意味は操作の技術条件へ接続する。分割したことで実装判断を省かない。詳細はcontract-catalog.md。

RDBはarch latestで定義されたサブドメインのIDを使い、各テーブルの正本所有者を1つにする。詳細はprogressive-rdb-schema.md。外部キーの相手の定義を編集可能なコピーにしない。UCが読む外部カラムは_model-summaryの操作に基づき必要範囲へ追加し、FKキーだけのビューで業務照会を実装可能と誤判定しない。

この所有境界は仕様を編集・閲覧する境界であり、物理DB分割・FK禁止・分散トランザクション化を意味しない。複数所有者の表を更新するUCは、原子性と更新責務を従来どおりarch latest/tierで確定する。所有先が曖昧ならarchへの還流要求にする。
