import { ErrorBanner } from "../../components/common/ErrorBanner";
import { LoadingSkeleton } from "../../components/common/LoadingSkeleton";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { actionsStyle, ChoiceGroup, Panel, responsiveGridStyle } from "./PageStoryParts";

export type EntityFormState = "default" | "validation" | "server" | "loading";

export function BookForm({ mode, state }: { mode: "register" | "edit"; state: EntityFormState }) {
  if (state === "loading") return <LoadingSkeleton variant="form" count={1} />;
  const isEdit = mode === "edit";
  return (
    <div style={{ display: "grid", gap: "var(--spacing-4)" }}>
      {state === "server" && (
        <ErrorBanner error={{ title: "保存できません", status: 500, detail: "サーバーで問題が発生しました。時間をおいて再度お試しください。" }} />
      )}
      <Panel title="基本情報" description="書誌情報を入力してください。">
        <div style={responsiveGridStyle}>
          <Input label="タイトル（必須）" defaultValue={isEdit ? "吾輩は猫である" : ""} error={state === "validation" ? "タイトルは必須です" : undefined} />
          <Input label="著者（必須）" defaultValue={isEdit ? "夏目漱石" : ""} />
          <Input label="ISBN（必須）" defaultValue={isEdit ? "978-4-10-101001-2" : ""} error={state === "validation" ? "ISBN-13形式で入力してください" : undefined} />
          <Input label="出版社（必須）" defaultValue={isEdit ? "新潮社" : ""} />
          <Input label="ジャンル（必須）" defaultValue={isEdit ? "文学" : ""} />
          <Input label="配架場所（必須）" defaultValue={isEdit ? "一般書架 A-12" : ""} hint="紙書籍を選択した場合に入力します" />
        </div>
        <ChoiceGroup label="資料種別" options={["紙書籍", "電子書籍"]} selected="紙書籍" />
      </Panel>
      <div style={actionsStyle}>
        <Button>{isEdit ? "更新する" : "登録する"}</Button>
        <Button variant="outline">キャンセル</Button>
      </div>
    </div>
  );
}

export function UserForm({ mode, state }: { mode: "register" | "edit"; state: EntityFormState }) {
  if (state === "loading") return <LoadingSkeleton variant="form" count={1} />;
  const isEdit = mode === "edit";
  return (
    <div style={{ display: "grid", gap: "var(--spacing-4)" }}>
      {state === "server" && (
        <ErrorBanner error={{ title: "保存できません", status: 500, detail: "利用者情報の保存に失敗しました。" }} />
      )}
      <Panel title="利用者情報" description="個人情報は業務上必要な範囲で取り扱ってください。">
        <div style={responsiveGridStyle}>
          <Input label="氏名（必須）" defaultValue={isEdit ? "田中太郎" : ""} error={state === "validation" ? "氏名は必須です" : undefined} />
          <Input label="利用者番号（必須）" defaultValue={isEdit ? "U-000184" : ""} readOnly={isEdit} />
          <Input label="メールアドレス（必須）" type="email" defaultValue={isEdit ? "t.tanaka@example.jp" : ""} error={state === "validation" ? "有効なメールアドレスを入力してください" : undefined} />
          <Input label="電話番号" type="tel" defaultValue={isEdit ? "090-0000-0000" : ""} />
          <Input label="住所" defaultValue={isEdit ? "東京都千代田区丸の内一丁目" : ""} />
          <Input label="有効期限" type="date" defaultValue={isEdit ? "2027-03-31" : "2027-03-31"} />
        </div>
        <ChoiceGroup label="利用者状態" options={["有効", "利用停止"]} selected="有効" />
      </Panel>
      <div style={actionsStyle}>
        <Button>{isEdit ? "更新する" : "登録する"}</Button>
        <Button variant="outline">キャンセル</Button>
      </div>
    </div>
  );
}
