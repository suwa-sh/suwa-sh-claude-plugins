// packages/ui の部品 (AppShell 等) が import する静的アセットの型。Vite はアセットの URL 文字列を返す
declare module '*.svg' {
  const src: string;
  export default src;
}
