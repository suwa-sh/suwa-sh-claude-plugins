# 実装着手の判定

業務条件と状態はRDRA latest、部品契約はdesign latest、型と保存構造は分割契約を正本とする。処理結果を変える未決事項は残っていない。レビューは別著者の3グループと親による再確認を実施した。モデル修正ではレビュー担当が別ターンで編集を担当し、その結果を生成担当と親が再確認した。

| UC | 確認した経路 | 根拠 | 残る判断 | 判定 |
|---|---|---|---|---|
| [予約状況を参照する](../利用者サービス業務/自分の利用状況を確認するフロー/予約状況を参照する/spec.md) | 本人の有効予約と順位を表示する / 許可されない主体へ情報を返さない | [step3-analysis-service-round2.yaml](step3-analysis-service-round2.yaml)、UCの契約/モデル/BDD | 結果を変える未決事項なし | ready |
| [利用者の利用状況を参照する](../利用者サービス業務/自分の利用状況を確認するフロー/利用者の利用状況を参照する/spec.md) | 指定利用者の利用状況をまとめて表示する / 許可されない主体へ情報を返さない | [step3-analysis-service-round2.yaml](step3-analysis-service-round2.yaml)、UCの契約/モデル/BDD | 結果を変える未決事項なし | ready |
| [貸出履歴を参照する](../利用者サービス業務/自分の利用状況を確認するフロー/貸出履歴を参照する/spec.md) | 本人の履歴だけを表示する / 許可されない主体へ情報を返さない | [step3-analysis-service-round2.yaml](step3-analysis-service-round2.yaml)、UCの契約/モデル/BDD | 結果を変える未決事項なし | ready |
| [利用者を削除する](../利用者管理業務/利用者を管理するフロー/利用者を削除する/spec.md) | 利用者を削除するの業務結果 / 利用者を削除するの不成立時 | [step3-catalogue-users-round2.yaml](step3-catalogue-users-round2.yaml)、UCの契約/モデル/BDD | 結果を変える未決事項なし | ready |
| [利用者を登録する](../利用者管理業務/利用者を管理するフロー/利用者を登録する/spec.md) | 利用者を登録するの業務結果 / 利用者を登録するの不成立時 | [step3-catalogue-users-round2.yaml](step3-catalogue-users-round2.yaml)、UCの契約/モデル/BDD | 結果を変える未決事項なし | ready |
| [利用者を編集する](../利用者管理業務/利用者を管理するフロー/利用者を編集する/spec.md) | 利用者を編集するの業務結果 / 利用者を編集するの不成立時 | [step3-catalogue-users-round2.yaml](step3-catalogue-users-round2.yaml)、UCの契約/モデル/BDD | 結果を変える未決事項なし | ready |
| [利用者一覧を参照する](../利用者管理業務/利用者を管理するフロー/利用者一覧を参照する/spec.md) | 利用者一覧を参照するの業務結果 / 利用者一覧を参照するの不成立時 | [step3-catalogue-users-round2.yaml](step3-catalogue-users-round2.yaml)、UCの契約/モデル/BDD | 結果を変える未決事項なし | ready |
| [延滞を判定する](../期限管理業務/延滞者に督促するフロー/延滞を判定する/spec.md) | 期限を過ぎた貸出を延滞にする / 期限当日は延滞にしない | [cross-circulation-deadline.json](cross-circulation-deadline.json)、UCの契約/モデル/BDD | 結果を変える未決事項なし | ready |
| [延滞一覧を参照する](../期限管理業務/延滞者に督促するフロー/延滞一覧を参照する/spec.md) | 延滞と督促結果を確認する / 返却済みを除く | [cross-circulation-deadline.json](cross-circulation-deadline.json)、UCの契約/モデル/BDD | 結果を変える未決事項なし | ready |
| [督促を送信する](../期限管理業務/延滞者に督促するフロー/督促を送信する/spec.md) | 督促を配信する / 返却済みを除外する | [cross-circulation-deadline.json](cross-circulation-deadline.json)、UCの契約/モデル/BDD | 結果を変える未決事項なし | ready |
| [リマインドを送信する](../期限管理業務/返却期限を通知するフロー/リマインドを送信する/spec.md) | リマインドを配信する / 返却後は配信しない | [cross-circulation-deadline.json](cross-circulation-deadline.json)、UCの契約/モデル/BDD | 結果を変える未決事項なし | ready |
| [リマインド対象を抽出する](../期限管理業務/返却期限を通知するフロー/リマインド対象を抽出する/spec.md) | 期限が近い貸出を抽出する / 期間外を除外する | [cross-circulation-deadline.json](cross-circulation-deadline.json)、UCの契約/モデル/BDD | 結果を変える未決事項なし | ready |
| [書籍を検索する](../蔵書管理業務/書籍を検索するフロー/書籍を検索する/spec.md) | 書籍を検索するの業務結果 / 書籍を検索するの不成立時 | [step3-catalogue-users-round2.yaml](step3-catalogue-users-round2.yaml)、UCの契約/モデル/BDD | 結果を変える未決事項なし | ready |
| [書籍詳細を参照する](../蔵書管理業務/書籍を検索するフロー/書籍詳細を参照する/spec.md) | 書籍詳細を参照するの業務結果 / 書籍詳細を参照するの不成立時 | [step3-catalogue-users-round2.yaml](step3-catalogue-users-round2.yaml)、UCの契約/モデル/BDD | 結果を変える未決事項なし | ready |
| [書籍を削除する](../蔵書管理業務/蔵書を管理するフロー/書籍を削除する/spec.md) | 書籍を削除するの業務結果 / 書籍を削除するの不成立時 | [step3-catalogue-users-round2.yaml](step3-catalogue-users-round2.yaml)、UCの契約/モデル/BDD | 結果を変える未決事項なし | ready |
| [書籍を登録する](../蔵書管理業務/蔵書を管理するフロー/書籍を登録する/spec.md) | 書籍を登録するの業務結果 / 書籍を登録するの不成立時 | [step3-catalogue-users-round2.yaml](step3-catalogue-users-round2.yaml)、UCの契約/モデル/BDD | 結果を変える未決事項なし | ready |
| [書籍を編集する](../蔵書管理業務/蔵書を管理するフロー/書籍を編集する/spec.md) | 書籍を編集するの業務結果 / 書籍を編集するの不成立時 | [step3-catalogue-users-round2.yaml](step3-catalogue-users-round2.yaml)、UCの契約/モデル/BDD | 結果を変える未決事項なし | ready |
| [書籍一覧を参照する](../蔵書管理業務/蔵書を管理するフロー/書籍一覧を参照する/spec.md) | 書籍一覧を参照するの業務結果 / 書籍一覧を参照するの不成立時 | [step3-catalogue-users-round2.yaml](step3-catalogue-users-round2.yaml)、UCの契約/モデル/BDD | 結果を変える未決事項なし | ready |
| [予約を取り消す](../貸出業務/書籍を予約するフロー/予約を取り消す/spec.md) | 通知済みの先頭を取り消す / 最後の予約を取り消す | [cross-circulation-deadline.json](cross-circulation-deadline.json)、UCの契約/モデル/BDD | 結果を変える未決事項なし | ready |
| [予約を登録する](../貸出業務/書籍を予約するフロー/予約を登録する/spec.md) | 予約待ちの紙書籍を予約する / 電子書籍を拒否する | [cross-circulation-deadline.json](cross-circulation-deadline.json)、UCの契約/モデル/BDD | 結果を変える未決事項なし | ready |
| [予約一覧を参照する](../貸出業務/書籍を予約するフロー/予約一覧を参照する/spec.md) | 順位順で確認する / 有効予約がない | [cross-circulation-deadline.json](cross-circulation-deadline.json)、UCの契約/モデル/BDD | 結果を変える未決事項なし | ready |
| [貸出を登録する](../貸出業務/書籍を貸し出すフロー/貸出を登録する/spec.md) | 在庫書籍を貸し出す / 予約待ちの先頭以外を拒否する | [cross-circulation-deadline.json](cross-circulation-deadline.json)、UCの契約/モデル/BDD | 結果を変える未決事項なし | ready |
| [返却を登録する](../貸出業務/書籍を返却するフロー/返却を登録する/spec.md) | 予約のある返却 / 予約のない延滞返却 | [cross-circulation-deadline.json](cross-circulation-deadline.json)、UCの契約/モデル/BDD | 結果を変える未決事項なし | ready |
| [返却通知を送信する](../貸出業務/書籍を返却するフロー/返却通知を送信する/spec.md) | 返却通知が成功する / 同じ通知契機を再要求する | [cross-circulation-deadline.json](cross-circulation-deadline.json)、UCの契約/モデル/BDD | 結果を変える未決事項なし | ready |
| [人気書籍ランキングを参照する](../運営分析業務/蔵書の利用状況を分析するフロー/人気書籍ランキングを参照する/spec.md) | 同数を同順位として表示する / 許可されない主体へ情報を返さない | [step3-analysis-service-round2.yaml](step3-analysis-service-round2.yaml)、UCの契約/モデル/BDD | 結果を変える未決事項なし | ready |
| [在庫状況一覧を参照する](../運営分析業務/蔵書の利用状況を分析するフロー/在庫状況一覧を参照する/spec.md) | 書籍の状態と有効予約数を表示する / 許可されない主体へ情報を返さない | [step3-analysis-service-round2.yaml](step3-analysis-service-round2.yaml)、UCの契約/モデル/BDD | 結果を変える未決事項なし | ready |
| [期間別貸出統計を参照する](../運営分析業務/蔵書の利用状況を分析するフロー/期間別貸出統計を参照する/spec.md) | 貸出のない日を0件で表示する / 許可されない主体へ情報を返さない | [step3-analysis-service-round2.yaml](step3-analysis-service-round2.yaml)、UCの契約/モデル/BDD | 結果を変える未決事項なし | ready |

上流5提案は[proposal-baseline.md](proposal-baseline.md)で実際の採用イベントとlatestを照合した。正式なfeedback controller closureの完了を意味しない。

機械検査は27UC×3種類=81件PASS。188モデル操作の列・値・照合条件を検査し不一致0件。トレースは113要素すべてに実在リンクがあるが、このリンク数は意味上の充足率ではない。

既知の非阻害事項: Redoclyのlicense未記載warning（ライセンスを推測して補わない）、AsyncAPI 3.1への更新推奨info、legacy validatorの変更概要/固定RDRA列名warning。実装コード・実メール配信の稼働試験はこの仕様生成の範囲に含まない。
