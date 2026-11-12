'use strict';
// スキルの定義 (SKILL.md) の形を守る。
// 本体は「目的 → 呼び出し → 手順 → 決まり → 細目の文書」の順に書き、細かい話は細目の文書 (references/) に分ける (段階的開示)。
// ここで守るのは形だけ。書いてある決まりの中身は各スキルの docContract.test.js が守る。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PLUGIN = path.resolve(__dirname, '../../../plugins/distillery2');
const SKILLS = fs.readdirSync(path.join(PLUGIN, 'skills')).filter(d => fs.existsSync(path.join(PLUGIN, 'skills', d, 'SKILL.md')));
const read = d => fs.readFileSync(path.join(PLUGIN, 'skills', d, 'SKILL.md'), 'utf8');
const body = t => t.split(/^---$/m).slice(2).join('---');

// Agent Skills 仕様の目安は 500 行未満・5000 トークン未満 (ここでは 500 行以下を守る)。字数の上限は、いまの最大 (基盤) を超えて増やさないための歯止め
const MAX_LINES = 500;
const MAX_CHARS = 10500;

test('本体は 500 行以内・字数の上限以内 (細かい話は細目の文書に分ける)', () => {
  for (const d of SKILLS) {
    const b = body(read(d));
    assert.ok(read(d).split('\n').length <= MAX_LINES, `${d}: SKILL.md が ${MAX_LINES} 行を超えた`);
    assert.ok([...b].length <= MAX_CHARS, `${d}: SKILL.md の本体が ${[...b].length} 字 (上限 ${MAX_CHARS} 字)。細目の文書に分ける`);
  }
});

test('本体は、何をするスキルかの説明から始まる (見出しや表から始めない)', () => {
  for (const d of SKILLS) {
    const m = body(read(d)).match(/^# (.+)\n\n(.+)$/m);
    assert.ok(m, `${d}: 見出し 1 の直後に本文が無い`);
    assert.equal(m[1], d, `${d}: 見出し 1 はスキル名だけにする`);
    assert.ok(!/^[#|`\-]/.test(m[2]) && /[。]$/.test(m[2]), `${d}: 冒頭は 1 文の説明にする: ${m[2].slice(0, 40)}`);
  }
});

test('本体に版の経緯の注記 (0.x.y) を書かない (経緯は CHANGELOG にある)', () => {
  for (const d of SKILLS) {
    const hits = body(read(d)).match(/\b0\.\d+\.\d+\b/g) || [];
    assert.deepEqual(hits, [], `${d}: 版の注記が残っている`);
  }
});

test('本体の末尾に「細目の文書」の表があり、文書・読むとき・内容を書く。リンク先は実在する', () => {
  for (const d of SKILLS) {
    if (d === 'd2-common') continue; // 共通の定義は「中身」の表が同じ役割を持つ
    const t = read(d);
    const i = t.indexOf('\n## 細目の文書\n');
    assert.ok(i >= 0, `${d}: 「細目の文書」の節が無い`);
    const sec = t.slice(i);
    assert.match(sec, /\| 文書 \| 読むとき \| 内容 \|\n\|---\|---\|---\|/, `${d}: 表の列は 文書・読むとき・内容`);
    const rows = sec.split('\n').filter(l => /^\| \[/.test(l));
    assert.ok(rows.length >= 1, `${d}: 細目の文書が 1 つも無い`);
    for (const r of rows) {
      const cells = r.split('|').slice(1, -1).map(c => c.trim());
      assert.equal(cells.length, 3, `${d}: ${r.slice(0, 60)}`);
      assert.ok(cells[1] && cells[2], `${d}: 読むとき・内容が空: ${r.slice(0, 60)}`);
      const link = cells[0].match(/\]\(([^)]+)\)/)[1];
      assert.ok(fs.existsSync(path.resolve(PLUGIN, 'skills', d, link)), `${d}: リンク先が無い: ${link}`);
    }
  }
});

/** dir の下の .md を、スキルのルートからの相対パスで列挙する */
function listMd(skill, dir) {
  const abs = path.join(PLUGIN, 'skills', skill, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? listMd(skill, path.join(dir, e.name)) : e.name.endsWith('.md') ? [path.join(dir, e.name)] : []));
}

test('本体が指す文書は実在する。references/ の下の文書は、本体からリンクかパスの記述を辿って届く (決まりを置いた文書への案内が消えない)', () => {
  for (const d of SKILLS) {
    const t = read(d);
    for (const m of t.matchAll(/\]\(((?:references|scripts)\/[^)#]+)/g)) {
      assert.ok(fs.existsSync(path.join(PLUGIN, 'skills', d, m[1])), `${d}: リンク先が無い: ${m[1]}`);
    }
    // 届く = 届いている文書 (最初は本体) の本文に、その文書のパスが出てくる (スキルのルートから、またはその文書の場所からの相対)
    const files = listMd(d, 'references');
    const reached = new Map([['SKILL.md', t]]);
    for (let grew = true; grew;) {
      grew = false;
      for (const f of files) {
        if (reached.has(f)) continue;
        const hit = [...reached].some(([from, text]) => {
          const rel = path.relative(path.dirname(from), f);
          // 入れ子のフォルダ (雛形やフェーズごとの文書) は、フォルダを指す記述で中の文書に届くとみなす
          const dir = path.dirname(f);
          return text.includes(f) || text.includes(rel) || (dir !== "references" && text.includes(`${dir}/`));
        });
        if (hit) { reached.set(f, fs.readFileSync(path.join(PLUGIN, 'skills', d, f), 'utf8')); grew = true; }
      }
    }
    assert.deepEqual(files.filter(f => !reached.has(f)), [], `${d}: 本体から届かない文書`);
  }
  // 進行役: 段階ごとの手順の文書は、本体から直接指す (細目を辿らせない)
  const run = read('d2-run');
  for (const f of ['startup.md', 'stage-requirements.md', 'stage-decide.md', 'stage-foundation.md', 'stage-uc.md', 'review.md', 'main-merge.md', 'issues.md', 'routing.md', 'subagent-template.md', 'run-state.md', 'git-delivery.md', 'direct-io.md', 'troubleshooting.md']) {
    assert.ok(run.includes(`(references/${f})`), `d2-run: ${f} を本体から指していない`);
  }
});
