#!/usr/bin/env node
'use strict';

// デスクトップ通知 CLI。pipeline の dialogue / error / complete で使う。
// macOS / Windows / Linux 対応。通知はベストエフォート:
// どんな失敗でもパイプラインを止めない(常に exit 0)。
//
// 使い方: node notify.js "<タイトル>" "<本文>"
//
// OS 別の実装:
//   - macOS   : osascript の display notification (sound name "Glass")
//   - Windows : PowerShell の NotifyIcon バルーン通知 + SystemSounds
//   - Linux   : notify-send (libnotify) + paplay による通知音 (存在する場合のみ)

const { execFileSync } = require('node:child_process');

const LINUX_SOUND = '/usr/share/sounds/freedesktop/stereo/complete.oga';

function sanitize(text) {
  // 各シェル/スクリプト文字列に埋め込むため改行などの制御文字を空白に潰す
  return String(text).replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
}

function buildAppleScript(title, body) {
  const t = JSON.stringify(title);
  const b = JSON.stringify(body);
  return `display notification ${b} with title ${t} sound name "Glass"`;
}

function buildPowerShellScript(title, body) {
  // PowerShell 単一引用符文字列内では ' を '' にエスケープする
  const t = title.replace(/'/g, "''");
  const b = body.replace(/'/g, "''");
  return [
    'Add-Type -AssemblyName System.Windows.Forms;',
    'Add-Type -AssemblyName System.Drawing;',
    '[System.Media.SystemSounds]::Asterisk.Play();',
    '$n = New-Object System.Windows.Forms.NotifyIcon;',
    '$n.Icon = [System.Drawing.SystemIcons]::Information;',
    '$n.Visible = $true;',
    `$n.ShowBalloonTip(5000, '${t}', '${b}', [System.Windows.Forms.ToolTipIcon]::Info);`,
    'Start-Sleep -Milliseconds 500;',
    '$n.Dispose();',
  ].join(' ');
}

function commandsFor(platform, title, body) {
  const t = sanitize(title);
  const b = sanitize(body) || t;
  if (platform === 'darwin') {
    return [{ cmd: 'osascript', args: ['-e', buildAppleScript(t, b)] }];
  }
  if (platform === 'win32') {
    return [
      {
        cmd: 'powershell',
        args: ['-NoProfile', '-NonInteractive', '-Command', buildPowerShellScript(t, b)],
      },
    ];
  }
  if (platform === 'linux') {
    return [
      { cmd: 'notify-send', args: [t, b] },
      { cmd: 'paplay', args: [LINUX_SOUND] },
    ];
  }
  return []; // 未対応プラットフォームは no-op
}

function notify(title, body, platform, exec) {
  let sent = false;
  for (const { cmd, args } of commandsFor(platform, title, body)) {
    try {
      exec(cmd, args, { stdio: 'ignore' });
      sent = true;
    } catch {
      // コマンド不在(例: notify-send 未インストール)や実行失敗は無視して次へ
    }
  }
  return sent;
}

function main() {
  const [title = 'distillery', body = ''] = process.argv.slice(2);
  notify(title, body, process.platform, execFileSync);
}

if (require.main === module) {
  try {
    main();
  } catch {
    // 通知失敗は無視(exit 0)
  }
}

module.exports = { buildAppleScript, buildPowerShellScript, commandsFor, notify, sanitize };
