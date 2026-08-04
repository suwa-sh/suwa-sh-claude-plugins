export default function Home() {
  return (
    <main className="mx-auto grid min-h-screen max-w-5xl place-content-center gap-6 p-6 text-center">
      <img className="mx-auto h-16 w-auto" src="/assets/logo-full.svg" alt="LibraShelf" />
      <div className="grid gap-2">
        <h1 className="text-3xl font-bold">LibraShelf Design System</h1>
        <p style={{ color: "var(--muted-foreground)" }}>
          コンポーネントと画面仕様は Storybook で確認してください。
        </p>
      </div>
    </main>
  );
}
