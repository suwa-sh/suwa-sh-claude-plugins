#!/usr/bin/env node
// Usage: node progress-server.js <work_dir> [port]
// Serves a pipeline progress dashboard at http://localhost:<port>
// Reads .pipeline-status.json from <work_dir> and streams updates via SSE.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DEFAULT_PORT = parseInt(process.argv[2] || '3100', 10);
const DRY_RUN = process.argv.includes('--dry-run');
// 作業ディレクトリ名を含めたファイル名で読む（progress-update.js と同じロジック）
const cwd = process.cwd();
const dirName = path.basename(cwd).replace(/[^a-zA-Z0-9_-]/g, '_');
const statusPath = path.join(__dirname, '..', `.pipeline-status-${dirName}.json`);
const portFile = path.join(__dirname, '..', '.progress-server.port');
const pidFile = path.join(__dirname, '..', '.progress-server.pid');

// --- プロセスベースのポート解決 ---
// 方針: 既定ポートを掴んでいるのが progress-server.js ならそれを停止して再利用、
//       別プロセスなら空きポートを順に探す、誰もいなければ既定ポートで起動。
function pidOnPort(port) {
  try {
    const out = execSync(`lsof -ti :${port}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    if (!out) return null;
    return parseInt(out.split('\n')[0], 10);
  } catch {
    return null;
  }
}

function commandOfPid(pid) {
  try {
    return execSync(`ps -p ${pid} -o command=`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

function resolvePort(startPort) {
  let port = startPort;
  for (let i = 0; i < 20; i++) {
    const pid = pidOnPort(port);
    if (pid == null) {
      return port; // free
    }
    const cmd = commandOfPid(pid);
    if (cmd.includes('progress-server.js')) {
      // 自分自身（または別インスタンス）が掴んでいる。停止して同ポートを使う。
      try {
        process.stdout.write(`Stopping previous progress-server (pid=${pid}) on port ${port}\n`);
        execSync(`kill ${pid}`);
        // プロセス解放を少し待つ
        const until = Date.now() + 1500;
        while (Date.now() < until) {
          if (pidOnPort(port) == null) break;
        }
      } catch {}
      return port;
    }
    // 別プロセス → 次のポートへ
    port += 1;
  }
  return port;
}

const port = resolvePort(DEFAULT_PORT);

if (DRY_RUN) {
  process.stdout.write(`dry-run: would listen on port ${port}\n`);
  process.stdout.write(`status file: ${statusPath}\n`);
  process.exit(0);
}

function readStatus() {
  try {
    return JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
  } catch {
    return null;
  }
}

const HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>USDM-RDRA Pipeline</title>
<style>
  :root {
    --bg: #0f172a; --surface: #1e293b; --border: #334155;
    --text: #e2e8f0; --text-muted: #94a3b8;
    --blue: #3b82f6; --green: #22c55e; --amber: #f59e0b;
    --red: #ef4444; --purple: #a855f7; --cyan: #06b6d4;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
  .container { max-width: 960px; margin: 0 auto; padding: 24px 16px; }
  h1 { font-size: 20px; font-weight: 600; margin-bottom: 4px; }
  .subtitle { color: var(--text-muted); font-size: 13px; margin-bottom: 24px; }

  /* Pipeline header */
  .pipeline-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
  .pipeline-state { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px;
    border-radius: 999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .pipeline-state.running { background: rgba(59,130,246,0.15); color: var(--blue); }
  .pipeline-state.completed { background: rgba(34,197,94,0.15); color: var(--green); }
  .pipeline-state.waiting_for_user { background: rgba(245,158,11,0.15); color: var(--amber); }
  .pipeline-state.error { background: rgba(239,68,68,0.15); color: var(--red); }
  .pipeline-state .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
  .pipeline-state.running .dot { animation: pulse 1.5s ease-in-out infinite; }
  .pipeline-state.waiting_for_user .dot { animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

  /* Progress bar */
  .progress-bar-wrap { background: var(--surface); border-radius: 8px; height: 8px; margin-bottom: 32px; overflow: hidden; }
  .progress-bar-fill { height: 100%; background: linear-gradient(90deg, var(--blue), var(--cyan)); border-radius: 8px;
    transition: width 0.6s ease; }

  /* Steps */
  .steps { display: flex; flex-direction: column; gap: 8px; }
  .step { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px 20px;
    display: grid; grid-template-columns: 40px 1fr auto; align-items: center; gap: 16px;
    transition: border-color 0.3s, box-shadow 0.3s; }
  .step.running { border-color: var(--blue); box-shadow: 0 0 0 1px var(--blue), 0 0 20px rgba(59,130,246,0.1); }
  .step.completed { border-color: var(--green); opacity: 0.85; }
  .step.error { border-color: var(--red); }
  .step.waiting { border-color: var(--amber); box-shadow: 0 0 0 1px var(--amber), 0 0 20px rgba(245,158,11,0.1); }

  .step-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
    font-size: 16px; font-weight: 700; }
  .step.pending .step-icon { background: var(--border); color: var(--text-muted); }
  .step.running .step-icon { background: rgba(59,130,246,0.2); color: var(--blue); }
  .step.completed .step-icon { background: rgba(34,197,94,0.2); color: var(--green); }
  .step.error .step-icon { background: rgba(239,68,68,0.2); color: var(--red); }
  .step.waiting .step-icon { background: rgba(245,158,11,0.2); color: var(--amber); }
  .step.skipped .step-icon { background: var(--border); color: var(--text-muted); }

  .step-body h3 { font-size: 14px; font-weight: 600; margin-bottom: 2px; }
  .step-body .step-name { font-size: 11px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; }
  .step-body .step-summary { font-size: 12px; color: var(--cyan); margin-top: 4px; }
  .step-body .step-subagent { font-size: 12px; color: var(--purple); margin-top: 2px; display: flex; align-items: center; gap: 4px; }
  .step-body .step-subagent::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--purple);
    animation: pulse 1s ease-in-out infinite; }

  .step-meta { text-align: right; font-size: 11px; color: var(--text-muted); white-space: nowrap; }
  .step-meta .event-id { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--text-muted); }
  .step-meta .duration { margin-top: 2px; }

  /* Dialogue banner */
  .dialogue-banner { background: linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05));
    border: 1px solid rgba(245,158,11,0.3); border-radius: 12px; padding: 16px 20px; margin-bottom: 24px;
    animation: glow 2s ease-in-out infinite; }
  @keyframes glow { 0%, 100% { box-shadow: 0 0 10px rgba(245,158,11,0.1); } 50% { box-shadow: 0 0 20px rgba(245,158,11,0.2); } }
  .dialogue-banner h3 { font-size: 14px; color: var(--amber); margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
  .dialogue-banner h3::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--amber);
    animation: pulse 1s ease-in-out infinite; }
  .dialogue-banner p { font-size: 13px; color: var(--text); line-height: 1.5; }
  .dialogue-banner .options { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
  .dialogue-banner .option { padding: 4px 10px; background: rgba(245,158,11,0.2); border: 1px solid rgba(245,158,11,0.3);
    border-radius: 6px; font-size: 12px; color: var(--amber); }
  .dialogue-banner .chat-hint { margin-top: 12px; padding: 8px 12px; background: rgba(245,158,11,0.08);
    border-radius: 8px; font-size: 12px; color: var(--amber); display: flex; align-items: center; gap: 8px; }
  .dialogue-banner .chat-hint .arrow { font-size: 16px; }

  /* Footer */
  .footer { margin-top: 24px; text-align: center; font-size: 11px; color: var(--text-muted); }
  .footer .updated { font-family: 'JetBrains Mono', monospace; }

  /* Not initialized */
  .not-init { text-align: center; padding: 80px 20px; color: var(--text-muted); }
  .not-init h2 { font-size: 18px; margin-bottom: 8px; color: var(--text); }
  .not-init .spinner { width: 32px; height: 32px; border: 3px solid var(--border); border-top-color: var(--blue);
    border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<div class="container" id="app"></div>
<script>
function formatDuration(startStr, endStr) {
  if (!startStr) return '';
  const start = new Date(startStr);
  const end = endStr ? new Date(endStr) : new Date();
  const sec = Math.floor((end - start) / 1000);
  if (sec < 60) return sec + 's';
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  if (min < 60) return min + 'm ' + s + 's';
  const h = Math.floor(min / 60);
  return h + 'h ' + (min % 60) + 'm';
}

function stepStateIcon(state) {
  switch (state) {
    case 'completed': return '\u2713';
    case 'running': return '\u25B6';
    case 'error': return '\u2717';
    case 'waiting': return '\u23F8';
    case 'skipped': return '\u2212';
    default: return '\u00B7';
  }
}

function pipelineStateLabel(state) {
  switch (state) {
    case 'running': return 'Running';
    case 'completed': return 'Completed';
    case 'waiting_for_user': return 'Waiting for User';
    case 'error': return 'Error';
    default: return state || 'Unknown';
  }
}

function render(status) {
  const app = document.getElementById('app');
  if (!status) {
    app.innerHTML = '<div class="not-init"><div class="spinner"></div><h2>Waiting for Pipeline</h2><p>Pipeline has not started yet. Status file will appear when the pipeline begins.</p></div>';
    return;
  }

  const p = status.pipeline;
  const completedCount = status.steps.filter(s => s.state === 'completed').length;
  const mainStepsTotal = status.steps.filter(s => typeof s.id === 'number').length;
  const mainCompleted = status.steps.filter(s => typeof s.id === 'number' && s.state === 'completed').length;
  const pct = p.state === 'completed' ? 100 : Math.round((mainCompleted / mainStepsTotal) * 100);

  let html = '';

  // Header
  html += '<div class="pipeline-header">';
  html += '<div><h1>USDM-RDRA Pipeline</h1><div class="subtitle">' + mainCompleted + ' / ' + mainStepsTotal + ' steps';
  if (p.started_at) html += ' \u00B7 ' + formatDuration(p.started_at, p.completed_at);
  html += '</div></div>';
  html += '<div class="pipeline-state ' + (p.state || '') + '"><span class="dot"></span>' + pipelineStateLabel(p.state) + '</div>';
  html += '</div>';

  // Progress bar
  html += '<div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:' + pct + '%"></div></div>';

  // Dialogue banner
  if (status.dialogue && status.dialogue.active) {
    const d = status.dialogue;
    html += '<div class="dialogue-banner">';
    html += '<h3>Step ' + d.step + ' \u2014 User Input Required</h3>';
    html += '<p>' + escHtml(d.question) + '</p>';
    if (d.options && d.options.length) {
      html += '<div class="options">';
      d.options.forEach(o => { html += '<span class="option">' + escHtml(o) + '</span>'; });
      html += '</div>';
    }
    html += '<div class="chat-hint"><span class="arrow">\u2190</span> Claude Code \u306e\u30c1\u30e3\u30c3\u30c8\u3067\u56de\u7b54\u3057\u3066\u304f\u3060\u3055\u3044</div>';
    html += '</div>';
  }

  // Steps
  html += '<div class="steps">';
  status.steps.forEach(s => {
    const cls = s.state === 'pending' && status.dialogue && String(status.dialogue.step) === String(s.id) ? 'waiting' : s.state;
    html += '<div class="step ' + cls + '">';
    html += '<div class="step-icon">' + stepStateIcon(s.state) + '</div>';
    html += '<div class="step-body">';
    html += '<h3>' + escHtml(s.label) + '</h3>';
    html += '<div class="step-name">' + escHtml(s.name) + '</div>';
    if (s.summary) html += '<div class="step-summary">' + escHtml(s.summary) + '</div>';
    if (s.state === 'running' && s.subagent_task) {
      html += '<div class="step-subagent">' + escHtml(s.subagent_task) + '</div>';
    }
    html += '</div>';
    html += '<div class="step-meta">';
    if (s.event_id) html += '<div class="event-id">' + escHtml(s.event_id) + '</div>';
    if (s.started_at) html += '<div class="duration">' + formatDuration(s.started_at, s.completed_at) + '</div>';
    html += '</div>';
    html += '</div>';
  });
  html += '</div>';

  // Footer
  html += '<div class="footer">Updated <span class="updated">' + (status.updated_at || '') + '</span></div>';

  app.innerHTML = html;
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// SSE connection
const evtSource = new EventSource('/sse');
evtSource.onmessage = function(event) {
  try {
    const status = JSON.parse(event.data);
    render(status);
  } catch (e) {
    console.error('SSE parse error:', e);
  }
};
evtSource.onerror = function() {
  // Fallback to polling if SSE fails
  setTimeout(function() { location.reload(); }, 3000);
};

// Initial fetch
fetch('/api/status').then(r => r.json()).then(render).catch(() => render(null));
</script>
</body>
</html>`;

// SSE clients
const sseClients = new Set();

// Watch status file
let lastMtime = 0;
function checkAndBroadcast() {
  try {
    const stat = fs.statSync(statusPath);
    if (stat.mtimeMs > lastMtime) {
      lastMtime = stat.mtimeMs;
      const status = readStatus();
      if (status) {
        const data = JSON.stringify(status);
        for (const res of sseClients) {
          try { res.write(`data: ${data}\n\n`); } catch { sseClients.delete(res); }
        }
      }
    }
  } catch {}
}

setInterval(checkAndBroadcast, 1000);

// HTTP Server
const server = http.createServer((req, res) => {
  if (req.url === '/sse') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    // Send current status immediately
    const status = readStatus();
    if (status) res.write(`data: ${JSON.stringify(status)}\n\n`);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  if (req.url === '/api/status') {
    const status = readStatus();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(status || { pipeline: { state: null } }));
    return;
  }

  // Serve HTML
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(HTML);
});

server.listen(port, () => {
  try {
    fs.writeFileSync(portFile, String(port), 'utf-8');
    fs.writeFileSync(pidFile, String(process.pid), 'utf-8');
  } catch {}
  console.log(`Dashboard running at http://localhost:${port}`);
  console.log(`Watching: ${statusPath}`);
});

function cleanup() {
  try {
    if (fs.existsSync(pidFile) && fs.readFileSync(pidFile, 'utf-8').trim() === String(process.pid)) {
      fs.unlinkSync(pidFile);
    }
    if (fs.existsSync(portFile) && fs.readFileSync(portFile, 'utf-8').trim() === String(port)) {
      fs.unlinkSync(portFile);
    }
  } catch {}
}
process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('exit', cleanup);
