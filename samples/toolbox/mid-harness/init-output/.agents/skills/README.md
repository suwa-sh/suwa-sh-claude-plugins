# .agents/skills

実行可能な skill の正本です。`<name>/SKILL.md` の front matter は `name` と `description` だけにし、製品固有の field は書きません。

```text
<name>/
├── SKILL.md
├── references/
│   ├── desired-state.md     # この skill だけの完了条件と検証コマンド
│   └── troubleshooting.md   # この skill 固有の失敗と復旧
└── scripts/
```

Claude Code 向けの `.claude/skills/` は `.agents/harness.yaml` の `skills_mode` に従って生成されます (手で置かない)。
