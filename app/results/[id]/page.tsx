"use client";

// =====================================================================
// Brand Check v3 — 診断レポート（新構成・全10章）
// データは /api/report-analysis から取得します（数値はコードで計算、所見はAI）。
// ステージに応じた出し分けはサーバー側で行うため、STAGE1の画面には
// 改善提案のデータそのものが届きません。
// =====================================================================

import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import {
  BOOKING_URL,
  DOMAINS,
  NAVY,
  QUESTIONS,
  SIGNAL,
  avgColor,
  criColor,
  criLabel,
  qTitle,
  scoreColor,
  totalLabel,
} from "@/lib/brandcheck/constants";
import type { BrandCheckMetrics } from "@/lib/brandcheck/analyze";
import type { DomainFinding, VisibleFindings } from "@/lib/brandcheck/ai";

type ReportResponse = {
  input: {
    id: string;
    companyName: string;
    respondentName: string;
    industry: string;
    businessPhase: string;
    revenueScale: string;
    philosophy: string;
    vision: string;
    scores: number[];
    challenges: { label: string; category: string }[];
    unknownChallenges: string[];
    otherChallengeText: string;
    createdAt: string;
    stage: 1 | 2 | 3;
  };
  metrics: BrandCheckMetrics;
  findings: VisibleFindings | null;
  aiStatus: "ok" | "unavailable";
  warnings: string[];
};

// ---------------------------------------------------------------------
// 小さな部品
// ---------------------------------------------------------------------

function ScorePill({ score }: { score: number }) {
  const color = scoreColor(score);
  const bg = score <= 2 ? SIGNAL.redBg : score < 4 ? SIGNAL.yellowBg : SIGNAL.blueBg;
  return (
    <span
      className="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums"
      style={{ color, backgroundColor: bg }}
    >
      {score}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = scoreColor(score);
  return (
    <div className="flex gap-1" aria-label={`${score} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className="h-2.5 w-7 rounded-sm" style={{ backgroundColor: n <= score ? color : "#e5e7eb" }} />
      ))}
    </div>
  );
}

function QChip({ no, score }: { no: number; score: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
      <span className="font-semibold text-slate-500">Q{no}</span>
      {qTitle(no)}
      <ScorePill score={score} />
    </span>
  );
}

function Section({ no, title, children, breakBefore = false }: { no: string; title: string; children: ReactNode; breakBefore?: boolean }) {
  return (
    <section className={`report-section mb-10 ${breakBefore ? "print-break" : ""}`}>
      <div className="mb-4 flex items-baseline gap-3 border-b-2 pb-2" style={{ borderColor: NAVY }}>
        <span className="text-sm font-bold tracking-widest text-slate-400">{no}</span>
        <h2 className="text-xl font-bold" style={{ color: NAVY }}>
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function Finding({ label = "所見", text }: { label?: string; text?: string }) {
  if (!text) return null;
  return (
    <div className="avoid-break mt-4 rounded-lg border-l-4 bg-slate-50 px-5 py-4" style={{ borderColor: NAVY }}>
      <p className="mb-1 text-xs font-bold tracking-wider text-slate-500">{label}</p>
      <p className="whitespace-pre-wrap leading-relaxed text-slate-800">{text}</p>
    </div>
  );
}

function AiPending() {
  return (
    <p className="mt-4 rounded-lg bg-slate-50 px-5 py-4 text-sm text-slate-500">
      所見は現在準備中です。数値の結果は本ページのとおりで、所見は壁打ちセッションでも詳しくご説明します。
    </p>
  );
}

function MetricTile({ label, value, unit, color, note }: { label: string; value: string; unit?: string; color: string; note?: string }) {
  return (
    <div className="avoid-break rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-bold tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums" style={{ color }}>
        {value}
        {unit && <span className="ml-1 text-base font-medium text-slate-400">{unit}</span>}
      </p>
      {note && <p className="mt-2 text-xs leading-relaxed text-slate-600">{note}</p>}
    </div>
  );
}

function DomainFindingBlock({ f }: { f?: DomainFinding }) {
  if (!f) return <AiPending />;
  return (
    <dl className="mt-4 grid gap-3">
      {[
        { k: "状態", v: f.state },
        { k: "根拠", v: f.evidence },
        { k: "このままの場合に起こりうること", v: f.ifUnchanged },
      ].map((row) => (
        <div key={row.k} className="avoid-break rounded-lg bg-slate-50 px-5 py-3">
          <dt className="text-xs font-bold tracking-wider text-slate-500">{row.k}</dt>
          <dd className="mt-1 leading-relaxed text-slate-800">{row.v}</dd>
        </div>
      ))}
    </dl>
  );
}

// レーダーチャートの軸ラベル（2行表示）
function RadarTick(props: { x?: number | string; y?: number | string; payload?: { value: string }; textAnchor?: string }) {
  const { x = 0, y = 0, payload, textAnchor = "middle" } = props;
  const value = payload?.value ?? "";
  const [no, ...rest] = value.split(" ");
  const anchor = textAnchor as "start" | "middle" | "end";
  return (
    <g>
      <text x={Number(x)} y={Number(y)} textAnchor={anchor} fontSize={12} fill="#64748b" fontWeight={700}>
        {no}
      </text>
      <text x={Number(x)} y={Number(y) + 15} textAnchor={anchor} fontSize={12} fill="#1e293b">
        {rest.join(" ")}
      </text>
    </g>
  );
}

const DOMAIN_LABEL: Record<string, string> = Object.fromEntries(DOMAINS.map((d) => [d.key, d.label]));

function formatDate(s: string) {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
}

// ---------------------------------------------------------------------
// 本体
// ---------------------------------------------------------------------

export default function ResultsPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [data, setData] = useState<ReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/report-analysis?id=${encodeURIComponent(id)}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "読み込みに失敗しました");
        if (!cancelled) {
          setData(json as ReportResponse);
          if (json.warnings?.length) console.warn("[Brand Check] カラムの確認:", json.warnings);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "読み込みに失敗しました");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-4">
        <p className="text-slate-600">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-4 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200" style={{ borderTopColor: NAVY }} />
        <p className="font-medium" style={{ color: NAVY }}>
          診断レポートを作成しています
        </p>
        <p className="text-sm text-slate-500">初回の表示は30秒ほどかかることがあります</p>
      </main>
    );
  }

  const { input, metrics: m, findings: f } = data;
  const radarData = QUESTIONS.map((q) => ({
    axis: `Q${q.no} ${q.title}`,
    score: input.scores[q.no - 1],
    effective: m.flow[q.no - 1].effective,
  }));
  const showPhilosophyVision = m.philosophyVision.hasPhilosophy || m.philosophyVision.hasVision;

  return (
    <main className="min-h-screen bg-white text-slate-800">
      <style>{PRINT_CSS}</style>

      {/* ヘッダー */}
      <header className="report-header px-4 py-10 text-white sm:px-8" style={{ backgroundColor: NAVY }}>
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-bold tracking-[0.25em] text-blue-200">BRAND CHECK — ASSESSMENT REPORT</p>
          <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">{input.companyName || "—"} 御中</h1>
              <p className="mt-2 text-blue-100">
                {input.respondentName ? `${input.respondentName} 様` : ""}
                {input.createdAt ? `　${formatDate(input.createdAt)}` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-blue-200">総合スコア</p>
              <p className="text-5xl font-bold tabular-nums">
                {m.totalAvg.toFixed(1)}
                <span className="ml-1 text-lg font-medium text-blue-200">/ 5.0</span>
              </p>
              <p className="mt-1 text-sm text-blue-100">{totalLabel(m.totalAvg)}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-8">
        {/* 基本情報（章番号なし） */}
        <section className="report-section avoid-break mb-10 rounded-xl border border-slate-200 p-6">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            {[
              { k: "業種", v: input.industry },
              { k: "事業フェーズ", v: input.businessPhase },
              { k: "売上規模", v: input.revenueScale },
              { k: "回答日", v: formatDate(input.createdAt) },
            ].map((x) => (
              <div key={x.k}>
                <dt className="text-xs text-slate-500">{x.k}</dt>
                <dd className="font-medium">{x.v || "—"}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500">企業理念</p>
              <p className="mt-1 leading-relaxed">{input.philosophy || "（未入力）"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">3〜5年後のビジョン</p>
              <p className="mt-1 leading-relaxed">{input.vision || "（未入力）"}</p>
            </div>
          </div>
          {(input.challenges.length > 0 || input.otherChallengeText) && (
            <div className="mt-5 border-t border-slate-100 pt-5">
              <p className="text-xs text-slate-500">現在の課題</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {input.challenges.map((c) => (
                  <span key={c.label} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                    {c.label}
                  </span>
                ))}
                {input.unknownChallenges.map((c) => (
                  <span key={c} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                    {c}
                  </span>
                ))}
              </div>
              {input.otherChallengeText && <p className="mt-2 text-sm text-slate-700">その他：{input.otherChallengeText}</p>}
            </div>
          )}
        </section>

        {/* 01 総評 */}
        <Section no="01" title="総評">
          {f ? <p className="whitespace-pre-wrap text-[15px] leading-loose text-slate-800">{f.overall}</p> : <AiPending />}
        </Section>

        {/* 02 主要指標 */}
        <Section no="02" title="主要指標">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile label="総合スコア（自己評価）" value={m.totalAvg.toFixed(1)} unit="/ 5.0" color={avgColor(m.totalAvg)} note={totalLabel(m.totalAvg)} />
            <MetricTile
              label="実効スコア"
              value={m.effectiveAvg.toFixed(1)}
              unit="/ 5.0"
              color={avgColor(m.effectiveAvg)}
              note="上流（戦略）の裏付けがある範囲で見た評価"
            />
            <MetricTile label="CRI（矛盾リスク指数）" value={m.cri.toFixed(1)} unit="/ 10" color={criColor(m.cri)} note={criLabel(m.cri)} />
            <MetricTile
              label="上流の裏付けが未確認の設問"
              value={String(m.overreachItems.length)}
              unit="/ 11問"
              color={m.overreachItems.length === 0 ? SIGNAL.blue : m.overreachItems.length <= 3 ? SIGNAL.yellow : SIGNAL.red}
              note="自己評価が、上流の設問の評価を上回っている設問"
            />
          </div>
          <div className="avoid-break mt-4 rounded-lg border border-slate-200 px-5 py-4">
            <p className="text-xs font-bold tracking-wider text-slate-500">流れが止まっている地点</p>
            {m.bottleneck ? (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <QChip no={m.bottleneck.no} score={m.bottleneck.score} />
                <span className="text-sm text-slate-600">上流から見て、最初に3点以下となっている設問です。これより下流は、この地点の影響を受けている可能性があります。</span>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600">すべての設問が4点以上で、流れが止まっている地点は見られません。</p>
            )}
          </div>
        </Section>

        {/* 03 3領域のスコア */}
        <Section no="03" title="3領域のスコア" breakBefore>
          <div className="avoid-break rounded-xl border border-slate-200 p-4">
            <div style={{ width: "100%", height: 420 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="68%">
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="axis" tick={<RadarTick />} />
                  <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={{ fontSize: 11, fill: "#94a3b8" }} angle={90} />
                  <Radar name="自己評価" dataKey="score" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.08} strokeWidth={2} strokeDasharray="5 4" isAnimationActive={false} />
                  <Radar name="実効スコア" dataKey="effective" stroke={NAVY} fill={NAVY} fillOpacity={0.22} strokeWidth={2} isAnimationActive={false} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-slate-600">
              <span className="flex items-center gap-2">
                <span className="inline-block h-0 w-6 border-t-2 border-dashed" style={{ borderColor: "#94a3b8" }} />
                自己評価
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-6 rounded-sm" style={{ backgroundColor: NAVY, opacity: 0.6 }} />
                実効スコア（上流の裏付けがある範囲）
              </span>
            </div>
            <p className="mt-1 text-center text-xs text-slate-500">Q1→Q12 は上流（戦略）から下流（手段と成果）への一本の流れです。2つの線の差が、上流の裏付けが確認できていない部分です</p>
          </div>

          <table className="avoid-break mt-6 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-4 font-semibold">領域</th>
                <th className="py-2 pr-4 font-semibold">自己評価</th>
                <th className="py-2 pr-4 font-semibold">実効</th>
                <th className="py-2 font-semibold">設問別スコア</th>
              </tr>
            </thead>
            <tbody>
              {m.domainAvgs.map((d) => (
                <tr key={d.key} className="border-b border-slate-100 align-top">
                  <td className="py-3 pr-4 font-semibold" style={{ color: NAVY }}>
                    {d.label}
                  </td>
                  <td className="py-3 pr-4 text-lg font-bold tabular-nums" style={{ color: avgColor(d.avg) }}>
                    {d.avg.toFixed(1)}
                  </td>
                  <td className="py-3 pr-4 text-lg font-bold tabular-nums" style={{ color: avgColor(d.effectiveAvg) }}>
                    {d.effectiveAvg.toFixed(1)}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {d.questions.map((no) => (
                        <QChip key={no} no={no} score={input.scores[no - 1]} />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {f ? <Finding text={f.domainSummary} /> : <AiPending />}
        </Section>

        {/* 04 領域別の所見 */}
        <Section no="04" title="領域別の所見">
          {DOMAINS.map((d) => {
            const avg = m.domainAvgs.find((x) => x.key === d.key)?.avg ?? 0;
            return (
              <div key={d.key} className="mb-8">
                <div className="mb-3 flex items-baseline justify-between">
                  <h3 className="text-lg font-bold" style={{ color: NAVY }}>
                    {d.label}
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      Q{d.questions[0]}〜Q{d.questions[d.questions.length - 1]}
                    </span>
                  </h3>
                  <span className="text-lg font-bold tabular-nums" style={{ color: avgColor(avg) }}>
                    {avg.toFixed(1)}
                  </span>
                </div>
                <div className="avoid-break divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {d.questions.map((no) => (
                    <div key={no} className="flex items-center justify-between gap-4 px-4 py-2.5">
                      <span className="text-sm">
                        <span className="mr-2 font-semibold text-slate-400">Q{no}</span>
                        {qTitle(no)}
                      </span>
                      <span className="flex items-center gap-3">
                        {m.flow[no - 1].overreach > 0 && (
                          <span className="hidden text-xs text-slate-500 sm:inline">実効 {m.flow[no - 1].effective}</span>
                        )}
                        <ScoreBar score={input.scores[no - 1]} />
                        <span className="w-8 text-right text-sm font-bold tabular-nums" style={{ color: scoreColor(input.scores[no - 1]) }}>
                          {input.scores[no - 1]}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
                <DomainFindingBlock f={f?.domains[d.key]} />
              </div>
            );
          })}
        </Section>

        {/* 05 一貫性（上流 → 下流の流れ） */}
        <Section no="05" title="一貫性（上流 → 下流の流れ）" breakBefore>
          <p className="mb-4 text-sm leading-relaxed text-slate-600">
            Q1からQ12を、上流（戦略）から下流（手段と成果）への一本の流れとして見ています。上流が整っている範囲までしか下流は機能しにくいため、上流の評価を上回っている部分を「上流の裏付けが未確認」として示しています。
          </p>
          <ol className="avoid-break overflow-hidden rounded-lg border border-slate-200">
            {m.flow.map((step, i) => {
              const isBottleneck = m.bottleneck?.no === step.no;
              const domainStart = i === 0 || m.flow[i - 1].domain !== step.domain;
              return (
                <li key={step.no}>
                  {domainStart && (
                    <div className="bg-slate-50 px-4 py-1.5 text-xs font-bold tracking-wider" style={{ color: NAVY }}>
                      {DOMAIN_LABEL[step.domain]}
                      <span className="ml-2 font-normal text-slate-500">{step.domain === "execution" ? "手段と成果" : "戦略"}</span>
                    </div>
                  )}
                  <div
                    className="flex flex-col gap-2 border-t border-slate-100 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                    style={isBottleneck ? { backgroundColor: SIGNAL.yellowBg } : undefined}
                  >
                    <span className="text-sm">
                      <span className="mr-2 font-semibold text-slate-400">Q{step.no}</span>
                      {qTitle(step.no)}
                      {isBottleneck && (
                        <span className="ml-2 rounded px-1.5 py-0.5 text-xs font-bold" style={{ color: SIGNAL.yellow, border: `1px solid ${SIGNAL.yellow}` }}>
                          流れが止まっている地点
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">
                        自己評価 <span className="font-bold tabular-nums" style={{ color: scoreColor(step.score) }}>{step.score}</span>
                      </span>
                      <span className="text-slate-300">→</span>
                      <span className="text-xs text-slate-500">
                        実効 <span className="font-bold tabular-nums" style={{ color: scoreColor(step.effective) }}>{step.effective}</span>
                      </span>
                      <span className="w-28 text-right text-xs text-slate-500">{step.overreach > 0 ? `裏付け未確認 +${step.overreach}` : ""}</span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="avoid-break mt-6">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>CRI（矛盾リスク指数）</span>
              <span className="font-bold tabular-nums" style={{ color: criColor(m.cri) }}>
                {m.cri.toFixed(1)} / 10
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${(m.cri / 10) * 100}%`, backgroundColor: criColor(m.cri) }} />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              上流の裏付けを超えている点数の合計（{m.overreachTotal}点）をもとにした指数です。数値が高いほど、上流と下流の食い違いが大きいことを示します
            </p>
          </div>

          {m.unconfirmedHighs.length > 0 && (
            <div className="avoid-break mt-5 rounded-lg border border-slate-200 px-4 py-3">
              <p className="mb-2 text-sm text-slate-600">自己評価は4点以上ですが、上流の裏付けが確認できていない設問</p>
              <div className="flex flex-wrap gap-1.5">
                {m.unconfirmedHighs.map((no) => (
                  <QChip key={no} no={no} score={input.scores[no - 1]} />
                ))}
              </div>
            </div>
          )}
          {f ? <Finding text={f.consistency} /> : <AiPending />}
        </Section>

        {/* 06 自己評価と課題認識のずれ */}
        <Section no="06" title="自己評価と課題認識のずれ">
          {input.challenges.length === 0 ? (
            <p className="text-sm text-slate-600">現在の課題にチェックがなかったため、この照合は行っていません。</p>
          ) : m.perceptionGaps.length === 0 ? (
            <p className="text-sm text-slate-600">チェックされた課題と、関連する設問の自己評価の間に、大きなずれは見られませんでした。</p>
          ) : (
            <table className="avoid-break w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-2 pr-4 font-semibold">課題として挙げた項目</th>
                  <th className="py-2 pr-4 font-semibold">関連する設問の自己評価</th>
                  <th className="py-2 font-semibold">実効</th>
                </tr>
              </thead>
              <tbody>
                {m.perceptionGaps.map((g) => (
                  <tr key={`${g.challengeLabel}-${g.question}`} className="border-b border-slate-100">
                    <td className="py-3 pr-4">{g.challengeLabel}</td>
                    <td className="py-3 pr-4">
                      <QChip no={g.question} score={g.score} />
                    </td>
                    <td className="py-3 font-bold tabular-nums" style={{ color: scoreColor(g.effective) }}>
                      {g.effective}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {input.challenges.length > 0 && (f ? <Finding text={f.perceptionGap} /> : <AiPending />)}
        </Section>

        {/* 07 理念・ビジョンとの照合 */}
        <Section no="07" title="理念・ビジョンとの照合">
          {!showPhilosophyVision ? (
            <p className="text-sm text-slate-600">
              企業理念・ビジョンが未入力のため、この照合は行っていません。壁打ちセッションでお伺いした内容をもとに、照合することができます。
            </p>
          ) : (
            <>
              <ul className="space-y-2">
                {m.philosophyVision.points.map((p) => (
                  <li key={p.label} className="avoid-break flex flex-col gap-2 rounded-lg border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: NAVY }}>
                        {p.label}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-600">{p.observation}</p>
                    </div>
                    <QChip no={p.question} score={p.score} />
                  </li>
                ))}
              </ul>
              {f ? <Finding text={f.philosophyVision} /> : <AiPending />}
            </>
          )}
        </Section>

        {/* 08 課題とのつながり */}
        <Section no="08" title="課題とのつながり" breakBefore>
          {m.challengeLinks.length === 0 ? (
            <p className="text-sm text-slate-600">現在の課題にチェックがなかったため、この照合は行っていません。</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-slate-600">
                チェックされた課題の多くは、下流（手段と成果）で表れます。それぞれの課題に直接関係する設問と、そこから流れをさかのぼったときに3点以下となっている上流の設問を示しています。
              </p>
              <div className="space-y-3">
                {m.challengeLinks.map((l) => (
                  <div key={l.challengeLabel} className="avoid-break rounded-lg border border-slate-200 px-4 py-3">
                    <p className="font-semibold" style={{ color: NAVY }}>
                      {l.challengeLabel}
                      <span className="ml-2 text-xs font-normal text-slate-500">{l.category}</span>
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-[4rem_1fr]">
                      <span className="text-xs text-slate-500 sm:pt-1.5">直接</span>
                      <div className="flex flex-wrap gap-1.5">
                        {l.direct.map((d) => (
                          <QChip key={d.no} no={d.no} score={d.score} />
                        ))}
                      </div>
                      {l.weakUpstream.length > 0 && (
                        <>
                          <span className="text-xs text-slate-500 sm:pt-1.5">上流</span>
                          <div className="flex flex-wrap gap-1.5">
                            {l.weakUpstream.map((d) => (
                              <QChip key={d.no} no={d.no} score={d.score} />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {f ? <Finding text={f.challengeLinks} /> : <AiPending />}
            </>
          )}
        </Section>

        {/* STAGE2：改善の方向性（タイトルのみ） */}
        {input.stage >= 2 && f?.improvementTitles && f.improvementTitles.length > 0 && (
          <Section no="—" title="改善の方向性" breakBefore>
            <ol className="space-y-2">
              {f.improvementTitles.map((t, i) => (
                <li key={t} className="avoid-break flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: NAVY }}>
                    {i + 1}
                  </span>
                  <span className="font-medium">{t}</span>
                </li>
              ))}
            </ol>
            {input.stage === 2 && (
              <p className="mt-3 text-sm text-slate-600">
                それぞれの具体的な進め方は、ブランド診断パッケージ（150,000円）で、貴社の状況に合わせて設計します。
              </p>
            )}
          </Section>
        )}

        {/* STAGE3：完全版 */}
        {input.stage === 3 && f?.stage3 && (
          <Section no="—" title="改善の詳細とアクションプラン">
            <div className="space-y-4">
              {f.stage3.improvements.map((imp, i) => (
                <div key={imp.title} className="avoid-break rounded-lg border border-slate-200 p-5">
                  <p className="font-bold" style={{ color: NAVY }}>
                    {i + 1}. {imp.title}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap leading-relaxed text-slate-800">{imp.detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { k: "〜3ヶ月", v: f.stage3.actionPlan.months3 },
                { k: "3〜6ヶ月", v: f.stage3.actionPlan.months6 },
                { k: "6ヶ月〜1年", v: f.stage3.actionPlan.year1 },
              ].map((p) => (
                <div key={p.k} className="avoid-break rounded-lg bg-slate-50 p-4">
                  <p className="text-xs font-bold tracking-wider" style={{ color: NAVY }}>
                    {p.k}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">{p.v}</p>
                </div>
              ))}
            </div>
            <Finding label={`事業フェーズ（${input.businessPhase || "—"}）に即したアドバイス`} text={f.stage3.phaseAdvice} />
            <Finding label="総合評価" text={f.stage3.overallAssessment} />
          </Section>
        )}

        {/* 09 次のステップ */}
        <Section no="09" title="次のステップ">
          <div className="avoid-break rounded-xl border p-6" style={{ borderColor: "#bfdbfe", backgroundColor: SIGNAL.blueBg }}>
            {input.stage === 1 && (
              <p className="leading-relaxed text-slate-800">
                本レポートの内容は、無料の壁打ちセッション（オンライン）で、担当者が詳しくご説明します。数値の背景にある貴社の状況を伺いながら、優先して整理すべき点を一緒に確認します。
              </p>
            )}
            {input.stage === 2 && (
              <p className="leading-relaxed text-slate-800">
                改善の方向性それぞれについて、具体的な進め方を設計するのがブランド診断パッケージです。内容や進め方についてのご相談は、以下からご予約いただけます。
              </p>
            )}
            {input.stage === 3 && (
              <p className="leading-relaxed text-slate-800">アクションプランの進め方や、途中での見直しについてのご相談は、以下からご予約いただけます。</p>
            )}
            <a
              href={BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="no-print mt-5 inline-block rounded-lg px-6 py-3 font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: SIGNAL.blue }}
            >
              {input.stage === 1 ? "無料壁打ちセッションを予約する" : "相談の日程を予約する"}
            </a>
            <p className="print-only mt-4 text-sm text-slate-700">ご予約：{BOOKING_URL}</p>
          </div>
        </Section>

        {/* 10 診断の前提と読み方 */}
        <Section no="10" title="診断の前提と読み方">
          <dl className="space-y-4 text-sm leading-relaxed text-slate-700">
            <div>
              <dt className="font-semibold" style={{ color: NAVY }}>
                この診断について
              </dt>
              <dd className="mt-1">
                12の設問へのご回答（自己評価）をもとにした簡易診断です。第三者による調査や顧客の声を反映したものではないため、実際の状態とは異なる可能性があります。数値は「現状を確認するための手がかり」としてお読みください。
              </dd>
            </div>
            <div>
              <dt className="font-semibold" style={{ color: NAVY }}>
                色の意味
              </dt>
              <dd className="mt-1">
                設問のスコアは、1〜2点を
                <span className="font-bold" style={{ color: SIGNAL.red }}>
                  赤
                </span>
                、3点を
                <span className="font-bold" style={{ color: SIGNAL.yellow }}>
                  黄
                </span>
                、4〜5点を
                <span className="font-bold" style={{ color: SIGNAL.blue }}>
                  青
                </span>
                で示しています。領域の平均は、2.5未満を赤、3.5未満を黄、3.5以上を青としています。
              </dd>
            </div>
            <div>
              <dt className="font-semibold" style={{ color: NAVY }}>
                3つの領域
              </dt>
              <dd className="mt-1">
                一本の流れを、ブランド基盤（Q1〜3）、戦略設計（Q4〜7）、実行・浸透（Q8〜12）の3つの区間に分けて示しています。
              </dd>
            </div>
            <div>
              <dt className="font-semibold" style={{ color: NAVY }}>
                上流から下流への流れと実効スコア
              </dt>
              <dd className="mt-1">
                Q1からQ12を、上流（戦略：Q1〜Q7）から下流（手段と成果：Q8〜Q12）への一本の流れとして見ています。上流が整っている範囲までしか下流は機能しにくいという考え方から、各設問の「実効スコア」を、自己評価と、ひとつ上流の設問の実効スコアのうち低いほうとしています。自己評価が実効スコアを上回る部分を「上流の裏付けが未確認」としています。
              </dd>
            </div>
            <div>
              <dt className="font-semibold" style={{ color: NAVY }}>
                流れが止まっている地点・確定した強み
              </dt>
              <dd className="mt-1">
                上流から見て、最初に3点以下となっている設問を「流れが止まっている地点」としています。実効スコアが4点以上の設問（自分も、それより上流もすべて4点以上）だけを「確定した強み」としています。
              </dd>
            </div>
            <div>
              <dt className="font-semibold" style={{ color: NAVY }}>
                CRI（矛盾リスク指数）
              </dt>
              <dd className="mt-1">
                上流の裏付けを超えている点数（自己評価 − 実効スコア）をQ2〜Q12で合計し、起こりうる最大値（44点）に対する割合を0〜10で示しています。数値が高いほど上流と下流の食い違いが大きいことを示し、2.0未満を青、2.0〜4.9を黄、5.0以上を赤としています。
              </dd>
            </div>
            <div>
              <dt className="font-semibold" style={{ color: NAVY }}>
                自己評価と課題認識のずれ
              </dt>
              <dd className="mt-1">
                現在の課題としてチェックされた項目と、それに直接関係する設問の自己評価を照合し、課題に挙げつつ4点以上と評価されている場合を数えています。どちらが正しいかを判断するものではなく、壁打ちで確認したい点として示しています。
              </dd>
            </div>
            <div>
              <dt className="font-semibold" style={{ color: NAVY }}>
                所見について
              </dt>
              <dd className="mt-1">
                所見の文章は、上記の数値と判定をもとにAIを用いて作成し、表現を当社の基準に沿って整えています。「起こりうること」は可能性を示したもので、将来を断定するものではありません。
              </dd>
            </div>
          </dl>
        </Section>

        <div className="no-print mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-slate-300 px-5 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            印刷・PDFで保存
          </button>
        </div>

        <footer className="mt-10 border-t border-slate-200 pt-6 text-center text-xs text-slate-500">© {new Date().getFullYear()} 株式会社HUV DESIGN OFFICE</footer>
      </div>
    </main>
  );
}

const PRINT_CSS = `
.print-only { display: none; }
@media print {
  @page { size: A4; margin: 14mm 12mm; }
  html, body { background: #ffffff !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-print { display: none !important; }
  .print-only { display: block !important; }
  .report-header { padding-top: 24px !important; padding-bottom: 24px !important; }
  .print-break { break-before: page; page-break-before: always; }
  .avoid-break { break-inside: avoid; page-break-inside: avoid; }
  .report-section h2 { break-after: avoid; page-break-after: avoid; }
  .report-section { margin-bottom: 24px !important; }
}
`;
