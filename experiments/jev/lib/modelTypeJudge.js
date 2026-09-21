#!/usr/bin/env node
'use strict';

// 判定B（仕様1件が影響するRDRAモデル種別8種の該当有無）の実行。
// 種別の定義は usdm-decompose.md の8種の列挙とRDRAの意味に沿って1〜2文で書く。
// 仕様1件につき1リクエスト、種別ごとにNoul 8問。

const MODEL_TYPES = [
  {
    type: 'actor',
    nameJa: 'アクター',
    nameEn: 'actor',
    defJa: 'システムを操作したり価値をやり取りしたりする、人・タイマー・外部の役割',
    defEn: 'a person, timer, or external role that operates the system or exchanges value with it',
  },
  {
    type: 'information',
    nameJa: '情報',
    nameEn: 'information',
    defJa: 'システムが管理する、名前と属性を持つ業務エンティティやマスタ・トランザクションデータ',
    defEn: 'a business entity or master/transactional data item the system manages, identified by name and attributes',
  },
  {
    type: 'state',
    nameJa: '状態',
    nameEn: 'state',
    defJa: 'あるエンティティが遷移するライフサイクル上の状態と、その遷移を引き起こすユースケース',
    defEn: 'the lifecycle states an entity transitions through and the use cases that trigger those transitions',
  },
  {
    type: 'buc',
    nameJa: 'BUC（ビジネスユースケース）',
    nameEn: 'BUC (business use case)',
    defJa: 'アクターに価値を届けるアクティビティの一連の流れ',
    defEn: 'a flow of activities that delivers value to an actor',
  },
  {
    type: 'condition',
    nameJa: '条件',
    nameEn: 'condition',
    defJa: '判定・計算のロジックを定める業務ルール',
    defEn: 'a business rule or decision/calculation logic that determines a judgment',
  },
  {
    type: 'variation',
    nameJa: 'バリエーション',
    nameEn: 'variation',
    defJa: 'システム内で使われる区分・種別を表す、名前の付いた値の集合',
    defEn: 'a named set of values that distinguishes a category or type used across the system',
  },
  {
    type: 'external_system',
    nameJa: '外部システム',
    nameEn: 'external system',
    defJa: 'このシステムの外側にあり、このシステムが呼び出す、またはこのシステムを呼び出すシステム',
    defEn: "a system outside this system's boundary that this system calls, or that calls this system",
  },
  {
    type: 'business_policy',
    nameJa: 'ビジネスポリシー',
    nameEn: 'business policy',
    defJa: '取引記録ではなく、ルールや計算に使われる業務パラメータやポリシー値（数値設定等）',
    defEn: 'a business parameter or policy value (such as a numeric setting) used in rules or calculations, rather than a transactional entity',
  },
];

// 質問文は判定対象が「RDRAモデルの記述」であることを明示する。
// 「人や役割そのものを新しく作るか」のように読めてしまわないようにするため
// （レビュー指摘: 種別判定の質問文が対象をシステムの実体と取り違えて読める）。
// 「この仕様」「this specification」という指示語では state を参照していないため、
// state のキー（`specification` / `acceptance_criteria`）をバッククォートで直接参照する
// （レビュー指摘2ラウンド目3: 種別判定の質問がstateを参照していない）。
function buildQuestions(lang) {
  const questions = {};
  for (const t of MODEL_TYPES) {
    const instructions =
      lang === 'ja'
        ? `\`specification\` と \`acceptance_criteria\` に書かれた内容により、RDRA の${t.nameJa}モデルに要素を追加する、または既存要素の記述を変更する必要があるか。${t.nameJa}モデルとは: ${t.defJa}`
        : `Based on the content in \`specification\` and \`acceptance_criteria\`, would it require adding a new element to, or modifying an existing element's description in, the RDRA ${t.nameEn} model? The ${t.nameEn} model is: ${t.defEn}`;
    questions[t.type] = { type: 'noul', instructions };
  }
  return questions;
}

function buildStateForSpec(requirement, spec) {
  return {
    requirement: requirement.requirement,
    reason: requirement.reason,
    specification: spec.specification,
    acceptance_criteria: spec.acceptance_criteria,
  };
}

// requirementsYaml: usdm/latest/requirements.yaml をパースした結果
async function judgeModelTypes({ requirementsYaml, lang, ask, dryRun = false }) {
  const requests = [];
  const rawAnswers = {};
  const questionTemplate = buildQuestions(lang);

  for (const req of requirementsYaml.requirements || []) {
    for (const spec of req.specifications || []) {
      const state = buildStateForSpec(req, spec);
      const questions = {};
      for (const [key, value] of Object.entries(questionTemplate)) {
        questions[`${spec.id}.${key}`] = value;
      }
      if (dryRun) {
        requests.push({ specId: spec.id, state, questions });
        continue;
      }
      const result = await ask({ state, questions });
      requests.push({ specId: spec.id, state, questions, usage: result.usage, latencyMs: result.latencyMs });
      Object.assign(rawAnswers, result.answers);
    }
  }

  return { requests, rawAnswers };
}

module.exports = { judgeModelTypes, MODEL_TYPES, buildQuestions, buildStateForSpec };
