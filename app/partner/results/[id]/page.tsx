"use client";

// =====================================================================
// パートナー用 診断結果ページ
// 顧客用と同じレポート（同じ計算・同じ所見）を表示する。
// 以前は旧方式のAI分析（ai_report）のCRIを表示していたが、
// 新しいレポートとの数字の食い違いをなくすため共通化した。
// =====================================================================

import { useParams } from "next/navigation";
import { ReportView } from "@/components/brandcheck/ReportView";

export default function PartnerResultPage() {
  const params = useParams<{ id: string }>();
  if (!params?.id) return null;
  return (
    <ReportView
      id={params.id}
      topSlot={
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-8">
          <a href="/partner/dashboard" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            ← ダッシュボードに戻る
          </a>
          <span className="text-xs tracking-wider text-slate-400">パートナー用表示</span>
        </div>
      }
    />
  );
}
