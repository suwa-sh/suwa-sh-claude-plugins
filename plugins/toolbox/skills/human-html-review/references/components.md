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

コピーして返せる例を置く。

```html
<section class="reply" data-role="reply" aria-labelledby="reply-h">
  <h2 id="reply-h">答え方 (コピーして返信)</h2>
  <div class="grid cols-2">
    <pre class="copy">A で進めてください</pre>
    <pre class="copy">B で進めてください。ただし保存期間は 1 年にしてください</pre>
  </div>
</section>
```

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
