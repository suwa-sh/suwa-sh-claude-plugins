# コンポーネント導出 (design-components)

RDRA の情報 / 画面 / 状態から、UI 共通部品とドメイン特化部品を導出する。

## UI 共通コンポーネント (必ず生成)

| コンポーネント | 用途 / variant |
|---|---|
| Button | 全アクション (default/secondary/outline/ghost/destructive, sm/md/lg) |
| Badge | ステータス表示 (default/success/warning/destructive/info/outline) |
| Card | コンテンツコンテナ (hoverable) |
| Input | フォーム入力 (label, error state) |

## ドメイン特化コンポーネント (RDRA から導出)

| RDRA パターン | コンポーネント候補 |
|---|---|
| 画面に「検索」 | SearchFilter |
| 画面に「一覧」 + 情報に画像属性 | ImageCard ({Entity}Card) |
| 状態モデルが存在 | StatusBadge ({Entity}StatusBadge) |
| 状態数 ≥ 3 かつ順序性 | StepTracker ({Entity}Tracker) |
| 情報に評価/スコア属性 | StarRating |
| 情報に金額属性 | PriceDisplay |
| 画面に「問合せ」 | MessageThread |
| 画面に「カレンダー」/日時選択 | BookingCalendar / DatePicker |
| 情報に精算/売上属性 | SummaryCard |
| アクターに審査/認証フロー | VerificationBadge |
| NFR に PII | PiiMaskedText |

## 実装ルール (トークン参照の徹底)

- ハードコードカラー禁止。`text-white` / `bg-gray-200` → トークン参照
  (`style={{ color: 'var(--color-white)' }}` か `@theme inline` 経由の `text-*`)。
- status 背景は semantic token (`--success-light` 等)。`--color-green-50` を直接使わない。
- hover は `--hover-muted` + fallback。
- コンポーネント内で emoji を使わない。アイコンが要るなら SVG を直接埋め込むか
  `<Icon name="..." />` パターンにする (アイコンアセットの自動生成はイテレーション 1 では対象外)。
- Badge をフィルター選択肢に使わない → `<button>` トグル。
- 固定幅 input は `flex-1 min-w-0`。

## screens.yaml へのマッピング

各画面の `components` には、その画面が実際に import する UI + Domain コンポーネント名を列挙する。
`validateScreens.js --app <dir>` が各名の実装ファイル (`<name>.tsx`) の実在を検査する。
RDRA に無い画面を追加しない (整合性ルール)。追加提案はレビュー要約に記す。
