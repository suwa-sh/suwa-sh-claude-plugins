---
okf_version: "0.2"
---

# リポジトリのメモリー

エージェント専用 knowledge の入口です。短い routing table として保ち、詳細は各ファイルに置きます。

## 基本の期待状態
- リポジトリ全体を変更するとき: [リポジトリの期待状態](../../docs/architecture/README.md)
- 作業を完了する前: [品質ゲート](../../docs/rules/README.md)

## 必要なときに読む
- CI が失敗したとき: [CI のトラブルシューティング](../../docs/troubleshooting/README.md)

## 昇格ルール
- 一つのスキルだけで使う知識は、そのスキルの `references/` に置く
- 二つ以上のスキルで再発したら、`desired-state/` または `troubleshooting/` へ昇格し、この索引に 1 行足す
- 製品の自動生成メモリーの内容は、再現確認してから明示ファイルへ移す
