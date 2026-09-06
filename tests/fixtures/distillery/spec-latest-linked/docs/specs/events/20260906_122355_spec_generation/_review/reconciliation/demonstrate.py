#!/usr/bin/env python3
"""Bounded docs-adoption fixture; not a general semantic validator or pipeline run."""
import argparse
import difflib
import hashlib
import json
from pathlib import Path
import tempfile

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--event', type=Path, required=True)
p.add_argument('--output', type=Path, required=True)
a = p.parse_args()
event = a.event.resolve()
docs = event.parents[2]
output = a.output.resolve()
output.mkdir(parents=True, exist_ok=True)
sha = lambda b: hashlib.sha256(b).hexdigest()
product = [f for f in event.rglob('*') if f.is_file() and (f.name in ('spec.md', 'model.md', '_model-summary.yaml', 'technical-rules.md') or (f.name.startswith('tier-') and f.suffix == '.md'))]
assert product, 'Target product body must exist before reconciliation'
def body_hashes():
    return {str(f.relative_to(event)): sha(f.read_bytes()) for f in sorted(product)}
before = body_hashes()
base = 'design/latest/storybook-app/src/'
component = base + 'components/common/SubmitActionButton.tsx'
story = base + 'stories/forms/SubmitActionButton.stories.tsx'
button = base + 'components/ui/Button.tsx'
paths = ['rdra/latest/条件.tsv', 'rdra/latest/状態.tsv', 'rdra/latest/バリエーション.tsv', 'arch/latest/arch-design.md', component, story, button, base + 'components/domain/LoanConfirmation.tsx', base + 'components/domain/LoanConfirmation.stories.tsx', base + 'components/domain/UserProfileCard.tsx', base + 'stories/Pages/司書ポータル/窓口貸出受付画面.stories.tsx']
texts = {name: (docs / name).read_text() for name in paths}
input_hashes = {name: sha((docs / name).read_bytes()) for name in paths}
old_comment = ''' * 更新系 API の二重送信防止を 1 箇所に集約する。押下で disabled + aria-busy="true" + loading にし、
 * 画面表示時に発行した冪等キー（UUID）を X-Idempotency-Key として送る（arch SR-002 / LR-032）。'''
new_comment = ''' * 押下時に onSubmit を呼び出す。画面側が HTTP 要求と X-Idempotency-Key ヘッダを送信する。
 * 画面側から受け取る submitting を Button の loading に渡す。送信中は Button が disabled と aria-busy を設定する。
 * disabled は Button の disabled へ渡す。idempotencyKey は data-idempotency-key 属性へ渡す。部品は HTTP 通信を行わない。'''
old_description = '更新系 API の二重送信防止を 1 箇所に集約する（Button の合成）。押下で disabled + aria-busy + loading にし、冪等キーを送る（arch SR-002 / LR-032）。'
new_description = '押下時に onSubmit を呼ぶ。画面側が HTTP と X-Idempotency-Key ヘッダを送信し、submitting を管理する。部品は submitting を Button の loading に渡し、送信中の disabled・aria-busy・loading を表示する。idempotencyKey は data-idempotency-key 属性に設定する。'
assert texts[component].count(old_comment) == 1, 'Current fixture changed: re-review component docs'
assert texts[story].count(old_description) == 1, 'Current fixture changed: re-review Story docs'
assert 'onClick={onSubmit}' in texts[component]
assert 'loading={submitting}' in texts[component]
assert 'disabled={disabled}' in texts[component]
assert 'data-idempotency-key={idempotencyKey}' in texts[component]
assert 'const isDisabled = disabled || loading' in texts[button]
assert 'disabled={isDisabled}' in texts[button]
assert 'aria-busy={loading || undefined}' in texts[button]
patched = {component: texts[component].replace(old_comment, new_comment), story: texts[story].replace(old_description, new_description)}
with tempfile.TemporaryDirectory(prefix='dist-spec-reconcile-', dir='/private/tmp') as temp:
    temp = Path(temp)
    for name in (component, story, button):
        target = temp / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(patched.get(name, texts[name]))
    reread = {name: (temp / name).read_text() for name in (component, story, button)}
    # Strip only the exact replaced spans; equality checks the remainder byte for byte.
    component_rest_equal = texts[component].replace(old_comment, '') == reread[component].replace(new_comment, '')
    story_rest_equal = texts[story].replace(old_description, '') == reread[story].replace(new_description, '')
    assert component_rest_equal and story_rest_equal
    assert reread[button] == texts[button]
    after = body_hashes()
    assert before == after
    assert input_hashes == {name: sha((docs / name).read_bytes()) for name in paths}
    diff = ''.join(''.join(difflib.unified_diff(texts[name].splitlines(True), reread[name].splitlines(True), fromfile='current-latest/' + name, tofile='hypothetical-adoption/' + name)) for name in (component, story))
    (output / 'submit-action-docs-adoption.patch').write_text(diff)
    evidence = {
      'schema_version': 'distillery.reconciliation-demonstration/v1',
      'scope': 'CR-60d99956-004 component docs and Story description only',
      'execution_kind': 'isolated_hypothetical_fixture',
      'actual_upstream_modified': False,
      'pipeline_executed': False,
      'latest_promoted': False,
      'input_sha256': input_hashes,
      'target_body_sha256_before': before,
      'target_body_sha256_after': after,
      'body_unchanged': before == after,
      'checks': {
         'component_outside_docs_unchanged': component_rest_equal,
         'story_outside_description_unchanged': story_rest_equal,
         'button_unchanged': reread[button] == texts[button],
         'actual_upstream_unchanged': True,
      },
      'limitations': ['Static source inspection and exact-span equality; no browser interaction or HTTP test.', 'Seven actual proposals remain pending; only CR-004 documentation adoption is simulated.', 'Hashes establish byte identity, not semantic completeness.'],
    }
    (output / 'evidence.json').write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'body_unchanged': True, 'body_files': len(before), 'actual_upstream_modified': False, 'evidence': str(output / 'evidence.json')}, ensure_ascii=False))
