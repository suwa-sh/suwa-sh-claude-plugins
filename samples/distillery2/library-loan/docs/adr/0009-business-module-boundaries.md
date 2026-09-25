---
id: "0009"
title: "backend-api を蔵書・利用者・貸出予約・通知・蔵書分析の 5 つの業務モジュールに分ける"
status: accepted
date: "2026-09-25"
supersedes: []
superseded_by: null
basis: "requirements@4422a431dd381e737d643e7055432ad4b2330c9d"
nfr_refs: ["F.2.2.1"]
scope: [system]
confidence: medium
contexts:
  - id: "catalog"
    name: "蔵書"
    owner_tier: "backend-api"
    relations: []
  - id: "patron"
    name: "利用者"
    owner_tier: "backend-api"
    relations: []
  - id: "circulation"
    name: "貸出予約"
    owner_tier: "backend-api"
    relations:
      - to: "catalog"
        kind: "OHS"
      - to: "patron"
        kind: "OHS"
  - id: "notification"
    name: "通知"
    owner_tier: "backend-api"
    relations:
      - to: "circulation"
        kind: "Conformist"
      - to: "patron"
        kind: "OHS"
  - id: "analytics"
    name: "蔵書分析"
    owner_tier: "backend-api"
    relations:
      - to: "circulation"
        kind: "Conformist"
      - to: "catalog"
        kind: "Conformist"
rules:
  - scope: tier:backend
    text: "業務モジュールは catalog・patron・circulation・notification・analytics とし、各レイヤの直下にモジュール名のディレクトリを置く"
  - scope: tier:backend
    text: "他の業務モジュールのデータは、そのモジュールが公開する usecase のインターフェイス経由で使い、repository や domain を直接 import しない"
  - scope: tier:backend
    text: "蔵書と貸出・予約の状態をまたぐ更新 (貸出・返却・取り置き) は circulation モジュールの usecase が 1 トランザクションで行う"
---

# 背景

RDRA の情報はコンテキスト「蔵書管理」「利用者管理」「貸出管理」「予約管理」「通知管理」「蔵書分析管理」に分かれている。
貸出と予約は、返却時の取り置き・取り置き中の書籍の貸出のように、同じ操作の中で互いの状態を変える。
要求「将来的に電子書籍にも対応」は、蔵書と貸出の扱いが将来変わることを示す。

# 決定

- backend-api のモジュラモノリスを、次の 5 つの業務モジュールに分ける。

  | モジュール | 担当する情報 | 主な UC |
  |---|---|---|
  | catalog (蔵書) | 書籍・蔵書 | 書籍の登録・編集・削除・検索 |
  | patron (利用者) | 利用者・司書 | 利用者の登録・編集・削除、ログイン |
  | circulation (貸出予約) | 貸出・予約・貸出ルール | 貸出・返却・予約・予約取消・照会 |
  | notification (通知) | 通知 | 受取可能通知・返却期限リマインド・延滞督促 |
  | analytics (蔵書分析) | 在庫状況・貸出統計 (導出) | 在庫状況・人気ランキング・貸出統計 |

- 貸出管理と予約管理は 1 つのモジュール (circulation) にまとめる。互いの状態を同じトランザクションで変えるためである。
- 蔵書の状態 (在庫あり・貸出中・取り置き中) の変更は circulation の usecase が主導する。catalog は蔵書の状態を変える操作を公開する。
- 通知と蔵書分析は、貸出予約のモデルにそのまま従う (Conformist)。

# 却下した案

- RDRA のコンテキスト 6 つをそのまま 6 モジュールにする案: 貸出と予約が互いの状態を頻繁に変えるため、モジュール間の呼び出しが多くなりすぎる。
- モジュールに分けない案: 電子書籍対応など将来の変更の影響範囲を絞れない。
- モジュールごとに別サービスにする案: ADR 0001 のモジュラモノリスの決定と合わない。

# 影響

- 利点: 電子書籍対応は catalog と circulation の変更に閉じ込めやすい。
- 利点: 通知と分析が貸出予約の内部に依存しないため、それぞれ独立して作れる。
- 欠点: circulation が大きくなり、UC 7 本と条件の多くが集まる。
- 欠点: モジュール間の import 規則は現時点ではルール文のみで、機械検証は段階③以降に追加する。
