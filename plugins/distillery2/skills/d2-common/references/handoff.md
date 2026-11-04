# 引き継ぎファイル

担当 (サブエージェント) は、作業の終わりに **引き継ぎファイル** を書く。人に聞きたいことと、前のステップの問題を、報告の本文ではなくこのファイルで返す。
進行役は報告の本文を読まず、このファイルを `handoff.js` で検査して振り分ける。**本文にだけ書いたことは扱われない** (経費精算の試し運転で、要求の抜けの指摘が報告に書かれただけで消えた)。

置き場は進行役が派遣文で渡す (`{handoff}`)。中身が無くても、空の配列で書く。

```yaml
schema_version: distillery2.handoff/v1
step: foundation                 # 派遣した段 (requirements / decide / foundation / design / contract-skeleton / scenario / contract / scaffold / tier / integrate / asbuilt / refute など)
asks:                            # 人に聞きたいこと
  - id: audit-store              # 英数字・_・-
    kind: choice                 # choice = 選び方の問題 / unknown_fact = 人しか知らない事実が要る (社員数・会社の色・契約済みのクラウドなど)
    question: 監査ログをどこに残すか
    options:                     # 2 つ以上。label は返信にそのまま使う
      - {label: DB の表, impact: 申請と同じ取引で書ける}
      - {label: ファイル, impact: 別に回収の仕組みが要る}
    recommended: DB の表          # 条件の付かない 1 つ (options の label)。決められなければ null
    reason: 申請と一緒に残せば抜けない
  - id: seed
    kind: choice
    question: 社員の初期データをどう入れるか
    options: [{label: 移行スクリプト, impact: 一度だけ}, {label: 管理画面, impact: UC が増える}]
    recommended: null
    no_recommendation_reason: 要望に手掛かりが無い   # recommended が null なら必須
upstream_issues:                 # 前のステップの問題 (自分の書き込み範囲では直せないもの)
  - id: list-entry
    target_step: requirements    # 戻し先: requirements / decide / foundation / scenario / contract / implementation
    title: 差し戻された申請を開く入口が無い   # 40 字以内
    detail: 社員が自分の申請の一覧を見る UC が無く、差し戻しの申請を開けない
    evidence: 画面の担当の確認 (申請の一覧の画面が要求に無い)
    recommended_fix: 自分の申請一覧の UC を足す
    # uc: submit-expense        # 上流の段 (要求・決定・基盤) の担当が、機能の中 (scenario / contract / implementation) を戻し先にするときだけ。対象の UC の slug
refutations: []                  # レビューの指摘への反証 (反証して直す派遣のときだけ。下記)
decisions:                       # 自分で決めたこと (報告の「決めたこと」と同じ D<n>。無ければ [])
  - {id: D1, topic: 予約の重なりの判定, choice: 開始と終了の半開区間で比べる, reason: 連続した予約を許す}
```

## 書き方の決まり

- **推奨は条件を付けない**。「指定があれば B、無ければ A」と書きたくなったら、条件を手元の事実で決められるなら決めた側を `recommended` にする。決められなければ `kind: unknown_fact` にする
- 推奨を書いたら `reason` (なぜその案か) も書く。前のステップの課題には `evidence` と `recommended_fix` が要る
- `unknown_fact` にも推奨 (仮置きの値) を書く。推奨案で進めるモードでは仮置きで進め、自律モードでは人に返る
- 推奨を決められないときは `recommended: null` と理由を書く (受理される。人に返る)
- `upstream_issues` は、自分の書き込み範囲の外を直さないと解けない問題だけを書く。範囲の中で直せるものは直す
- **上流の課題 (戻し先 requirements / decide / foundation) を 1 件書いたら、この UC の残りの段 (契約・各ティア・結合) で要る上流の決めごとも洗い出して、すべて同じファイルに書く**。上流の課題が出ると機能は止まり、上流を直してから戻るので、1 件ずつ返すと往復が件数だけ増える
- 課題のファイル (`<run>/issues/`・`docs/feedback/`) を直接書かない。進行役がこのファイルから下書きにする (同じ課題が二重に起票されない)
- 写し直した後の派遣で、統合できなかった機能側の差分 (`<run>/resume/<n>/*.diff`) を渡されたら、差分ごとに `resume_diffs` に扱いを書く: `{diff: <差分ファイルのリポ相対パス>, result: applied, where: <反映したファイル (複数ならカンマ区切り)>, reason: <要点>}` か `{diff, result: dropped, reason: <取り下げる理由>}`。applied は差分の追加行がそのファイルにあることを進行役が機械で確かめる
- 課題に `resume_from` (scenario / contract / implementation) を書くと、上流を直した後に機能をその段から続ける (書かなければ、要求の課題は scenario、決定・基盤の課題は implementation から)
- `target_step` の選び方: 何を作り直せば解けるか (要求 = USDM・RDRA・UC 一覧 / 決定 = 非機能グレード・ADR / 基盤 = 開発ルール・テスト基盤・画面部品・設定 / シナリオ / 契約 / 実装 / `plugin` = リポの中では直せない distillery2 の不具合)
- `plugin` の課題で、自分の書き込み範囲の中で回避できたら (雛形の書き直し・設定の追加など) 回避してから `workaround` に回避の仕方を書く。`workaround` のある課題では機能を止めず、プラグインへの報告として残る (0.3.0)。読むだけの点検 (mode=precheck) では回避をまだしないので、機能の中ですることになる回避の仕方を `workaround` に書く。進行役がその下書きを回避に合う段の派遣文に添え、その段の担当が回避する。その段で回避できなかったら、担当は同じ題名の課題を `workaround` 無しで引き継ぎファイルに書く (重ねの検査で既存の下書きと同じ題名になるので、題名の頭に「回避できない: 」を付ける。機能が止まり人に返る)。回避できないときだけ書かない (機能が止まり人に返る)。`workaround` は `plugin` の課題にだけ書ける
- 自分で決めたことは `decisions` に `D<n>` で書き、報告の本文の「決めたこと」の見出しの下にも同じ `D<n>` で 1 行ずつ書く (進行役が 1 対 1 を確かめ、決めたことの一覧に同じ ID で残す)

## 反証して直す派遣のとき

レビューの指摘 (`<reviews>/<point>/roundN.md`) を 1 件ずつ吟味し、`refutations` に全件を書く。

```yaml
refutations:
  - {finding: 指摘 1, result: accepted, reason: 要望の「出し直し」が UC に無い, change: 出し直しの UC を足した}
  - {finding: 指摘 2, result: refuted, reason: 申請の状態は状態モデルの「承認待ち」に書いてある}
  - {finding: 指摘 3, result: needs_info, reason: 上長が不在のときの扱いが要望に無い}
  - {finding: 指摘 4, result: plugin, reason: 検査のスクリプトの誤り (リポの中では直せない)}
```

- `accepted` は直してから書く (`change` に何を変えたか)。`refuted` は根拠 (ファイルと箇所) を `reason` に書く
- `needs_info` は人の判断が要るもの。進行役が人に返す

## 検証役

検証役は findings 以外を書けないので、findings (schema 2.2) に `asks` と `upstream_issues` を同じ形で持つ。

## 検査

`node <skills>/d2-common/scripts/handoff.js validate <file>` が exit 0 になること (進行役の受理の検査)。形は `<skills>/d2-common/scripts/schema-handoff.json`。
