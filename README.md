# suwa-sh-claude-plugins

Claude Code のカスタムプラグイン集。

## インストール

Claude Code で以下を実行:

```
/plugin marketplace add suwa-sh/suwa-sh-claude-plugins
```

## プラグイン一覧

| プラグイン | 説明 | インストール |
|-----------|------|-------------|
| [handover](./plugins/handover/) | セッション間コンテキスト自動引き継ぎ | `/plugin install handover@suwa-sh-claude-plugins` |
| [launch-claude](./plugins/launch-claude/) | ghq管理リポジトリでGhosttyタブにClaude Codeセッションを起動 | `/plugin install launch-claude@suwa-sh-claude-plugins` |
| [distillery](./plugins/distillery/) | 要望テキストから要件定義・アーキ・インフラ・デザインシステム・仕様までを蒸留生成（RDRA/USDM/NFR パイプライン）。[出力サンプル](samples/distillery) | `/plugin install distillery@suwa-sh-claude-plugins` |

## ライセンス

[MIT License](./LICENSE)
