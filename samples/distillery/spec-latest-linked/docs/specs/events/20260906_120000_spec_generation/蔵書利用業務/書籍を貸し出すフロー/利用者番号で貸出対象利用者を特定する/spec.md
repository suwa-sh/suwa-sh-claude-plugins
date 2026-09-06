# 利用者番号で貸出対象利用者を特定する

## 概要

貸出登録が利用する `getLoanTarget` の所有UCを示す契約参照コンテキスト。
今回はこのUC本文を再生成・受入確認していない。実装可能と判定しない。

## 関連 RDRA モデル

業務定義は [RDRA latest](../../../../../../rdra/latest/BUC.tsv) の本UCを参照。
状態・条件が不足する場合はRDRAへ還流し、このページに業務判断を追加しない。

## E2E 完了条件

本UCのE2Eは今回未実施。貸出登録からの参照契約解決のみを確認する。

## ティア別仕様

- [API契約参照](tier-backend-api.md)
- `_api-summary.yaml` / `_contract-slice.json` はcompiler生成物。
