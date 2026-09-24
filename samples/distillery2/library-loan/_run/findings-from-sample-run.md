# サンプル実走で見つかったプラグイン側の課題 (2026-09-24)

## 段階① 要求
- headless では `--allowedTools 'Bash(node:*)...'` が無いと検証スクリプトが飛ばされる (実行手順の問題。SKILL 側は問題なし)
- genUseCases の spec_ids 推定が 32 UC すべてで空だった。BUC.tsv の BUC 名と requirements.yaml の affected_models の buc target が一致しない生成では推定できない。LLM が埋めたので結果は問題ないが、推定規則を情報 (information) / 状態 (state) の target からも当てるよう改善余地
- 6 UC が blocked (対応 SPEC なし)。要求段階で仕様に無い UC を RDRA が増やす (取置の期限切れ取消など)。妥当だが、レビュー要約で目立たせる必要あり

## 段階② 決定
- capabilities.browser を true にした (RDRA に画面があるため)。サンプル実走の方針 (off) は手で上書きした
- フロントエンドを 2 ティア (patron / staff) に分けた。UC 実装のコストが増える。決定候補カタログ tiers.md に「初回は 1 frontend を推奨」を足すか検討

## 段階③ 基盤
- genSkeleton が生成する apps/*/package.json の format_check / lint / typecheck は echo の仮コマンド。static ゲートが「本物ではない pass」になる。最低限 `tsc --noEmit` と biome/eslint を入れるか、仮コマンドは exit 1 にして UC 実装で置き換えを強制する
- importUi は packages/ui に package.json を作らない。npm workspace として参照できない可能性
- 生成 root package.json の devDependencies に @redocly/cli が無く、compileContracts が最初 exit 1 になった。genSkeleton に追加する
- design が Next.js で作ったが ADR は SPA。d2-design が ADR の ui ヒントを読む前提だが、ADR 0008 に ui: が無かった可能性。要確認
- オーケストレータ (d2-run) が「届いていない完了通知」を自作した (LLM の逸脱)。派遣テンプレートに「サブエージェントの報告は待つ。自分で作らない」を明記する
- npm audit の中程度 2 件は未対応

## 段階④ 縦切り (貸出を登録する)
- genSkeleton の apps/*/package.json の test script が echo のまま。scaffold が vitest を配線し直した。生成時に vitest / tsc / prettier / eslint (または biome) を実スクリプトで入れる
- 生成 cucumber.js の ESM 形式が誤り。`export default { default: {...} }` ではなく `export default { ... }` (公式確認済み)。dry-run 用に test-app を読まない `dryrun` プロファイルも必要
- tracer の sanitizeScenarioId が日本語を `_` に潰し、9 シナリオが 2 ファイルに混ざった。sha 短縮を付けるなど一意にする
- 消費側 (frontend) の API クライアントが生成されない。v1 の openapi-generator codegen が v2 で落ちている。契約から型付きクライアント (typescript-fetch 相当) を生成する slot を d2-contract に戻す
- extractAsBuilt の前提一覧が id だけで引くため、backend-api の A-005 が frontend-staff の A-005 で上書きされる。tier + id で引く
- prTrailers が未起票の還流を `Feedback: rule:null` と出す。url が無い場合は出さない
- config の verifier 既定値 `claude-opus-5` は model パラメータとして無効。`opus` 等の有効値にし、implementer と異なることの確認を d2-run に残す
- 生成 .gitignore が `attempt-*/` を除外しており、run-state.md の「attempt は commit に含める」と矛盾。reports / traces だけ除外する
- d2-run の開始条件 (clean tree) がハーネスのファイル (run-stage.sh 等) で満たせない。`.git/info/exclude` は権限で拒否された。headless 手順側の問題だが、未追跡ファイルの扱いを SKILL に明記
- react / prettier / eslint が未導入のため、画面の TSX と一部 static 検査が未実装のまま pass 扱い。genSkeleton の依存に含めるか、ADR の言語 / FW から genSkeleton が依存を組み立てる
