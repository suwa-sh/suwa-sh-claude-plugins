# mode=feedback: 項目のファイル (stories と部品) だけを直す

要求の差分で残った「画面の見本の修正」を直す mode である。

## いつ呼ばれるか

要求の差分で、要求担当が「画面の見本の修正」を残った作業として報告する。
人が「対応する」と選ぶと、d2-run が次の形で派遣する。

```
mode=feedback items=<直すファイルと直す内容を 1 行ずつ>
```

直すファイルは、リポジトリのルートからの相対パス `docs/design/storybook-app/src/<相対パス>` で渡される。
見本 `stories/<Name>.stories.tsx` も部品 `components/**` も、項目になる。
パスの形は、派遣表と、d2-run の要求の差分の手順と同じである。

③ の全生成 (手順 1〜6) は**しない**。
既存の部品、トークン、他の Story を作り直さない。

## mode=feedback: 読むもの

- `items` に書かれた `docs/design/storybook-app/src/<相対パス>` (直すファイル)
- 直すファイルが使う、または直すファイルを使う `docs/design/storybook-app/src/**`。部品の項目なら、その部品を import する部品と Story を辿る
- `docs/design/screens.yaml` (画面 ↔ Story の対応。Story を消す項目があるときだけ直す)
- `docs/requirements/use-cases.yaml` (`validateScreens.js --use-cases` の実在検査)

## mode=feedback: 書くもの

- `docs/design/storybook-app/src/**` のうち、項目に書かれたファイルと、その項目を直すために要る依存。項目に無い Story は書き換えない
- `docs/design/screens.yaml` (画面や Story を消す項目があるときだけ。画面が増減しなければ変えない)

項目が部品のとき、その部品を使う他の Story の表示も変わる。直してよい (「直せない」にしない)。報告の「影響する Story」に、その部品から import を **Story のファイルまで辿った**一覧 (部品を使う部品を介する間接の利用も含む) を書く。
表示の確認は、受理の storybook build と、取り込み直し後の main マージ済み UC の frontend の unit の回帰が担う。

`packages/ui/**` への取り込み直しは、d2-run が `importUi.js` で行う。
ここでは触らない。

## mode=feedback: 完了条件

- `npx storybook build` が通る (`docs/design/storybook-app/` で)
- `validateScreens.js docs/design/screens.yaml --app docs/design/storybook-app/src --use-cases docs/requirements/use-cases.yaml` が exit 0 を返す

## mode=feedback: 報告

| 報告の欄 | 書くこと |
|---|---|
| ファイルの一覧 | 変えたファイルと、消したファイル |
| 項目ごとの結果 | 項目ごとに「直した (変えたファイル)」か「直せない (理由)」、項目が部品なら「影響する Story」の一覧を書く |
| 項目の外の変更 | 項目のファイルの外を変えたか消したら「**項目の外の変更**」に、ファイルごとにどの項目のための依存かを書く。消したなら、どの項目で使われなくなったかを書く |

d2-run の受理は、変わったファイルが、項目、「項目の外の変更」の欄、`screens.yaml` のどれかに入ることを確かめる。
