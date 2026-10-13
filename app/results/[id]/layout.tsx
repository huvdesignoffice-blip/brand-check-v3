import type { Metadata } from "next";
import type { ReactNode } from "react";

// 結果ページのタブ名・印刷時ヘッダーを「Create Next App」から変更する
export const metadata: Metadata = {
  title: "BRAND CHECK 診断レポート｜HUV DESIGN OFFICE",
  robots: { index: false, follow: false }, // 個別の診断結果は検索エンジンに載せない
};

export default function ResultsLayout({ children }: { children: ReactNode }) {
  return children;
}
