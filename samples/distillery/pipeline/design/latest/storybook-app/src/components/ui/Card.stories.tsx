import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./Card";

const meta = {
  title: "UI/Card",
  component: Card,
  tags: ["autodocs"],
  args: { hoverable: false },
  render: (args) => (
    <Card {...args} style={{ maxWidth: "28rem" }}>
      <CardHeader>
        <CardTitle>吾輩は猫である</CardTitle>
        <CardDescription>夏目漱石・新潮文庫</CardDescription>
      </CardHeader>
      <CardContent>近代日本文学を代表する長編小説です。3階・文学コーナーに配架されています。</CardContent>
      <CardFooter>
        <Button size="sm">詳細を見る</Button>
      </CardFooter>
    </Card>
  ),
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Hoverable: Story = { args: { hoverable: true } };
