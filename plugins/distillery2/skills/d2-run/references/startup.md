# 起動シーケンスの細目

d2-run の本体 (SKILL.md) の「起動シーケンス」の手順 2〜5 の細目である。

## 手順 2: モデルの解決

`.distillery/config.yaml` があれば読み、`models.implementer` と `models.verifier` を解決する。

- `implementer: null` はセッション既定モデルなので、**実際のモデル名に解決してから** verifier と並べて記録する
- `verifier` は `opus` などの短い別名で書く (フル ID は `model` パラメータとして無効)

**独立検証の条件は「別のサブエージェント (文脈が新しい) で、実装役と同等以上のモデル」**。
同じモデル ID に解決されても止めない (記録だけ残す)。
止めるのは verifier が実装役より明らかに弱い別名 (例: 実装役が opus で verifier が haiku) のときだけ。

## 手順 3: UC の解決

④ なら UC を解決する。

- 引数が slug なら `use-cases.yaml` と照合する
- UC 名なら NFC 正規化して一意に一致する行を探す (複数なら候補を示して選ばせる)

## 手順 4: 旧形式の run と、上流で止めた UC

④ の再開時に確かめる。

- `runState.js status` が `legacy_order: true` (0.1.25 までの順の run) なら、main-merge.md の「旧形式の run」に従う
- 上流で止めた UC は再開しない (自動選択が `resume` を返したときだけ写し直して続ける)

## 手順 5: 作業ツリーの clean 判定

④・上流の差分の開始時に行う。
④ の再開時は branch 一致を確認する (feature)。

`git status --porcelain` のうち、次のものだけを対象にする。

- **追跡済みの変更**
- **未追跡でも `docs/` `apps/` `packages/` `contracts/` `features/` `.distillery/` 配下のファイル**

これらがあれば勝手に stash / commit せず整理を依頼して停止する。

それ以外のルート直下の未追跡ファイル (ハーネスの `run-stage.sh` などの実行スクリプト) は clean 判定に含めず、**報告に一覧として載せて無視**する (ハーネスのファイルで clean 条件を満たせなくなるため)。
`.git/info/exclude` への書き込みは前提にしない (権限で拒否されうる)。

### 再開のときの例外

④ の再開では、対象の変更がすべて `runState.js status` の `next_stage` の派遣の書き込み範囲 (派遣表) の中なら、止まった段の成果物なので整理を依頼せず、その段の受理の検査からやり直す (範囲の外が 1 つでもあれば止まる。引き継ぎファイル `<run>/handoff/**` は範囲の外でも数えない)。
