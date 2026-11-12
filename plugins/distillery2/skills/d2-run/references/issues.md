# 課題ファイル

前のステップへ戻す課題を、git 管理のファイルで持つ。

- 置き場所: `docs/feedback/<issue>.md`。front matter は `kind` (互換)・`target_step` (戻し先: requirements / decide / foundation / scenario / contract / implementation)・`title`・`from_uc` (slug)・`status: open`・`created`。本文は課題の本文
- 振り分けは [routing.md](routing.md)「前のステップの課題」。上流 (要求・決定・基盤) は上流の差分、main マージ済みの UC への課題は開き直し (`reopen_targets`)
- `kind: plugin` (プラグインへ持ち帰る課題): 自動選択のきっかけにしない。distillery2 を直した後に人が `git rm` して commit する。完了報告に一覧を載せる (`scan` の `plugin`)。`workaround: true` の課題 (リポの中で回避して続けた) では止まらない。止まるのは `scan` の `plugin_blocking` が残るときだけ (routing.md「プラグインの不具合」)
- UC の課題は main マージのときに `feedbackBatch.js file-issues` が課題ファイルにする (squash の 1 commit に入る)。上流で止めるときは routing.md「上流で止めるとき」の手順で一時の worktree から main へ入れる。課題の `resume_from` (scenario / contract / implementation) は写し直した後に続ける段
- 一覧 `docs/feedback/README.md` は genDocsReadme が生成する (`docs/README.md` には件数と種類ごとの内訳と一覧へのリンクだけ)
- 消すのは反映したとき (routing.md「課題の消し方」)。中身は git の履歴に残る
