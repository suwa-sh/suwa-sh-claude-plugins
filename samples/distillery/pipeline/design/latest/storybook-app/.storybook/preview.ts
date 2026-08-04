import type { Preview } from "@storybook/nextjs-vite";
import "../src/app/globals.css";

const preview: Preview = {
  initialGlobals: {
    portal: "user",
    theme: "light",
  },
  globalTypes: {
    portal: {
      description: "表示するポータル",
      toolbar: {
        icon: "user",
        items: [
          { value: "user", title: "利用者ポータル" },
          { value: "admin", title: "司書ポータル" },
        ],
        dynamicTitle: true,
      },
    },
    theme: {
      description: "カラーテーマ",
      toolbar: {
        icon: "paintbrush",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      disable: true,
    },
    layout: "fullscreen",
    a11y: {
      test: "todo",
    },
  },
  decorators: [
    (Story, context) => {
      const portal = context.globals.portal || "user";
      const theme = context.globals.theme || "light";

      document.documentElement.setAttribute("data-portal", portal);
      document.documentElement.classList.toggle("dark", theme === "dark");
      document.documentElement.classList.toggle("light", theme === "light");
      document.documentElement.style.colorScheme = theme;
      document.body.style.background = "var(--background)";
      document.body.style.color = "var(--foreground)";

      return Story();
    },
  ],
};

export default preview;
