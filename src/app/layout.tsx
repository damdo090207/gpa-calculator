import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "학점 계산기",
  description: "학기별 학점 관리와 과목별 필기",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
