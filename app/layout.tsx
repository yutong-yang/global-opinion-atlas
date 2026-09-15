import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '全球媒体舆情图谱',
  description: 'TikTok 用户迁入小红书事件的全球媒体报道多层级可视分析',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
