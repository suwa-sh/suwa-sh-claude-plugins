#!/usr/bin/env node
'use strict';

// 判定A（クラウドデザインパターン、実際は30種、patterns/patterns.json 参照）の実行。
// 1. always と numericGates（(a) 外部システム存在の必要条件、(b) NFRの明示閾値）をコードで処理する
// 2. 件数条件のうち根拠が並列シグナルの一部でしかないものは codeSignals（真偽が確定するコード判定の
//    支持シグナル）として扱い、questions/excludeQuestions の回答と同列に combine（all/any）へ参加させる。
//    excludeCodeSignals は除外側の数値条件（真なら Jev を呼ばず非適用に確定する）。
//    codeSignals/excludeCodeSignals はネットワークを使わず即座に true/false が決まる。
// 3. Jev を呼ばずに確定できるのは次の場合だけ:
//    - always
//    - numericGates（hard gate）が1つでも偽
//    - excludeCodeSignals が1つでも真（除外側は OR。除外シグナルが真なら支持側を問わず非適用）
//    - 支持側（codeSignals + questions）が combine の意味で確定した場合:
//      combine=all: codeSignals に1つでも偽があれば非適用確定（残りの questions を待たずに false）
//      combine=all: codeSignals が全て真 かつ questions が空なら適用確定
//      combine=any: codeSignals に1つでも真があれば適用確定（レビュー指摘5: ただし excludeQuestions/
//        excludeCodeSignals が残っている場合は、除外側だけを Jev に聞いてから最終確定する。支持側が
//        コードだけで真に確定しても、除外質問を飛ばして良いわけではない）
//      combine=any: codeSignals が全て偽 かつ questions が空なら非適用確定
//    上記以外は Jev が必要。支持側が確定済みで除外側だけ残っている場合は、questions を送らず
//    excludeQuestions だけを送る（無駄な呼び出しを避ける）
// 4. 残りをグループごとに1リクエストにまとめる。グループの state は、そのグループに含まれるパターンが
//    宣言する slices の和集合にする（パターンごとに必要な slice が異なるため。レビュー指摘3）
// 5. 生の確率（と codeSignals/excludeCodeSignals の擬似回答）を返す。適用/非適用/保留の最終決定は report.js の責務

function resolveFeaturePath(featurePath, features) {
  const [root, ...rest] = featurePath.split('.');
  if (root === 'counts') return features.counts[rest.join('.')];
  if (root === 'nfr') return features.nfr[rest.join('.')];
  throw new Error(`patternJudge: unsupported feature path root: ${root}`);
}

function compare(value, op, threshold) {
  switch (op) {
    case '>=':
      return value >= threshold;
    case '<=':
      return value <= threshold;
    case '>':
      return value > threshold;
    case '<':
      return value < threshold;
    case '==':
      return value === threshold;
    default:
      throw new Error(`patternJudge: unsupported op: ${op}`);
  }
}

function evalGate(gate, features) {
  const actual = resolveFeaturePath(gate.feature, features);
  const base = { key: gate.key, feature: gate.feature, op: gate.op, threshold: gate.value, actual };
  if (actual === undefined) {
    return { ...base, pass: false, note: 'feature not found; treated as gate failure' };
  }
  return { ...base, pass: compare(actual, gate.op, gate.value) };
}

// codeSignal 用の回答キー（rawAnswers に擬似回答として挿入する）
function codeSignalAnswerKey(patternId, key) {
  return `${patternId}.codesignal.${key}`;
}
function excludeCodeSignalAnswerKey(patternId, key) {
  return `${patternId}.exclude.codesignal.${key}`;
}

function buildGroupState(items, features) {
  const keys = new Set();
  for (const { pattern } of items) {
    for (const key of pattern.slices || []) keys.add(key);
  }
  const state = {};
  for (const key of keys) state[key] = features.slices[key];
  return state;
}

// 支持側（codeSignals + questions）が combine の意味で確定するかどうかを判定する。
// 戻り値: true / false（確定した適用可否） / null（未確定、Jev の questions が必要）
function resolveMainVerdict(pattern, codeSignalResults) {
  const questionCount = (pattern.questions || []).length;
  if (pattern.combine === 'all') {
    if (codeSignalResults.some((r) => r.pass === false)) return false;
    if (codeSignalResults.every((r) => r.pass === true) && questionCount === 0) return true;
    return null;
  }
  // combine === 'any'
  if (codeSignalResults.some((r) => r.pass === true)) return true;
  if (codeSignalResults.every((r) => r.pass === false) && questionCount === 0) return false;
  return null;
}

// patterns を code-decided（always / gate / excludeCodeSignal / codeSignal で確定）と
// Jev 判定が必要なものに振り分ける。Jev が必要な場合、questions を送るか
// excludeQuestions だけを送るか（onlyExcludes）も決める。
function classifyPatterns(patterns, features) {
  const codeDecided = {};
  const needsJudgement = [];
  for (const pattern of patterns) {
    if (pattern.always) {
      codeDecided[pattern.id] = { decidedBy: 'always', applied: true, reason: pattern.source };
      continue;
    }
    const gateResults = (pattern.numericGates || []).map((g) => evalGate(g, features));
    if (gateResults.some((r) => r.pass === false)) {
      codeDecided[pattern.id] = { decidedBy: 'gate', applied: false, gateResults };
      continue;
    }

    const excludeCodeSignalResults = (pattern.excludeCodeSignals || []).map((cs) => evalGate(cs, features));
    if (excludeCodeSignalResults.some((r) => r.pass === true)) {
      // 除外側（OR）が真で確定。支持側を問わず非適用
      codeDecided[pattern.id] = { decidedBy: 'excludeCodeSignal', applied: false, gateResults, excludeCodeSignalResults };
      continue;
    }

    const codeSignalResults = (pattern.codeSignals || []).map((cs) => evalGate(cs, features));
    const mainVerdict = resolveMainVerdict(pattern, codeSignalResults);

    if (mainVerdict === false) {
      // 支持側が確定して非適用（除外側を待つまでもなく非適用）
      codeDecided[pattern.id] = { decidedBy: 'codeSignal', applied: false, gateResults, codeSignalResults, excludeCodeSignalResults };
      continue;
    }

    const hasExcludeSignals = (pattern.excludeQuestions || []).length > 0 || excludeCodeSignalResults.length > 0;

    if (mainVerdict === true) {
      if (!hasExcludeSignals) {
        // 支持側が真で確定し、除外側も無いので Jev を呼ばずに適用確定
        codeDecided[pattern.id] = { decidedBy: 'codeSignal', applied: true, gateResults, codeSignalResults, excludeCodeSignalResults };
        continue;
      }
      // 支持側は真で確定済みだが、excludeQuestions が残っているので、それだけを Jev に聞く
      // （レビュー指摘5: codeSignal の短絡が除外質問を飛ばしてはいけない）
      needsJudgement.push({ pattern, gateResults, codeSignalResults, excludeCodeSignalResults, onlyExcludes: true });
      continue;
    }

    // mainVerdict === null: 支持側がまだ確定しない。questions と excludeQuestions を Jev に聞く
    needsJudgement.push({ pattern, gateResults, codeSignalResults, excludeCodeSignalResults, onlyExcludes: false });
  }
  return { codeDecided, needsJudgement };
}

function buildQuestionsForGroup(items, lang) {
  const questions = {};
  for (const { pattern, onlyExcludes } of items) {
    if (!onlyExcludes) {
      for (const q of pattern.questions || []) {
        questions[`${pattern.id}.${q.key}`] = { type: 'noul', instructions: q[lang] };
      }
    }
    for (const q of pattern.excludeQuestions || []) {
      questions[`${pattern.id}.exclude.${q.key}`] = { type: 'noul', instructions: q[lang] };
    }
  }
  return questions;
}

// codeSignal/excludeCodeSignal の判定結果を rawAnswers に擬似回答（1 or 0 の確定値）として注入する。
// ネットワークを使わないため dryRun でも常に注入する（レビュー用に見える化する）。
function injectCodeSignalAnswers(items, rawAnswers) {
  for (const { pattern, codeSignalResults, excludeCodeSignalResults } of items) {
    for (const result of codeSignalResults || []) {
      rawAnswers[codeSignalAnswerKey(pattern.id, result.key)] = { type: 'noul', noul: result.pass ? 1 : 0, codeSignal: true };
    }
    for (const result of excludeCodeSignalResults || []) {
      rawAnswers[excludeCodeSignalAnswerKey(pattern.id, result.key)] = { type: 'noul', noul: result.pass ? 1 : 0, codeSignal: true };
    }
  }
}

// dryRun: true の場合はリクエストを組み立てるだけで ask を呼ばない
async function judgePatterns({ features, patterns, lang, ask, dryRun = false }) {
  const { codeDecided, needsJudgement } = classifyPatterns(patterns, features);

  const byGroup = new Map();
  for (const item of needsJudgement) {
    const list = byGroup.get(item.pattern.group) || [];
    list.push(item);
    byGroup.set(item.pattern.group, list);
  }

  const requests = [];
  const rawAnswers = {};
  for (const [group, items] of byGroup) {
    const state = buildGroupState(items, features);
    const questions = buildQuestionsForGroup(items, lang);
    const patternIds = items.map((i) => i.pattern.id);
    injectCodeSignalAnswers(items, rawAnswers);

    if (dryRun) {
      requests.push({ group, patternIds, state, questions });
      continue;
    }
    const result = await ask({ state, questions });
    requests.push({
      group,
      patternIds,
      state,
      questions,
      usage: result.usage,
      latencyMs: result.latencyMs,
    });
    Object.assign(rawAnswers, result.answers);
  }

  return { codeDecided, requests, rawAnswers };
}

module.exports = {
  judgePatterns,
  classifyPatterns,
  evalGate,
  buildGroupState,
  resolveMainVerdict,
  codeSignalAnswerKey,
  excludeCodeSignalAnswerKey,
};
