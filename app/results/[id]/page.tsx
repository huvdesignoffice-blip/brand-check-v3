"use client";

// =====================================================================
// Brand Check v3 — 診断レポート（新構成・全10章）
// 本体は components/brandcheck/ReportView.tsx（パートナー用ページと共通）
// =====================================================================

import { useParams } from "next/navigation";
import { ReportView } from "@/components/brandcheck/ReportView";

export default function ResultsPage() {
  const params = useParams<{ id: string }>();
  if (!params?.id) return null;
  return <ReportView id={params.id} />;
}
