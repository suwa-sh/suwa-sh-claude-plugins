# 構造（C4 Model）

## Level 1: System Context

```mermaid
graph LR
  User["ユーザー"]
  CC["Claude Code<br/>セッション"]
  HANDOVER["HANDOVER.md"]
  NextCC["Claude Code<br/>次セッション"]

  User -- "作業指示" --> CC
  CC -- "PreCompact hook<br/>で自動生成" --> HANDOVER
  User -- "/handover<br/>で手動生成" --> HANDOVER
  HANDOVER -- "SessionStart hook<br/>で自動注入" --> NextCC
```

**ユーザー**: Claude Code を利用する開発者
**システム**: Claude Code のセッション管理 + hooks 機構

## Level 2: Container

```mermaid
graph TB
  subgraph Claude_Code["Claude Code"]
    Skill["/handover スキル<br/>（手動トリガー）"]
    PreCompact["PreCompact Hook<br/>（自動トリガー）"]
    SessionStart["SessionStart Hook<br/>（自動注入）"]
    MainAgent["メイン Agent"]
    Transcript["トランスクリプト<br/>（JSONL）"]
  end

  HANDOVER["HANDOVER.md<br/>（cwd直下）"]

  Skill --> MainAgent
  MainAgent -- "会話コンテキストから直接生成" --> HANDOVER
  Transcript -- "stdin: transcript_path" --> PreCompact
  PreCompact -- "jq + claude -p で要約" --> HANDOVER
  HANDOVER -- "stdout 注入<br/>→ 読み取り後削除" --> SessionStart
  SessionStart --> MainAgent
```

| コンテナ | 役割 | スクリプト |
|---------|------|-----------|
| /handover スキル | 手動でメイン Agent に引き継ぎ生成を指示 | `skills/handover/SKILL.md` |
| PreCompact hook | コンパクション前にトランスクリプトを要約 | `hooks/pre_compact.sh` |
| SessionStart hook | HANDOVER.md を読み取りコンテキストに注入 | `hooks/session_start.sh` |
| メイン Agent | セッションの主体。/handover 実行時は自ら生成 | - |

## Level 3: Component（PreCompact hook）

```mermaid
flowchart TD
  A["1. JSON stdin 受信<br/>transcript_path, cwd"]
  B["2. トランスクリプト存在チェック"]
  C["3. jq フィルタ<br/>text + tool_use のみ抽出"]
  D["4. フィルタ結果を一時ファイルに保存"]
  E["5. SKILL.md からテンプレート抽出<br/>+ フィルタ結果を claude -p sonnet にパイプ"]
  F["6. 出力を一時ファイルに書き込み"]
  G["7. mv で HANDOVER.md にリネーム"]
  H["trap: 一時ファイル削除"]

  A --> B
  B -- "ファイルなし" --> Z["exit 0"]
  B -- "ファイルあり" --> C
  C --> D
  D -- "空" --> Z
  D -- "データあり" --> E
  E --> F
  F -- "出力なし" --> Y["exit 1"]
  F -- "出力あり" --> G
  G --> H
```

### jq フィルタの詳細

```mermaid
flowchart LR
  subgraph Input["トランスクリプト JSONL"]
    I1["assistant<br/>（text, tool_use,<br/>thinking）"]
    I2["user<br/>（text, tool_result）"]
    I3["progress"]
    I4["system"]
    I5["file-history-snapshot"]
  end

  subgraph Filter["jq フィルタ"]
    F1["assistant → text + tool_use"]
    F2["user → text のみ"]
    F3["他 → 除外"]
  end

  subgraph Output["フィルタ結果"]
    O1["assistant<br/>{type, content}"]
    O2["user<br/>{type, content}"]
  end

  I1 --> F1 --> O1
  I2 --> F2 --> O2
  I3 --> F3
  I4 --> F3
  I5 --> F3
```

## Level 3: Component（SessionStart hook）

```mermaid
flowchart TD
  SA["1. JSON stdin 受信<br/>cwd"]
  SB["2. HANDOVER.md 存在チェック"]
  SC["3. ファイル内容を読み取り"]
  SD["4. ファイル削除<br/>（再注入防止）"]
  SE["5. stdout に出力<br/>=== 前回セッションからの引き継ぎ ===<br/>[content]<br/>=== 引き継ぎ終了 ==="]

  SA --> SB
  SB -- "ファイルなし" --> SZ["exit 0<br/>（何もしない）"]
  SB -- "ファイルあり" --> SC --> SD --> SE
```
