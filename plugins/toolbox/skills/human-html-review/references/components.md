# 部品カタログ

`assets/base.html` の CSS で使える部品。**必要なものだけ選び、読者の問いの順に並べる。** すべて使う必要はない。

## 必須の 3 部品

### いま何の話か (`data-role="context"`)

最初の画面に置く。図 (現在地マップ) と 3 行の説明を横に並べる。

```html
<section class="now" data-role="context" aria-labelledby="now-h">
  <h2 id="now-h">いま何の話か</h2>
  <div class="split">
    <figure class="fig"> <!-- 現在地マップ SVG --> </figure>
    <dl class="facts">
      <dt>何の作業</dt><dd>請求書 PDF を自動で取り込む機能を作っている</dd>
      <dt>いまどこ</dt><dd>設計が終わり、実装に入る直前</dd>
      <dt>なぜ聞く</dt><dd>保存先を 2 案から選ぶ必要があり、月の運用コストが変わる</dd>
    </dl>
  </div>
</section>
```

### 何を決めてほしいか (`data-role="ask"`)

最初の画面に置く。問いは 1 文。答え方の種類を明示する。

```html
<section class="ask" data-role="ask" aria-labelledby="ask-h">
  <h2 id="ask-h">決めてほしいこと</h2>
  <p class="ask-q">取り込んだ PDF の保存先を、A「既存の DB」と B「新しいファイル置き場」のどちらにするか</p>
  <p class="ask-how">答え方: <b>選択</b>。A か B、条件があれば添えて</p>
</section>
```

複数の判断があれば `<ol class="ask-list">` で番号を付ける。

### どう答えるか (`data-role="reply"`)

**選ぶと返信の文面が組み上がり、ボタン 1 つでコピーできる**形にする。読者に文章を書かせない。

```html
<section class="reply" data-role="reply" aria-labelledby="reply-h">
  <h2 id="reply-h">答え方 (選ぶとコピーする文面が組み上がる)</h2>
  <div class="builder" data-builder>
    <div>
      <noscript>
        <p class="note warn">この画面では選択が使えません。右の文面をそのまま返信するか、書き換えて返信してください。</p>
      </noscript>
      <fieldset class="pick" data-needs-js disabled>
        <legend>保存先</legend>
        <label class="opt">
          <input type="radio" name="d1" data-reply="いまのデータベースに保存する案で進めてください" checked>
          <span>いまのデータベース<span class="hint">すぐ作れるが費用が高い</span></span>
        </label>
        <label class="opt">
          <input type="radio" name="d1" data-reply="新しいファイル置き場に保存する案で進めてください">
          <span>新しいファイル置き場<span class="hint">安いが 2 日多くかかる</span></span>
        </label>
      </fieldset>
      <fieldset class="pick" data-needs-js disabled>
        <legend>条件 (任意・複数選べる)</legend>
        <label class="opt">
          <input type="checkbox" data-reply="保存期間は 1 年にしてください">
          <span>保存期間は 1 年</span>
        </label>
      </fieldset>
      <label class="note-label" for="reply-note">補足 (任意)</label>
      <textarea id="reply-note" rows="2" data-reply-note data-needs-js disabled placeholder="気になる点・条件があれば"></textarea>
    </div>
    <div>
      <p class="builder-out-h">
        返信する文面
        <button type="button" class="copy-btn" data-copy="reply-text" data-needs-js disabled>コピー</button>
        <span class="copy-status" role="status" aria-live="polite"></span>
      </p>
      <pre class="copy" id="reply-text" data-reply-out>いまのデータベースに保存する案で進めてください</pre>
      <p class="builder-fallback">この文面をそのまま返信してください。手で書き換えてもかまいません。</p>
    </div>
  </div>
</section>
```

組み立ての仕組み:

| 属性 | 付ける先 | 役割 |
|---|---|---|
| `data-builder` | 囲みの `div` | この中の選択を 1 つの文面にまとめる |
| `data-needs-js` + `disabled` | `fieldset` / `textarea` / `button.copy-btn` | スクリプトが動いたときだけ操作できるようにする。選択したのに文面が変わらない食い違いを防ぐ |
| `data-reply="返信に入る 1 行"` | `input` (radio / checkbox) | 選ばれた行だけが、上から並んだ順に文面へ入る |
| `data-reply-note` | `textarea` | 書かれていれば最後の行として足す |
| `data-reply-out` | `pre` | 組み上がった文面の表示先。`id` を付ける |
| `data-copy="<pre の id>"` | `button.copy-btn` | その要素の文字をクリップボードへ入れる |

書き方の決まり:

- `data-reply` の文字列は、**そのまま返信として意味が通る 1 文**にする (「A」だけにしない)
- 択一は `radio`、任意の追加条件は `checkbox`、自由記入は `textarea` 1 つ
- **`radio` の `name` は判断ごとに変える** (`d1` / `d2` …)。同じ `name` はページ全体で 1 つのグループになり、別の判断を選ぶと前の判断が外れる
- 操作する部品には `data-needs-js disabled` を付け、`<noscript>` で「文面を書き換えて返信してほしい」と添える
- 初期状態で ⭐ 推奨案を `checked` にし、`pre` の初期表示も同じ文面にする (JS が動かない環境でもコピーできる)
- 選択肢の補足は `<span class="hint">` で 1 行。判断材料そのものは本文の図や表に置く

判断が複数あるときは `fieldset.pick` を判断の数だけ並べ、`radio` の `name` を判断ごとに変える。並んだ順に文面の行が並ぶ。

### 例文だけを置く場合 (承認だけを求めるとき)

選ぶものが無いときも、コピーボタンは付ける。

```html
<div class="grid cols-2">
  <div>
    <p class="builder-out-h">承認する<button type="button" class="copy-btn" data-copy="r-ok" data-needs-js disabled>コピー</button>
      <span class="copy-status" role="status" aria-live="polite"></span></p>
    <pre class="copy" id="r-ok">この内容で進めてください</pre>
  </div>
  <div>
    <p class="builder-out-h">直してほしい<button type="button" class="copy-btn" data-copy="r-ng" data-needs-js disabled>コピー</button>
      <span class="copy-status" role="status" aria-live="polite"></span></p>
    <pre class="copy" id="r-ng">この内容で進めてください。ただし〜を直してください</pre>
  </div>
</div>
```

`copy-status` はボタンと同じ親要素に置く。置き場所が違うと結果の表示が出ない。

## レイアウト部品

| クラス | 用途 |
|---|---|
| `.shell` | ページ幅。上限 1760px |
| `.grid.cols-2` / `.cols-3` | 横並び。狭い画面では縦に落ちる |
| `.split` | 図 + 説明の横並び (図 3 : 文 2)。狭い画面では縦 |
| `.wide` | 表や図を親幅いっぱいに |
| `.scroll-x` | 表や図を個別に横スクロール |

## 内容部品

### 図 (`figure.fig`)

```html
<figure class="fig scroll" style="--min: 960px">
  <svg viewBox="0 0 960 240" role="img" aria-labelledby="f2-t"> <title id="f2-t">…</title> … </svg>
  <figcaption>読者が受け取るべき結論を 1〜2 文で</figcaption>
</figure>
```

- `svg` は必ず `figure` の中に置き、`figcaption` を空にしない (検査スクリプトが図ごとに確かめる)
- viewBox 幅が 400 を超える図は `scroll` を付け、`--min` に viewBox 幅を渡す (狭い画面で文字を読める大きさに保つ)
- `figcaption` は `figure` の中なら図の上でも下でもよい (前後ペアは上にラベルとして置く)

### 前後ペア (`.pair`)

```html
<div class="pair">
  <figure class="fig"><figcaption class="pair-label">前</figcaption> <svg …/> </figure>
  <figure class="fig"><figcaption class="pair-label">後</figcaption> <svg …/> </figure>
</div>
```

### 表 (`table`)

ヘッダ行は必須。長い表は `.scroll-x` で包む。比較表は 1 列目に観点、2 列目以降に案。

```html
<div class="scroll-x">
<table>
  <thead><tr><th>観点</th><th>A 既存の DB</th><th>B 新しい置き場</th></tr></thead>
  <tbody>
    <tr><th scope="row">月の費用</th><td>増えない</td><td>約 3,000 円増える</td></tr>
  </tbody>
</table>
</div>
```

### 事実ラベル (`.tag`)

主張の根拠の種類を文字で示す。色だけに頼らない。

```html
<span class="tag ok">確認済み</span>
<span class="tag claim">報告のみ</span>
<span class="tag guess">推測</span>
<span class="tag unknown">未確認</span>
```

### 注意 (`.note`)

失敗、壊れうる所、未確認を目立たせる。折りたたまない。

```html
<aside class="note warn"><b>壊れうる所:</b> 既存の夜間バッチと同じテーブルに書くため、実行時間が重なると遅くなる (<span class="tag guess">推測</span>)</aside>
```

種類: `.note.warn` (注意) / `.note.stop` (失敗・阻害) / `.note.info` (補足)

### 案カード (`.option`)

選択のとき、案ごとの「その後の姿」を並べる。おすすめには `.recommend` と、おすすめが変わる条件を書く。

```html
<div class="grid cols-2">
  <article class="option recommend">
    <h3>A 既存の DB に保存する <span class="badge">おすすめ</span></h3>
    <figure class="fig"> <!-- A を選んだ後の構成図 --> </figure>
    <dl class="facts">
      <dt>その後の姿</dt><dd>新しい部品を増やさずに済む</dd>
      <dt>費用</dt><dd>増えない</dd>
      <dt>戻せるか</dt><dd>戻せる。データを移すだけ</dd>
    </dl>
    <p class="cond">おすすめが変わる条件: PDF が月 1 万件を超えるなら B</p>
  </article>
  <article class="option"> … </article>
</div>
```

### 決めた後に起きること (`.after`)

```html
<table class="after">
  <thead><tr><th>答え</th><th>次に起きること</th><th>戻せるか</th></tr></thead>
  <tbody>
    <tr><td>A</td><td>実装に入る。所要 2 日</td><td>実装前なら戻せる</td></tr>
    <tr><td>B</td><td>置き場を作ってから実装。所要 3 日</td><td>置き場の削除が必要</td></tr>
  </tbody>
</table>
```

### 付録 (`details.appendix`, `data-role="appendix"`)

本文から追い出したものを折りたたむ。検査スクリプトは `data-role="appendix"` の中と `<pre>` を内部 ID の検査から外す。inline の `<code>` は外さない (本文に ID を残す抜け道にしない)。

```html
<details class="appendix" data-role="appendix">
  <summary>用語と ID の対応</summary>
  <table> … </table>
</details>
```

## 使わない部品

- 進捗バー、丸いステータス点 (文字ラベルで十分)
- 長い引用ブロック (要約して表に)
- 折りたたみの中の失敗・警告 (必ず開いた状態で見せる)
