#!/usr/bin/env node
'use strict';

// 生の結果 JSON から比較レポート（Markdown）を作る。Jev を呼び直さない。
//
// 使い方:
//   node experiments/jev/report.js experiments/jev/results/*.json --hi 0.8 --lo 0.2 > experiments/jev/results/report.md

const fs = require('node:fs');

function parseArgs(argv) {
  const files = [];
  let hi = 0.8;
  let lo = 0.2;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--hi') hi = Number(argv[++i]);
    else if (arg === '--lo') lo = Number(argv[++i]);
    else files.push(arg);
  }
  return { files, hi, lo };
}

// レビュー指摘8: --hi/--lo が有限の数で 0 <= lo < hi <= 1 であることを検証する。
function validateThresholds(hi, lo) {
  if (typeof hi !== 'number' || !Number.isFinite(hi)) return { ok: false, reason: `--hi is not a finite number: ${hi}` };
  if (typeof lo !== 'number' || !Number.isFinite(lo)) return { ok: false, reason: `--lo is not a finite number: ${lo}` };
  if (!(lo >= 0)) return { ok: false, reason: `--lo must be >= 0, got: ${lo}` };
  if (!(hi <= 1)) return { ok: false, reason: `--hi must be <= 1, got: ${hi}` };
  if (!(lo < hi)) return { ok: false, reason: `--lo must be < --hi, got lo=${lo} hi=${hi}` };
  return { ok: true };
}

// value が数値でない（欠落・非数値の回答）場合も pending 扱いにする（レビュー指摘5）。
function band(value, hi, lo) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'pending';
  if (value >= hi) return 'yes';
  if (value <= lo) return 'no';
  return 'pending';
}

// レビュー指摘6: 保留の判定を3値論理にする。回答が1つでも保留だからといって
// 結論全体を保留にはしない。確信帯の回答だけで結論が決まる場合は決める。
//
// 支持側（combine の意味で yes/no/pending の3値を返す）
// - combine: any  → yes が1つでもあれば yes。全て no なら no。それ以外 pending
// - combine: all  → no が1つでもあれば no。全て yes なら yes。それ以外 pending
function combineSupport(bandValues, combine) {
  if (combine === 'any') {
    if (bandValues.some((b) => b === 'yes')) return 'yes';
    if (bandValues.every((b) => b === 'no')) return 'no';
    return 'pending';
  }
  // combine === 'all'
  if (bandValues.some((b) => b === 'no')) return 'no';
  if (bandValues.every((b) => b === 'yes')) return 'yes';
  return 'pending';
}

// 除外側は常に OR: yes が1つでもあれば yes。全て no なら no。それ以外 pending
function combineExclude(bandValues) {
  if (bandValues.length === 0) return 'no'; // 除外条件が無ければ「除外されない」で確定
  if (bandValues.some((b) => b === 'yes')) return 'yes';
  if (bandValues.every((b) => b === 'no')) return 'no';
  return 'pending';
}

// 結論: 支持 no → 非適用 / 除外 yes → 非適用 / 支持 yes かつ 除外 no → 適用 / それ以外 → 保留
function resolveVerdict(supportVerdict, excludeVerdict) {
  if (supportVerdict === 'no') return { applied: false, pending: false };
  if (excludeVerdict === 'yes') return { applied: false, pending: false };
  if (supportVerdict === 'yes' && excludeVerdict === 'no') return { applied: true, pending: false };
  return { applied: null, pending: true };
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function sumInputTokens(requests) {
  return requests.reduce((sum, r) => sum + (r.usage && typeof r.usage.input_tokens === 'number' ? r.usage.input_tokens : 0), 0);
}

// label（applied/not_applied/ambiguous の3値）を expected の boolean に変換する。
// ambiguous は一致率の分母から外すため null を返す（呼び出し側で判定する）。
function expectedFromLabel(labelEntry) {
  if (!labelEntry) return false; // ラベルが無い（見つからなかった）場合は not_applied 相当
  if (labelEntry.label === 'applied') return true;
  if (labelEntry.label === 'not_applied') return false;
  return null; // ambiguous
}

function analyzePatterns(result, hi, lo, patternsList = require('./patterns/patterns.json').patterns) {
  const { codeDecided, rawAnswers, labels, requests } = result;

  // コードで決めた項目（always / numericGates / excludeCodeSignal / codeSignal による短絡確定を含む）
  const codeRows = [];
  for (const [id, decision] of Object.entries(codeDecided)) {
    const expected = expectedFromLabel(labels[id]);
    const ambiguous = expected === null;
    codeRows.push({
      id,
      applied: decision.applied,
      decidedBy: decision.decidedBy,
      ambiguous,
      expected,
      match: !ambiguous && decision.applied === expected,
    });
  }

  // Jev 判定が必要だった項目（支持側のみ・除外側のみ・両方、のいずれかを Jev に聞いている）
  const jevRows = [];
  for (const pattern of patternsList) {
    if (codeDecided[pattern.id]) continue;
    const mainKeys = [
      ...(pattern.questions || []).map((q) => `${pattern.id}.${q.key}`),
      ...(pattern.codeSignals || []).map((cs) => `${pattern.id}.codesignal.${cs.key}`),
    ];
    const excludeKeys = [
      ...(pattern.excludeQuestions || []).map((q) => `${pattern.id}.exclude.${q.key}`),
      ...(pattern.excludeCodeSignals || []).map((cs) => `${pattern.id}.exclude.codesignal.${cs.key}`),
    ];

    const mainBandValues = mainKeys.map((k) => band(rawAnswers[k]?.noul, hi, lo));
    const excludeBandValues = excludeKeys.map((k) => band(rawAnswers[k]?.noul, hi, lo));
    const supportVerdict = combineSupport(mainBandValues, pattern.combine);
    const excludeVerdict = combineExclude(excludeBandValues);
    const { applied, pending } = resolveVerdict(supportVerdict, excludeVerdict);

    const allBands = [
      ...mainKeys.map((k) => ({ key: k, value: rawAnswers[k]?.noul, band: band(rawAnswers[k]?.noul, hi, lo) })),
      ...excludeKeys.map((k) => ({ key: k, value: rawAnswers[k]?.noul, band: band(rawAnswers[k]?.noul, hi, lo) })),
    ];

    const expected = expectedFromLabel(labels[pattern.id]);
    const ambiguous = expected === null;
    jevRows.push({
      id: pattern.id,
      pending,
      applied,
      ambiguous,
      expected,
      match: !pending && !ambiguous && applied === expected,
      supportVerdict,
      excludeVerdict,
      bands: allBands,
    });
  }

  // 一致率・保留率の分母からは ambiguous（正解の候補が言及の混在で決めがたい項目）を除く
  const codeComparable = codeRows.filter((r) => !r.ambiguous);
  const codeMatches = codeComparable.filter((r) => r.match);

  const jevDecided = jevRows.filter((r) => !r.pending && !r.ambiguous);
  const jevMatches = jevDecided.filter((r) => r.match);
  const jevComparableTotal = jevRows.filter((r) => !r.ambiguous).length; // 保留率の分母（ambiguous除く）
  const pendingCount = jevRows.filter((r) => r.pending && !r.ambiguous).length;
  const totalPatternsComparable = codeComparable.length + jevComparableTotal;

  return {
    kind: 'patterns',
    codeRows,
    codeComparable,
    codeMatches,
    jevRows,
    jevDecided,
    jevMatches,
    jevComparableTotal,
    pendingCount,
    totalPatternsComparable,
    requests,
  };
}

function analyzeModelTypes(result, hi, lo) {
  const { rawAnswers, labels, requests } = result;

  // レビュー指摘5: 送った質問（仕様ID × 8種、requests[].questions のキー）を分母にする。
  // rawAnswers に無い（欠落した）回答は保留に数え、欠落件数を別に集計する。
  const expectedKeys = new Set();
  for (const request of requests || []) {
    for (const key of Object.keys(request.questions || {})) expectedKeys.add(key);
  }

  const rows = [];
  let missingCount = 0;
  for (const key of expectedKeys) {
    const dot = key.lastIndexOf('.');
    const specId = key.slice(0, dot);
    const type = key.slice(dot + 1);
    const expectedTypes = labels[specId] || [];
    const expected = expectedTypes.includes(type);
    const answer = rawAnswers[key];
    const missing = answer === undefined;
    if (missing) missingCount += 1;
    const b = band(answer?.noul, hi, lo);
    const applied = b === 'yes' ? true : b === 'no' ? false : null;
    rows.push({ specId, type, value: answer?.noul, missing, band: b, expected, match: b !== 'pending' && applied === expected });
  }

  const decided = rows.filter((r) => r.band !== 'pending');
  const matches = decided.filter((r) => r.match);
  const pendingCount = rows.filter((r) => r.band === 'pending').length;

  return {
    kind: 'model-types',
    rows,
    decided,
    matches,
    totalItems: rows.length,
    pendingCount,
    missingCount,
    requests,
  };
}

function formatFileReport(fileName, result, hi, lo) {
  const analysis = result.judge === 'patterns' ? analyzePatterns(result, hi, lo) : analyzeModelTypes(result, hi, lo);
  const requests = analysis.requests || [];
  const inputTokens = sumInputTokens(requests);
  const latencyMedian = median(requests.map((r) => r.latencyMs).filter((v) => typeof v === 'number'));

  const lines = [];
  lines.push(`## ${fileName}`);
  lines.push('');
  lines.push(`- judge: ${result.judge}`);
  lines.push(`- lang: ${result.lang}`);
  lines.push(`- model: ${result.model}`);
  lines.push(`- requests: ${requests.length}`);
  lines.push(`- input tokens (合計): ${inputTokens}`);
  lines.push(`- 所要時間（median latencyMs）: ${latencyMedian ?? 'N/A'}`);
  lines.push('');

  if (analysis.kind === 'patterns') {
    lines.push('### コードで決めた項目（always / numericGates / codeSignal / excludeCodeSignal）');
    lines.push('');
    lines.push(`- 件数: ${analysis.codeRows.length}（うち正解の候補が ambiguous: ${analysis.codeRows.length - analysis.codeComparable.length}）`);
    lines.push(
      `- 一致率（ambiguous を除く）: ${analysis.codeComparable.length ? (analysis.codeMatches.length / analysis.codeComparable.length).toFixed(2) : 'N/A'}`,
    );
    lines.push('');
    lines.push('#### コードで決めた項目の食い違い一覧（レビュー指摘1: Jev の食い違いとは別表にする）');
    lines.push('');
    lines.push('| pattern | decidedBy | コードの判定 | 正解の候補 |');
    lines.push('|---|---|---|---|');
    for (const row of analysis.codeRows) {
      if (row.ambiguous || !row.match) {
        const label = row.ambiguous ? 'ambiguous' : row.expected;
        lines.push(`| ${row.id} | ${row.decidedBy} | ${row.applied} | ${label} |`);
      }
    }
    lines.push('');

    lines.push('### Jev 判定の項目');
    lines.push('');
    lines.push(`- 件数: ${analysis.jevRows.length}（うち正解の候補が ambiguous: ${analysis.jevRows.length - analysis.jevComparableTotal}）`);
    lines.push(
      `- 保留率（ambiguous を除く全項目のうち）: ${analysis.jevComparableTotal ? (analysis.pendingCount / analysis.jevComparableTotal).toFixed(2) : 'N/A'}`,
    );
    lines.push(
      `- 一致率（確信帯かつ ambiguous を除く項目のうち）: ${analysis.jevDecided.length ? (analysis.jevMatches.length / analysis.jevDecided.length).toFixed(2) : 'N/A'}`,
    );
    lines.push('');
    lines.push('#### 食い違い・保留・ambiguous の一覧（人が見る一覧）');
    lines.push('');
    lines.push('| pattern | 状態 | Jev | 正解の候補 | 根拠の出現箇所 |');
    lines.push('|---|---|---|---|---|');
    for (const row of analysis.jevRows) {
      if (row.ambiguous || row.pending || !row.match) {
        const state = row.ambiguous ? 'ambiguous（正解の候補が決めがたい）' : row.pending ? '保留' : '不一致';
        const label = row.ambiguous ? 'ambiguous' : row.expected;
        const occ = (result.labels[row.id]?.occurrences || [])
          .map((o) => `${o.file}:${o.line}(${o.classification})`)
          .join(', ') || '(なし)';
        lines.push(`| ${row.id} | ${state} | ${row.applied ?? '(保留)'} | ${label} | ${occ} |`);
      }
    }
    lines.push('');
  } else {
    lines.push('### 判定結果');
    lines.push('');
    lines.push(`- 件数（送った質問の総数）: ${analysis.totalItems}`);
    lines.push(`- 欠落した回答の件数: ${analysis.missingCount}`);
    lines.push(`- 保留率（欠落を含む）: ${analysis.totalItems ? (analysis.pendingCount / analysis.totalItems).toFixed(2) : 'N/A'}`);
    lines.push(`- 一致率（確信帯の項目のうち）: ${analysis.decided.length ? (analysis.matches.length / analysis.decided.length).toFixed(2) : 'N/A'}`);
    lines.push('');
    lines.push('#### 食い違い・保留の一覧');
    lines.push('');
    lines.push('| spec | 種別 | 確率 | 欠落 | 正解の候補 |');
    lines.push('|---|---|---|---|---|');
    for (const row of analysis.rows) {
      if (row.band === 'pending' || !row.match) {
        lines.push(`| ${row.specId} | ${row.type} | ${row.value ?? 'N/A'} | ${row.missing ? 'yes' : ''} | ${row.expected} |`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

function main() {
  const { files, hi, lo } = parseArgs(process.argv.slice(2));
  const validation = validateThresholds(hi, lo);
  if (!validation.ok) {
    console.error(`report.js: invalid thresholds: ${validation.reason}`);
    process.exit(2);
  }
  if (files.length === 0) {
    console.error('report.js: no result files given');
    process.exit(2);
  }
  const sections = [];
  sections.push('# Jev 実測レポート');
  sections.push('');
  sections.push(`確信帯: hi=${hi} / lo=${lo}。確率が hi 以上ははい、lo 以下はいいえ、それ以外は保留として扱う。`);
  sections.push('');
  sections.push(
    '注意: 正解の候補は arch-design.yaml / arch-design.md / decisions/* のテキストにパターン名（またはRDRAモデル種別）が出現するかどうかで機械抽出した粗い基準であり、絶対の正解ではない。' +
      '出現は adopted（採用の文脈）/ rejected（decisions の alternatives_considered 配下、または「不採用」等のキーワードを含む行）に分類し、' +
      '一般語の別名（weakAliases）だけの自由記述中の出現や adopted/rejected の混在は ambiguous として一致率の分母から除外し、人が見る一覧に出す。' +
      '一般語の別名でも、YAML の name: キーの値や Markdown 表の先頭セルのような構造化された箇所での出現は adopted として扱う。',
  );
  sections.push('');
  for (const file of files) {
    const result = JSON.parse(fs.readFileSync(file, 'utf8'));
    sections.push(formatFileReport(file, result, hi, lo));
  }
  console.log(sections.join('\n'));
}

if (require.main === module) main();

module.exports = {
  parseArgs,
  validateThresholds,
  band,
  combineSupport,
  combineExclude,
  resolveVerdict,
  median,
  analyzePatterns,
  analyzeModelTypes,
  expectedFromLabel,
};
