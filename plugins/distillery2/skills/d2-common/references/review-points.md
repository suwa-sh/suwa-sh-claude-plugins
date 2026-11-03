# 縦・横レビューの場所と観点

成果物ごとに 7 か所で、別系統のモデル (Codex) に縦・横の整合を見させる。**縦** = その場所の入力 (前のステップの成果物) と合っているか、**横** = 同じ成果物の中で食い違いや抜けが無いか。
進行役が `node <skills>/d2-common/scripts/reviewStep.js run` で回す (依頼文はこのファイルの下の定義から組む。観点は 1 か所 5 つ以内、報告の閾値は medium 以上)。

| 場所 | 回す時点 | 対象 (target) | 反証して直す担当 |
|---|---|---|---|
| 要求 (`requirements`) | ① と要求の差分の担当の受理の後、確認ページの前 | `docs/requirements/` | d2-requirements |
| 決定 (`decide`) | ② の受理の後、確認ページの前 | `docs/nfr/`・`docs/adr/` | d2-decide |
| 基盤 (`foundation`) | ③ の仕上げの受理の後、確認ページの前 | `docs/rules/`・`contracts/`・`docs/design/`・`.distillery/config.yaml` | 直す場所の担当 (下の「反証して直す派遣の引数」) |
| シナリオ (`scenario`) | ④ scenario の受理の後、確認ページの前 | その UC の feature と受入シナリオ | d2-implement mode=scenario |
| 契約 (`contract`) | ④ contract の受理の後 | その UC の契約の差分 (`git diff <base_head> -- contracts/`) | d2-contract mode=uc |
| 実装 (`implementation`) | ④ verify と同時 (検証役は残す)。ティアごとに 1 依頼を**順に**回す (同じ workspace では runner が 1 つずつしか動かない。スクリプトはロックで断られたら待って起動し直す) | そのティアの変更ファイル (verify の一覧と同じ) | d2-implement mode=tier |
| as-built (`asbuilt`) | ④ asbuilt の受理の後 | `docs/as-built/<業務>/<UC>/` と `docs/as-built/_system/` | d2-asbuilt |

## 回し方

1. `reviewStep.js run --point <場所> --target <パス> ... --out <場所の置き場> [--known <課題ファイル> ...]` (Bash の timeout は 600000 ms。スクリプトは 540 秒で切り上げる)。場所の置き場は機能の中なら `<run>/reviews/<場所>[-<tier>]/`、上流なら `.distillery/reviews/<場所>/` (どちらも追跡する)。
   スクリプトが `<場所の置き場>/<n>/round<k>.md` に書く (1 ラウンド目は新しい `<n>`、2 ラウンド目は同じ `<n>`。結果の `dir`)。同じ場所を同じ起動で 2 回回しても前の結果を上書きしない。
   課題にした指摘 (この場所の成果物への課題ファイル) は `--known` で渡す (依頼文の「既知 (報告不要)」に載り、次のラウンドで出直さない)
2. 結果の JSON の `status`:
   - `reviewed`: 指摘が 1 件以上なら、その場所の担当を「反証して直す」で派遣し直す (write-set はその場所と同じ。引き継ぎファイルの `refutations` に全件)。0 件なら次へ
   - `unavailable` / `timed_out` / `failed`: **未レビュー**。自律モードは人に返し、「同じモデルで代わりにレビューする / このまま進む / 止める」を聞く。推奨案で進めるモードは、同じ依頼文 (`prompt` のファイル) を新しいサブエージェント (Agent ツール、同じモデル) に渡して `round1.md` を書かせ、`fallback: same-model` を決めたことの記録に残す
3. **2 ラウンド目**は 1 回だけ、1 ラウンド目に `FAIL` の観点があるか、反証で `accepted` になった指摘に high / critical があるときに回す (`--round 2 --previous <round1.md>`)。それ以外は直したまま進め、「外部の再レビューなし」を決めたことの記録に残す
4. 反証で `needs_info` が残ったら、自律モードは人に返し、推奨案で進めるモードは進行役が推奨を作って仮置きする (d2-run の routing.md「人に返すとき」)

## 反証して直す派遣の引数

元の派遣の引数をそのまま使わない場所がある (骨格の生成を回し直すと、既存の UC の契約を消すおそれがある)。

| 場所 | 指摘の対象 | 派遣 |
|---|---|---|
| 要求 / 決定 / シナリオ / as-built | — | 元の派遣と同じ (`d2-requirements` / `d2-decide` / `d2-implement mode=scenario uc=<slug>` / `d2-asbuilt uc=<slug>`) |
| 基盤 | 開発ルール・設定・テスト基盤 | `d2-foundation phase=<該当 phase>` |
| 基盤 | 契約 (UC がまだ無い) | `d2-contract mode=skeleton` |
| 基盤 | 契約 (`contracts/uc-index.yaml` に UC がある) | **`d2-contract mode=uc uc=<その operation を持つ UC>`** (skeleton は使わない)。UC に属さない共通の部分 (共通コンポーネント・エラー型) だけなら `mode=skeleton` に「既存の UC の operation と分割ファイルは変えない・消さない」を添え、受理で `validateUcIndex.js contracts` が exit 0 |
| 基盤 | 画面部品 | `d2-design mode=feedback items=<直すファイルと内容>` |
| 契約 | — | `d2-contract mode=uc uc=<slug>` |
| 実装 | — | `d2-implement mode=tier uc=<slug> tier=<tier> attempt=<今の n>` |

## 観点の定義

```yaml
requirements:
  - {id: P1, name: 要望との縦の整合, look: 要望に書かれた業務・利用者・操作・状態の変化が、要求・UC 一覧・RDRA に漏れなく表れているか}
  - {id: P2, name: UC の抜け, look: 状態の移り変わり (例 差し戻し → 出し直し) と、利用者がその状態の対象を探して開く操作 (一覧・検索) が UC として揃っているか}
  - {id: P3, name: USDM と RDRA の横の整合, look: 要求・仕様・受入基準と、RDRA の業務・情報・状態・条件の名前と中身が食い違っていないか}
  - {id: P4, name: 受入基準の確かめやすさ, look: 受入基準が 1 つの UC で確かめられる単位になっていて、条件と結果が具体的か}
decide:
  - {id: P1, name: 要求との縦の整合, look: 非機能グレードと ADR が、要求の規模・利用者・業務の重さと合っているか}
  - {id: P2, name: ADR どうしの横の整合, look: ティア構成・認証・データ・テストの方針の ADR が互いに矛盾せず、ルール (rules) が決定を表しているか}
  - {id: P3, name: 決めずに残した点, look: 確信の低い決定や仮置きが、問いとして返されているか (黙って既定にしていないか)}
foundation:
  - {id: P1, name: ADR との縦の整合, look: 開発ルール・依存方向の検査・実行設定・CI が ADR の決定どおりか}
  - {id: P2, name: 契約の骨格と画面部品, look: 契約の骨格 (エラー型・認証・共通部品) と画面部品が、RDRA・UC 一覧・ADR と合っているか}
  - {id: P3, name: 基盤の中の横の整合, look: 実行設定のティア・契約・コマンドと、骨組み・テスト基盤・契約テストの生成が食い違っていないか}
scenario:
  - {id: P1, name: 受入基準との縦の整合, look: UC の受入基準がすべてシナリオで確かめられ、シナリオが受入基準に無い振る舞いを決めていないか}
  - {id: P2, name: RDRA の状態と条件, look: 状態の移り変わりと条件 (正常・境界・異常) が、RDRA の状態モデル・条件と合っているか}
  - {id: P3, name: シナリオの横の整合, look: シナリオどうし、main マージ済みの UC のシナリオと食い違っていないか。前提のデータの作り方が成り立つか}
contract:
  - {id: P1, name: シナリオとの縦の整合, look: シナリオの操作・結果が、契約の操作・応答・エラーで表せているか}
  - {id: P2, name: 例どうしの横の整合, look: 応答ごとの例が、URL の値・ヘッダ・テスト用データ (x-test-requests) で区別でき、同じ要求で別の結果を期待していないか (同じ status の例どうしも)}
  - {id: P3, name: 他の UC の契約, look: 共有する操作・型・エラーの変更が、main マージ済みの UC の契約と食い違っていないか}
  - {id: P4, name: RDRA の情報との整合, look: 契約の項目と DB の表が、RDRA の情報の名前と中身に合っているか}
implementation:
  - {id: P1, name: シナリオと契約との縦の整合, look: 実装がシナリオの振る舞いと契約の応答・エラーをそのとおりに満たしているか}
  - {id: P2, name: ルールと ADR, look: 開発ルール・依存の向き・ADR の決定 (認証・データ・ログ) に沿っているか}
  - {id: P3, name: ティアどうしの横の整合, look: 画面と API・API と DB の間で、項目・エラー・状態の扱いが食い違っていないか}
  - {id: P4, name: 補った前提, look: 実装者が補った前提が互いに矛盾せず、仕様の穴を黙って埋めていないか}
asbuilt:
  - {id: P1, name: 実装との縦の整合, look: as-built の記述が、コード・ゲートの記録・前提・検証役の指摘と合っているか}
  - {id: P2, name: 要求との整合, look: 決めたこと・課題が要求と食い違っていないか。課題が漏れなく課題として残っているか}
  - {id: P3, name: システム全体との横の整合, look: UC の記録とシステム全体の記録 (依存図など) が食い違っていないか}
```
