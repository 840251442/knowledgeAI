import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "KnowledgeAI",
  description: "AI 在线知识库（公开站 + 管理后台 + 混合搜索）",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
