#!/usr/bin/env node
'use strict';

// 判定を実行して生の結果を JSON に保存する。
//
// 使い方:
//   node experiments/jev/run.js --docs samples/distillery/pipeline --name library --lang en --judge patterns [--dry-run]
//   node experiments/jev/run.js --docs samples/distillery/pipeline --name library --lang ja --judge model-types [--dry-run]
//
// --dry-run: API を呼ばず、送る予定のリクエスト（state と質問）を標準出力に出す。質問文のレビューに使う。

const fs = require('node:fs');
const path = require('node:path');
const { parse: parseYaml } = require('yaml');

const { extractFeatures } = require('./lib/features');
const { patternLabels, modelTypeLabels } = require('./lib/labels');
const { judgePatterns } = require('./lib/patternJudge');
const { judgeModelTypes } = require('./lib/modelTypeJudge');
const jevClient = require('./lib/jevClient');

function parseArgs(argv) {
  const args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--docs') {
      args.docs = argv[++i];
    } else if (arg === '--name') {
      args.name = argv[++i];
    } else if (arg === '--lang') {
      args.lang = argv[++i];
    } else if (arg === '--judge') {
      args.judge = argv[++i];
    } else {
      throw new Error(`run.js: unknown argument: ${arg}`);
    }
  }
  for (const required of ['docs', 'name', 'lang', 'judge']) {
    if (!args[required]) throw new Error(`run.js: missing required --${required}`);
  }
  if (!['en', 'ja'].includes(args.lang)) throw new Error(`run.js: --lang must be en or ja, got: ${args.lang}`);
  if (!['patterns', 'model-types'].includes(args.judge)) {
    throw new Error(`run.js: --judge must be patterns or model-types, got: ${args.judge}`);
  }
  return args;
}

async function runPatterns({ docsDir, lang, dryRun }) {
  const patternsFile = require('./patterns/patterns.json');
  const features = extractFeatures(docsDir);
  const labels = patternLabels(docsDir, patternsFile.patterns);
  const ask = (req) => jevClient.ask(req);
  const { codeDecided, requests, rawAnswers } = await judgePatterns({
    features,
    patterns: patternsFile.patterns,
    lang,
    ask,
    dryRun,
  });
  return {
    judge: 'patterns',
    codeDecided,
    requests,
    rawAnswers,
    labels,
    requestCount: requests.length,
  };
}

async function runModelTypes({ docsDir, lang, dryRun }) {
  const requirementsFile = path.join(docsDir, 'usdm', 'latest', 'requirements.yaml');
  const requirementsYaml = parseYaml(fs.readFileSync(requirementsFile, 'utf8'));
  const labels = modelTypeLabels(docsDir);
  const labelsPlain = {};
  for (const [specId, types] of Object.entries(labels)) labelsPlain[specId] = [...types];
  const ask = (req) => jevClient.ask(req);
  const { requests, rawAnswers } = await judgeModelTypes({ requirementsYaml, lang, ask, dryRun });
  return {
    judge: 'model-types',
    requests,
    rawAnswers,
    labels: labelsPlain,
    requestCount: requests.length,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const docsDir = path.resolve(args.docs);

  if (args.dryRun) {
    const result =
      args.judge === 'patterns'
        ? await runPatterns({ docsDir, lang: args.lang, dryRun: true })
        : await runModelTypes({ docsDir, lang: args.lang, dryRun: true });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const result =
    args.judge === 'patterns'
      ? await runPatterns({ docsDir, lang: args.lang, dryRun: false })
      : await runModelTypes({ docsDir, lang: args.lang, dryRun: false });

  const output = {
    generatedAt: new Date().toISOString(),
    model: jevClient.MODEL,
    lang: args.lang,
    docsDir: args.docs,
    name: args.name,
    ...result,
  };

  const resultsDir = path.join(__dirname, 'results');
  fs.mkdirSync(resultsDir, { recursive: true });
  const outFile = path.join(resultsDir, `${args.name}-${args.judge}-${args.lang}.json`);
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2));
  console.log(`wrote ${outFile}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { parseArgs, runPatterns, runModelTypes };
