#!/usr/bin/env node
// appendTodo.js - docs/todo.md への追加提案を追記する CLI
//
// Usage:
//   node appendTodo.js --skill <name> --event <id> --type <type> --title <title> --body <md>
//   node appendTodo.js --help
//
// 依存なし（Node.js 標準モジュールのみ）。
// 冪等性: 同一 (skill, event, title) の組はスキップ（exit 0, "skipped" 出力）。
// 書き込み先: 実行時の process.cwd() 配下の docs/todo.md

'use strict';

const fs = require('fs');
const path = require('path');

function printHelp() {
  const help = `appendTodo.js - docs/todo.md に追加提案を追記する

Usage:
  node appendTodo.js --skill <name> --event <id> --type <type> --title <title> --body <md>
  node appendTodo.js --help

Options:
  --skill  <name>    発生元スキル名 (required)
  --event  <id>      発生元イベントID (required)
  --type   <type>    提案種別 (RDRA追加 / NFR追加 / Arch追加 など) (required)
  --title  <title>   提案タイトル (required)
  --body   <md>      本文 (markdown 可) (required)
  --file   <path>    出力先（既定: <cwd>/docs/todo.md）
  --help             このヘルプを表示

冪等性:
  同じ (skill, event, title) の組が既に todo.md に存在する場合は追記をスキップし、
  "skipped" を標準出力に出す（exit code 0）。

例:
  node appendTodo.js \\
    --skill design-system \\
    --event design:20260410-001 \\
    --type RDRA追加 \\
    --title "管理ダッシュボード画面の追加提案" \\
    --body "運用監視のため管理者向けダッシュボードが必要。"
`;
  process.stdout.write(help);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      args.help = true;
      continue;
    }
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function genProposalId(existing, skill) {
  // 既存 open 件数 + 1 を使った軽量 ID（衝突回避は (skill,event,title) キーで担保）
  const prefix = skill.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'TODO';
  let n = 1;
  const rx = new RegExp('### ' + prefix + '-(\\d+):', 'g');
  let match;
  while ((match = rx.exec(existing)) !== null) {
    const v = parseInt(match[1], 10);
    if (v >= n) n = v + 1;
  }
  return `${prefix}-${String(n).padStart(3, '0')}`;
}

function alreadyExists(existing, skill, event, title) {
  // 粗い判定: skill, event, title の3要素が近接して存在すれば重複扱い
  if (!existing) return false;
  const lines = existing.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`: ${title}`) || lines[i].endsWith(title)) {
      const window = lines.slice(i, Math.min(lines.length, i + 8)).join('\n');
      if (window.includes(skill) && window.includes(event)) {
        return true;
      }
    }
  }
  return false;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || Object.keys(args).length === 0) {
    printHelp();
    process.exit(0);
  }

  const required = ['skill', 'event', 'type', 'title', 'body'];
  const missing = required.filter((k) => !args[k] || args[k] === true);
  if (missing.length) {
    process.stderr.write(`error: missing required options: ${missing.join(', ')}\n\n`);
    printHelp();
    process.exit(2);
  }

  const cwd = process.cwd();
  const filePath = args.file || path.join(cwd, 'docs', 'todo.md');
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let existing = '';
  if (fs.existsSync(filePath)) {
    existing = fs.readFileSync(filePath, 'utf-8');
  } else {
    existing = '# TODO / 追加提案\n\n本ファイルは後続スキルからの追加提案を集約する。\nRDRA に存在しない要素を追加する前に、ここで合意を得てから requirements スキルで反映する。\n\n';
  }

  if (alreadyExists(existing, args.skill, args.event, args.title)) {
    process.stdout.write(`skipped: duplicate (skill=${args.skill}, event=${args.event}, title="${args.title}")\n`);
    process.exit(0);
  }

  const proposalId = genProposalId(existing, args.skill);
  const date = today();

  const section = [
    `## ${date} ${args.skill} からの追加提案`,
    '',
    `### ${proposalId}: ${args.title}`,
    `- **発生元**: ${args.skill} (${args.event})`,
    `- **種別**: ${args.type}`,
    `- **提案内容**: ${args.body}`,
    `- **根拠**: (サブエージェントが記入)`,
    `- **影響範囲**: (サブエージェントが記入)`,
    `- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留`,
    `- **ステータス**: open`,
    '',
  ].join('\n');

  const next = existing.endsWith('\n') ? existing + section + '\n' : existing + '\n' + section + '\n';
  fs.writeFileSync(filePath, next, 'utf-8');
  process.stdout.write(`appended: ${proposalId} -> ${filePath}\n`);
}

// 公開 API（他スクリプトから require して open 件数をカウントする用途）
function countOpen(filePath) {
  try {
    const p = filePath || path.join(process.cwd(), 'docs', 'todo.md');
    if (!fs.existsSync(p)) return 0;
    const txt = fs.readFileSync(p, 'utf-8');
    const matches = txt.match(/\*\*ステータス\*\*:\s*open/g);
    return matches ? matches.length : 0;
  } catch {
    return 0;
  }
}

if (require.main === module) {
  main();
} else {
  module.exports = { countOpen };
}
