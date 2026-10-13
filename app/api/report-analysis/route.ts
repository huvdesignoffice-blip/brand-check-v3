// =====================================================================
// GET /api/report-analysis?id=<survey_results.id>
// 結果ページ用のデータ（数値・判定・AI所見）を返します。
// - 数値と判定は毎回コードで計算（速い・ぶれない）
// - AI所見は survey_results.report_v4 にキャッシュ（SUPABASE_SERVICE_ROLE_KEY がある場合）
// - ステージ（1/2/3）に応じて、見せてよい範囲だけを返す（情報の出し惜しみをサーバー側で担保）
// =====================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { normalizeRow, type Row } from "@/lib/brandcheck/normalize";
import { computeMetrics } from "@/lib/brandcheck/analyze";
import { generateFindings, type AiFindings, type VisibleFindings } from "@/lib/brandcheck/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REPORT_VERSION = "v4.0"; // プロンプトや判定ルールを変えたら上げる（キャッシュが作り直される）

type CachedReport = {
  version: string;
  inputHash: string;
  generatedAt: string;
  model: string;
  findings: AiFindings;
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !(serviceKey || anonKey)) {
    throw new Error("Supabaseの環境変数（NEXT_PUBLIC_SUPABASE_URL と キー）が設定されていません");
  }
  return {
    client: createClient(url, (serviceKey || anonKey) as string, { auth: { persistSession: false } }),
    canWrite: Boolean(serviceKey),
  };
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id が必要です" }, { status: 400 });

  const adminPassword = process.env.ADMIN_PASSWORD;
  const forceRefresh =
    request.nextUrl.searchParams.get("refresh") === "1" &&
    !!adminPassword &&
    request.headers.get("x-admin-password") === adminPassword;

  try {
    const { client, canWrite } = getSupabase();

    const { data: row, error } = await client.from("survey_results").select("*").eq("id", id).single();
    if (error || !row) {
      return NextResponse.json({ error: "診断結果が見つかりません" }, { status: 404 });
    }

    const input = normalizeRow(row as Row);
    const metrics = computeMetrics(input);

    // ---- AI所見（キャッシュ優先） ----
    const inputHash = createHash("sha1")
      .update(
        JSON.stringify({
          v: REPORT_VERSION,
          s: input.scores,
          c: input.challenges.map((c) => c.id),
          u: input.unknownChallenges,
          o: input.otherChallengeText,
          p: input.philosophy,
          vi: input.vision,
          ph: input.businessPhase,
        })
      )
      .digest("hex");

    const cached = (row as Row).report_v4 as CachedReport | null | undefined;
    let findings: AiFindings | null = null;
    let aiError: string | null = null;

    if (!forceRefresh && cached && cached.version === REPORT_VERSION && cached.inputHash === inputHash && cached.findings) {
      findings = cached.findings;
    } else {
      try {
        const result = await generateFindings(input, metrics);
        findings = result.findings;
        if (canWrite) {
          const payload: CachedReport = {
            version: REPORT_VERSION,
            inputHash,
            generatedAt: new Date().toISOString(),
            model: result.model,
            findings,
          };
          const { error: updateError } = await client.from("survey_results").update({ report_v4: payload }).eq("id", id);
          if (updateError) console.error("[report-analysis] キャッシュ保存に失敗:", updateError.message);
        }
      } catch (e) {
        // APIクレジット切れなどでも、数値部分のレポートは表示できるようにする
        aiError = e instanceof Error ? e.message : "AI所見の生成に失敗しました";
        console.error("[report-analysis] AI所見の生成に失敗:", aiError);
      }
    }

    // ---- ステージに応じて返す範囲を絞る ----
    const visibleFindings = findings ? filterByStage(findings, input.stage) : null;

    if (input.warnings.length) console.warn("[report-analysis] カラムの確認:", input.warnings);

    return NextResponse.json({
      input: {
        id: input.id,
        companyName: input.companyName,
        respondentName: input.respondentName,
        industry: input.industry,
        businessPhase: input.businessPhase,
        revenueScale: input.revenueScale,
        philosophy: input.philosophy,
        vision: input.vision,
        scores: input.scores,
        challenges: input.challenges.map((c) => ({ label: c.label, category: c.category })),
        unknownChallenges: input.unknownChallenges,
        otherChallengeText: input.otherChallengeText,
        createdAt: input.createdAt,
        stage: input.stage,
      },
      metrics,
      findings: visibleFindings,
      aiStatus: findings ? "ok" : "unavailable",
      warnings: input.warnings,
      cacheEnabled: canWrite,
      ...(aiError && forceRefresh ? { aiError } : {}),
    });
  } catch (e) {
    console.error("[report-analysis] エラー:", e);
    return NextResponse.json({ error: "レポートの読み込みに失敗しました" }, { status: 500 });
  }
}

function filterByStage(f: AiFindings, stage: 1 | 2 | 3): VisibleFindings {
  const { improvementTitles, stage3, ...stage1 } = f;
  if (stage === 1) return stage1;
  if (stage === 2) return { ...stage1, improvementTitles };
  return { ...stage1, improvementTitles, stage3 };
}
