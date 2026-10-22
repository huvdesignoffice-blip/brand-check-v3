import type { Metadata } from "next";
import type { ReactNode } from "react";

// ブラウザのタブ名を「Create Next App」から変更する
export const metadata: Metadata = {
  title: "ブランドチェック診断｜HUV DESIGN OFFICE",
  description: "12の設問で、ブランドの戦略から手段と成果までの流れを確認する診断です。",
};

export default function SurveyLayout({ children }: { children: ReactNode }) {
  return children;
}
