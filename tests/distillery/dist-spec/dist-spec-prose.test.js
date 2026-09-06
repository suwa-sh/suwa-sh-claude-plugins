'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inspect}=require('../../../plugins/distillery/skills/dist-spec/scripts/validateSpecProse');
test('product prose lint identifies workflow annotations, proposed-request IDs and editorial instructions',()=>{
 const text='生成結果はneeds-spec-changeです。\nCR-60d99956-001を待つ。\n状態表はここへ転記しない。\nスキルの手順で実行する。';
 assert.deepEqual(new Set(inspect(text).map(f=>f.rule)),new Set(['workflow-status','request-id','editorial-direction','skill-operation']));
});
test('product prose lint retains runtime prohibitions, pending UI states and latest reference links',()=>{
 const text='# 貸出を登録する\n司書が書籍と利用者を指定して貸出を確定する。\n| 条件 | 処理 |\n| 応答が未確定 | 同じキーで再送する |\n失敗時は貸出情報を更新しない。\n[状態](../../rdra/latest/状態.tsv)の貸出登録を参照する。';
 assert.deepEqual(inspect(text),[]);
});
