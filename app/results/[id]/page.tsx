'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createBrowserClient } from "@supabase/ssr";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

// ── 型定義 ──────────────────────────────────────────
type CRIPair = {
  upstream: string;
  downstream: string;
  score: number;
  risk: string;
};

type CRIResult = {
  cri: number;
  level: string;
  pairs: CRIPair[];
};

type AIReport = {
  overallComment: string;
  contradictionsAndRisks: string[];
  improvementRecommendations: string[];
  actionPlan3Months: string[];
  actionPlan6Months: string[];
  actionPlan1Year: string[];
  phaseAdvice: string;
  cri?: CRIResult;
};

interface SurveyResult {
  id: string;
  created_at: string;
  company_name: string;
  respondent_name: string;
  respondent_email: string;
  industry: string;
  business_phase: string;
  memo: string;
  mission: string;
  vision_future: string;
  challenges: string[];
  other_challenge: string | null;
  consultation_memo: string | null;
  q1_target_insight: number;
  q2_brand_story: number;
  q3_brand_personality: number;
  q4_competitive_analysis: number;
  q5_self_analysis: number;
  q6_value_proposition: number;
  q7_uniqueness: number;
  q8_product_uniqueness: number;
  q9_communication: number;
  q10_inner_branding: number;
  q11_kpi: number;
  q12_guideline: number;
  avg_score: number;
  revenue_scale: string;
  ai_report: AIReport | null;
  stage2_unlocked?: boolean;
  stage3_unlocked?: boolean;
}

const QUESTIONS = [
  { id: 'q1_target_insight',       label: 'ターゲット理解',          layer: 'ブランド基盤' },
  { id: 'q2_brand_story',          label: 'ブランドストーリー／WHY',  layer: 'ブランド基盤' },
  { id: 'q3_brand_personality',    label: 'ブランドパーソナリティ',   layer: 'ブランド基盤' },
  { id: 'q4_competitive_analysis', label: '競合分析',                 layer: '戦略設計' },
  { id: 'q5_self_analysis',        label: '自社分析',                 layer: '戦略設計' },
  { id: 'q6_value_proposition',    label: '価値提案',                 layer: '戦略設計' },
  { id: 'q7_uniqueness',           label: '独自性',                   layer: '戦略設計' },
  { id: 'q8_product_uniqueness',   label: '商品・サービス独自性反映', layer: '実行・浸透' },
  { id: 'q9_communication',        label: 'コミュニケーション一貫性', layer: '実行・浸透' },
  { id: 'q10_inner_branding',      label: 'インナーブランディング',   layer: '実行・浸透' },
  { id: 'q11_kpi',                 label: 'KPI設定と成果確認',        layer: '実行・浸透' },
  { id: 'q12_guideline',           label: 'ブランドガイドライン整備', layer: '実行・浸透' },
];

const LAYER_STYLE: Record<string, string> = {
  'ブランド基盤': 'bg-stone-100 text-stone-600',
  '戦略設計':     'bg-slate-100 text-slate-600',
  '実行・浸透':   'bg-zinc-100 text-zinc-600',
};

export default function ResultPage() {
  const params = useParams();
  const [result, setResult] = useState<SurveyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedReport, setEditedReport] = useState<AIReport | null>(null);
  const [consultationMemo, setConsultationMemo] = useState('');
  const [stage2Unlocked, setStage2Unlocked] = useState(false);
  const [stage3Unlocked, setStage3Unlocked] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    if (!params.id) return;
    (async () => {
      const { data, error } = await supabase
        .from('survey_results')
        .select('*')
        .eq('id', params.id)
        .single();
      if (!error && data) {
        setResult(data);
        setConsultationMemo(data.consultation_memo || '');
        setStage2Unlocked(data.stage2_unlocked === true);
        setStage3Unlocked(data.stage3_unlocked === true);
        fetch('/api/admin/auth').then(res => { if (res.ok) { setIsAdmin(true); } }).catch(() => {});
        if (!data.ai_report) await generateAIReport(data);
      }
      setLoading(false);
    })();
  }, [params.id]);

  async function generateAIReport(data: SurveyResult) {
    try {
      setGeneratingAI(true);
      const res = await fetch('/api/analyze-with-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scores: QUESTIONS.map(q => (data as any)[q.id]),
          memo: data.memo,
          vision: data.vision_future,
          challenges: data.challenges?.join('、'),
          consultationMemo: data.consultation_memo,
          businessPhase: data.business_phase,
          companyName: data.company_name,
        }),
      });
      if (!res.ok) throw new Error('AI分析に失敗しました');
      const aiReport = await res.json();
      await supabase.from('survey_results').update({ ai_report: aiReport }).eq('id', data.id);
      setResult(prev => prev ? { ...prev, ai_report: aiReport } : null);
    } catch (err) {
      alert('AI分析エラー: ' + (err as Error).message);
    } finally {
      setGeneratingAI(false);
    }
  }

  function handleEdit() {
    if (result?.ai_report) {
      setEditedReport(JSON.parse(JSON.stringify(result.ai_report)));
      setEditMode(true);
    }
  }

  function handleCancelEdit() {
    setEditedReport(null);
    setEditMode(false);
  }

  async function handleSaveEdit() {
    if (!editedReport || !result) return;
    try {
      await supabase.from('survey_results')
        .update({ ai_report: editedReport, consultation_memo: consultationMemo })
        .eq('id', result.id);
      setResult({ ...result, ai_report: editedReport, consultation_memo: consultationMemo });
      setEditMode(false);
      setEditedReport(null);
      alert('保存しました');
    } catch (err) {
      alert('保存エラー: ' + (err as Error).message);
    }
  }

  function updateField(field: keyof AIReport, value: any) {
    if (editedReport) setEditedReport({ ...editedReport, [field]: value });
  }

  function updateArrayField(field: keyof AIReport, index: number, value: string) {
    if (editedReport && Array.isArray(editedReport[field])) {
      const arr = [...(editedReport[field] as string[])];
      arr[index] = value;
      setEditedReport({ ...editedReport, [field]: arr });
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-base text-gray-400">読み込み中...</div>
    </div>
  );

  if (!result) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <p className="text-gray-400 text-sm">指定されたIDのデータが存在しません。</p>
      </div>
    </div>
  );

  const scores = QUESTIONS.map(q => (result as any)[q.id] as number);
  const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  const chartData = QUESTIONS.map((q, i) => ({ category: q.label, score: scores[i] }));
  const criData = result.ai_report?.cri;
  const displayAnalysis = editMode && editedReport ? editedReport : result.ai_report;

  // セクション番号カウンター
  let sectionNum = 0;
  const nextNum = () => { sectionNum++; return sectionNum; };

  return (
    <>
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; background: white; }
          @page { margin: 1.2cm; }
        }
        .report-divider { border: none; border-top: 1px solid #e5e7eb; margin: 0; }
      `}</style>

      <div className="min-h-screen bg-gray-50 py-10 px-4 print:bg-white print:py-0">
        <div className="max-w-3xl mx-auto">

          {/* ── 管理者ボタン ── */}
          {isAdmin && (
            <div className="no-print mb-5 flex justify-end gap-2">
              {!editMode ? (
                <>
                  <button onClick={() => window.print()} className="px-4 py-1.5 bg-gray-700 hover:bg-gray-800 text-white rounded text-xs font-medium">PDF印刷</button>
                  <button onClick={handleEdit} disabled={!result.ai_report} className="px-4 py-1.5 bg-gray-700 hover:bg-gray-800 text-white rounded text-xs font-medium disabled:opacity-40">編集</button>
                  <button onClick={() => generateAIReport(result)} className="px-4 py-1.5 bg-gray-700 hover:bg-gray-800 text-white rounded text-xs font-medium">AI再生成</button>
                  <a href="/admin/brand-check" className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-medium inline-block">管理画面</a>
                </>
              ) : (
                <>
                  <button onClick={handleSaveEdit} className="px-4 py-1.5 bg-gray-800 text-white rounded text-xs font-medium">保存</button>
                  <button onClick={handleCancelEdit} className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded text-xs font-medium">キャンセル</button>
                </>
              )}
            </div>
          )}

          {/* ── メインカード ── */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden print:border-0 print:rounded-none print:shadow-none">

            {/* ヘッダー */}
            <div className="px-8 pt-8 pb-6" style={{background:"#0f2044"}}>
              <p className="text-xs tracking-widest uppercase mb-2" style={{color:"#7a9cc8"}}>Brand Check — Assessment Report</p>
              <h1 className="text-2xl font-medium mb-1" style={{color:"#ffffff"}}>{result.company_name}</h1>
              <p style={{color:"#a8c4e0",fontSize:"14px"}}>{result.respondent_name} 様　·　{new Date(result.created_at).toLocaleDateString('ja-JP')}
              </p>
            </div>

            {/* 総合スコア */}
            <div className="px-8 py-6 flex items-center gap-6 border-b-2" style={{background:"#0f2044",borderColor:"#1e3a6e"}}>
              <div className="flex-shrink-0 w-28 h-28 rounded-full border-2 flex flex-col items-center justify-center" style={{borderColor:"#3a6aae"}}>
                <span className="text-4xl font-medium leading-none" style={{color:"#ffffff"}}>{avgScore}</span>
                <span className="text-xs mt-0.5" style={{color:"#7a9cc8"}}>/ 5.0</span>
              </div>
              <div className="flex-1">
                <p style={{color:"#a8c4e0",fontSize:"16px",fontWeight:"500"}} className="mb-2">総合スコア</p>
                <div className="w-full h-3 rounded-full mb-3" style={{background:"#1e3a6e"}}>
                  <div className="h-3 rounded-full" style={{background: parseFloat(avgScore) <= 2 ? "#ef4444" : parseFloat(avgScore) <= 3 ? "#eab308" : "#2563eb", width: `${(parseFloat(avgScore) / 5) * 100}%`}} />
                </div>
                <p className="text-sm" style={{color:"#ffffff"}}>{parseFloat(avgScore) >= 4 ? 'ブランドの土台が整っています' :
                   parseFloat(avgScore) >= 3 ? '一部に整備の余地があります' :
                   parseFloat(avgScore) >= 2 ? 'ブランド基盤の整備から着手が必要な段階です' :
                   '優先的な基盤整備が求められます'}
                </p>
              </div>
            </div>

            {/* AI生成中 */}
            {generatingAI && (
              <div className="px-8 py-6 border-b border-gray-100 flex items-center gap-3">
                <div className="animate-spin rounded-full h-4 w-4 border-b border-gray-600"></div>
                <p className="text-sm text-gray-500">AI分析中...（10〜20秒お待ちください）</p>
              </div>
            )}

            {/* 01 基本情報 */}
            <div className="px-8 py-6 border-b border-gray-100">
              <p className="text-xs font-semibold mb-1" style={{color:"#2563eb"}}>{String(nextNum()).padStart(2, '0')}</p>
              <h2 className="text-base font-semibold mb-4" style={{color:"#0f2044"}}>基本情報</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: '企業名',       value: result.company_name },
                  { label: '回答者',       value: result.respondent_name },
                  { label: '業種',         value: result.industry || '未回答' },
                  { label: '事業フェーズ', value: result.business_phase },
                  { label: '売上規模',     value: result.revenue_scale || '未回答' },
                  { label: '回答日時',     value: new Date(result.created_at).toLocaleString('ja-JP') },
                ].map((item, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg px-3 py-2.5">
                    <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>
                    <p className="text-sm text-gray-800">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 02 企業理念 */}
            {result.mission && (
              <div className="px-8 py-6 border-b border-gray-100">
                <p className="text-xs font-semibold mb-1" style={{color:"#2563eb"}}>{String(nextNum()).padStart(2, '0')}</p>
                <h2 className="text-base font-semibold mb-3" style={{color:"#0f2044"}}>企業理念</h2>
                <p className="text-sm leading-relaxed border-l-2 pl-4 whitespace-pre-wrap" style={{color:"#1e293b",borderColor:"#2563eb"}}>{result.mission}</p>
              </div>
            )}

            {/* 03 ビジョン */}
            {result.vision_future && (
              <div className="px-8 py-6 border-b border-gray-100">
                <p className="text-xs font-semibold mb-1" style={{color:"#2563eb"}}>{String(nextNum()).padStart(2, '0')}</p>
                <h2 className="text-base font-semibold mb-3" style={{color:"#0f2044"}}>3〜5年後のビジョン</h2>
                <p className="text-sm leading-relaxed border-l-2 pl-4 whitespace-pre-wrap" style={{color:"#1e293b",borderColor:"#2563eb"}}>{result.vision_future}</p>
              </div>
            )}

            {/* 04 現在の課題 */}
            {result.challenges?.length > 0 && (
              <div className="px-8 py-6 border-b border-gray-100">
                <p className="text-xs font-semibold mb-1" style={{color:"#2563eb"}}>{String(nextNum()).padStart(2, '0')}</p>
                <h2 className="text-base font-semibold mb-3" style={{color:"#0f2044"}}>現在の課題</h2>
                <div className="flex flex-wrap gap-2 mb-3">
                  {result.challenges.map((c, i) => (
                    <span key={i} className="text-xs text-gray-600 bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-full">{c}</span>
                  ))}
                </div>
                {result.other_challenge && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-400 mb-1">その他</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{result.other_challenge}</p>
                  </div>
                )}
              </div>
            )}

            {/* 05 スコアシート */}
            <div className="px-8 py-6 border-b border-gray-100">
              <p className="text-xs font-semibold mb-1" style={{color:"#2563eb"}}>{String(nextNum()).padStart(2, '0')}</p>
              <h2 className="text-base font-semibold mb-1" style={{color:"#0f2044"}}>スコアシート</h2>
              <p className="text-xs text-gray-400 mb-4">設問1→12は時計回りの因果連鎖（ブランド基盤 → 戦略設計 → 実行・浸透）</p>

              {/* ヘッダー行 */}
              <div className="grid grid-cols-[1fr_auto_100px] gap-4 pb-2 border-b border-gray-100 mb-1">
                <p className="text-xs text-gray-400">設問</p>
                <p className="text-xs text-gray-400 text-right">スコア</p>
                <p className="text-xs text-gray-400">分布</p>
              </div>

              <div>
                {QUESTIONS.map((q, i) => {
                  const score = (result as any)[q.id] as number;
                  return (
                    <div key={q.id} className="grid grid-cols-[1fr_auto_100px] gap-4 items-center py-2.5 border-b border-gray-50 last:border-b-0">
                      <div>
                        <span className={`inline-block text-xs px-2 py-0.5 rounded mr-2 ${LAYER_STYLE[q.layer]}`}>Q{i+1}</span>
                        <span className="text-sm text-gray-700">{q.label}</span>
                      </div>
                      <div className="text-right">
                        {isAdmin && editMode ? (
                          <input type="number" min={1} max={5} value={score}
                            onChange={e => setResult(prev => prev ? {...prev, [q.id]: Number(e.target.value)} : null)}
                            className="w-12 text-center border border-gray-300 rounded text-sm py-0.5" />
                        ) : (
                          <span className="text-base font-bold" style={{color:"#0f2044"}}>{score}<span className="text-xs text-gray-400 font-normal">/5</span></span>
                        )}
                      </div>
                      <div>
                        <div className="h-2 rounded-full" style={{background:"#e2e8f0"}}>
                          <div className="h-2 rounded-full" style={{background: score <= 2 ? "#ef4444" : score === 3 ? "#eab308" : "#2563eb", width: `${(score / 5) * 100}%`}} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 06 スコア分布（レーダーチャート） */}
            <div className="px-8 py-6 border-b border-gray-100">
              <p className="text-xs font-semibold mb-1" style={{color:"#2563eb"}}>{String(nextNum()).padStart(2, '0')}</p>
              <h2 className="text-base font-semibold mb-4" style={{color:"#0f2044"}}>スコア分布</h2>
              <ResponsiveContainer width="100%" height={420}>
                <RadarChart data={chartData}>
                  <PolarGrid stroke="#cbd5e1" />
                  <PolarAngleAxis dataKey="category" tick={{ fontSize: 13, fill: "#1e293b" }} />
                  <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Radar name="スコア" dataKey="score" stroke={parseFloat(avgScore) <= 2 ? "#ef4444" : parseFloat(avgScore) < 4 ? "#eab308" : "#2563eb"} fill={parseFloat(avgScore) <= 2 ? "#ef4444" : parseFloat(avgScore) < 4 ? "#eab308" : "#2563eb"} fillOpacity={0.25} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* 07 CRI矛盾リスク診断 */}
            {criData && (() => {
              const topPairs = [...criData.pairs].sort((a, b) => b.score - a.score).slice(0, 4);
              return (
                <div className="px-8 py-6 border-b border-gray-100">
                  <p className="text-xs font-semibold mb-1" style={{color:"#2563eb"}}>{String(nextNum()).padStart(2, '0')}</p>
                  <h2 className="text-base font-semibold mb-1" style={{color:"#0f2044"}}>ブランド整合度チェック（CRI）</h2>
                  <p className="text-xs text-gray-400 mb-5">ブランドの各要素が整合しているかを確認する指標です。スコアが高い項目は、壁打ちで一緒に整理していきましょう。</p>

                  {/* CRIスコア */}
                  <div className="bg-gray-50 rounded-xl p-5 mb-5">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-3xl font-medium text-gray-900">{criData.cri.toFixed(2)}</span>
                      <span className="text-sm text-gray-400">/ 10.0</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">{criData.level}</p>
                    <div className="h-1.5 bg-gray-200 rounded-full mb-1">
                      <div className="h-1.5 rounded-full" style={{background: criData.cri >= 7 ? "#ef4444" : criData.cri >= 4 ? "#eab308" : "#2563eb", width: `${Math.min((criData.cri / 10) * 100, 100)}%`}} />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>整合</span><span>要整理</span>
                    </div>
                  </div>

                  {/* 矛盾リスト */}
                  <p className="text-xs text-gray-400 mb-3">検出された主要矛盾</p>
                  <div className="space-y-2">
                    {topPairs.map((pair, i) => (
                      <div key={i} className="border border-gray-100 rounded-xl p-4 bg-white">
                        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                          <span className="text-xs text-gray-400">確認優先度 {i + 1}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{pair.upstream}</span>
                          <span className="text-gray-300 text-xs">→</span>
                          <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{pair.downstream}</span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">{pair.risk}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* PDF用URL（印刷時のみ） */}
            <div className="hidden print:block px-8 py-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-1">無料壁打ちセッションのご予約はこちら</p>
              <p className="text-xs text-gray-600">https://timerex.net/s/huvdesignoffice_50ec/6cdca60c</p>
            </div>

            {/* ════ STAGE1 CTA ════ */}
            {!stage2Unlocked && (
              <div className="no-print px-8 py-8 border-t border-gray-100">
                <div className="border border-gray-200 rounded-xl p-6 text-center">
                  <h2 className="text-base font-medium text-gray-800 mb-2">診断結果をもとに、一緒に整理しませんか</h2>
                  <p className="text-sm text-gray-500 mb-1 leading-relaxed">
                    壁打ちセッション（無料・60分）では、このスコアをもとに<br className="hidden md:block" />
                    貴社のブランド課題を構造的に整理します。
                  </p>
                  <p className="text-xs text-gray-400 mb-5">押し売りは一切ありません</p>
                  <a href="https://timerex.net/s/huvdesignoffice_50ec/6cdca60c" target="_blank" rel="noopener noreferrer"
                    className="inline-block text-sm font-medium text-gray-800 border border-gray-300 rounded-lg px-6 py-2.5 hover:bg-gray-50 transition-colors">
                    無料壁打ちセッションを予約する →
                  </a>
                </div>
              </div>
            )}

            {/* ════ STAGE2：壁打ち後 ════ */}
            {stage2Unlocked && (
              <div>
                {/* 管理者用壁打ちメモ */}
                {isAdmin && (
                  <div className="no-print px-8 py-5 border-t border-gray-100 bg-gray-50">
                    <p className="text-xs text-gray-400 mb-2">壁打ちメモ（内部記録）</p>
                    {editMode ? (
                      <textarea value={consultationMemo} onChange={e => setConsultationMemo(e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-lg text-sm bg-white" rows={4} />
                    ) : (
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{consultationMemo || '未記入'}</p>
                    )}
                  </div>
                )}

                {/* 改善提案タイトルのみ */}
                {(displayAnalysis?.improvementRecommendations?.length ?? 0) > 0 && (
                  <div className="px-8 py-6 border-t border-gray-100">
                    <p className="text-xs font-semibold mb-1" style={{color:"#2563eb"}}>{String(nextNum()).padStart(2, '0')}</p>
                    <h2 className="text-sm font-medium text-gray-700 mb-1">改善提案（優先3項目）</h2>
                    <p className="text-xs text-gray-400 mb-4">詳細はブランド診断パッケージでご提供します</p>
                    <div className="space-y-2">
                      {displayAnalysis?.improvementRecommendations?.map((item, i) => {
                        const titleMatch = item.match(/^.+/);
                        const title = titleMatch ? titleMatch[0] : `改善項目 ${i + 1}`;
                        return (
                          <div key={i} className="flex items-center gap-3 p-3.5 border border-gray-100 rounded-xl bg-gray-50">
                            <span className="text-xs text-gray-400 flex-shrink-0">{i + 1}</span>
                            <p className="text-sm text-gray-700 flex-1">{title}</p>
                            {!stage3Unlocked && <span className="text-gray-300 text-xs">詳細あり</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* PDF用URL（印刷時のみ・STAGE2） */}
                <div className="hidden print:block px-8 py-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-1">ブランド診断パッケージのご相談はこちら</p>
                  <p className="text-xs text-gray-600">https://timerex.net/s/huvdesignoffice_50ec/6cdca60c</p>
                </div>

                {/* STAGE2 CTA */}
                {!stage3Unlocked && (
                  <div className="no-print px-8 py-8 border-t border-gray-100">
                    <div className="border border-gray-200 rounded-xl p-6 text-center">
                      <h2 className="text-base font-medium text-gray-800 mb-2">ブランド診断パッケージ</h2>
                      <p className="text-xs text-gray-400 mb-1">改善提案の詳細 / アクションプラン / フェーズ別アドバイス / 総合評価</p>
                      <p className="text-sm text-gray-500 leading-relaxed mb-4">壁打ちで見えてきた課題をもとに、<br className="hidden md:block" />貴社専用の戦略レポートをお届けします。</p>
                      <p className="text-2xl font-medium text-gray-900 mb-5">150,000<span className="text-sm font-normal text-gray-400"> 円（税別）</span></p>
                      <a href="https://timerex.net/s/huvdesignoffice_50ec/6cdca60c" target="_blank" rel="noopener noreferrer"
                        className="inline-block text-sm font-medium text-gray-800 border border-gray-300 rounded-lg px-6 py-2.5 hover:bg-gray-50 transition-colors">
                        パッケージについて相談する →
                      </a>
                    </div>
                  </div>
                )}

                {/* ════ STAGE3：フルレポート ════ */}
                {stage3Unlocked && displayAnalysis && (
                  <div className="border-t border-gray-100">

                    <div className="px-8 py-3 bg-gray-50 border-b border-gray-100">
                      <p className="text-xs text-gray-500 text-center">ブランド診断パッケージ — フルレポート</p>
                    </div>

                    {/* 総合評価 */}
                    <div className="px-8 py-6 border-b border-gray-100">
                      <p className="text-xs font-semibold mb-1" style={{color:"#2563eb"}}>{String(nextNum()).padStart(2, '0')}</p>
                      <h2 className="text-sm font-medium text-gray-700 mb-3">総合評価</h2>
                      {editMode ? (
                        <textarea value={editedReport?.overallComment || ''} onChange={e => updateField('overallComment', e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-lg text-sm" rows={6} />
                      ) : (
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{displayAnalysis.overallComment}</p>
                      )}
                    </div>

                    {/* 矛盾点とリスク */}
                    {displayAnalysis.contradictionsAndRisks?.length > 0 && (
                      <div className="px-8 py-6 border-b border-gray-100">
                        <p className="text-xs font-semibold mb-1" style={{color:"#2563eb"}}>{String(nextNum()).padStart(2, '0')}</p>
                        <h2 className="text-sm font-medium text-gray-700 mb-1">矛盾点とリスク（CRIベース）</h2>
                        <p className="text-xs text-gray-400 mb-4">このまま放置した場合に起こりうる具体的な損失です</p>
                        <div className="space-y-3">
                          {displayAnalysis.contradictionsAndRisks.map((item, i) => (
                            <div key={i} className="border border-gray-100 rounded-xl p-4">
                              <div className="flex items-start gap-3">
                                <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">{i + 1}</span>
                                {editMode ? (
                                  <textarea value={editedReport?.contradictionsAndRisks?.[i] || ''} onChange={e => updateArrayField('contradictionsAndRisks', i, e.target.value)}
                                    className="flex-1 p-2 border border-gray-200 rounded text-sm" rows={3} />
                                ) : (
                                  <p className="text-sm leading-relaxed flex-1" style={{color:"#1e293b"}}>{item}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 改善提案詳細 */}
                    {displayAnalysis.improvementRecommendations?.length > 0 && (
                      <div className="px-8 py-6 border-b border-gray-100">
                        <p className="text-xs font-semibold mb-1" style={{color:"#2563eb"}}>{String(nextNum()).padStart(2, '0')}</p>
                        <h2 className="text-sm font-medium text-gray-700 mb-4">改善提案 詳細</h2>
                        <div className="space-y-3">
                          {displayAnalysis.improvementRecommendations.map((item, i) => (
                            <div key={i} className="border border-gray-100 rounded-xl p-4">
                              <div className="flex items-start gap-3">
                                <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">{i + 1}</span>
                                {editMode ? (
                                  <textarea value={editedReport?.improvementRecommendations?.[i] || ''} onChange={e => updateArrayField('improvementRecommendations', i, e.target.value)}
                                    className="flex-1 p-2 border border-gray-200 rounded text-sm" rows={4} />
                                ) : (
                                  <p className="text-sm leading-relaxed flex-1" style={{color:"#1e293b"}}>{item}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* アクションプラン */}
                    <div className="px-8 py-6 border-b border-gray-100">
                      <p className="text-xs font-semibold mb-1" style={{color:"#2563eb"}}>{String(nextNum()).padStart(2, '0')}</p>
                      <h2 className="text-sm font-medium text-gray-700 mb-4">アクションプラン</h2>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {[
                          { key: 'actionPlan3Months' as keyof AIReport, label: '3ヶ月後' },
                          { key: 'actionPlan6Months' as keyof AIReport, label: '6ヶ月後' },
                          { key: 'actionPlan1Year'   as keyof AIReport, label: '1年後' },
                        ].map(({ key, label }) => (
                          <div key={key} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                            <h4 className="text-xs font-medium text-gray-500 mb-2">{label}</h4>
                            {editMode ? (
                              <textarea value={(editedReport?.[key] as string[])?.[0] || ''} onChange={e => updateArrayField(key, 0, e.target.value)}
                                className="w-full p-2 border border-gray-200 rounded text-xs bg-white" rows={5} />
                            ) : (
                              <p className="text-xs text-gray-600 leading-relaxed">{(displayAnalysis[key] as string[])?.[0]}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* フェーズ別アドバイス */}
                    {displayAnalysis.phaseAdvice && (
                      <div className="px-8 py-6 border-b border-gray-100">
                        <p className="text-xs font-semibold mb-1" style={{color:"#2563eb"}}>{String(nextNum()).padStart(2, '0')}</p>
                        <h2 className="text-sm font-medium text-gray-700 mb-3">事業フェーズ別アドバイス</h2>
                        {editMode ? (
                          <textarea value={editedReport?.phaseAdvice || ''} onChange={e => updateField('phaseAdvice', e.target.value)}
                            className="w-full p-3 border border-gray-200 rounded-lg text-sm" rows={5} />
                        ) : (
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{displayAnalysis.phaseAdvice}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* フッター */}
            <div style={{background:"#0f2044"}} className="px-8 py-4 flex items-center justify-center">
              
              <span style={{color:"#93b4d4",fontSize:"12px"}}>© 2026 株式会社HUV DESIGN OFFICE</span>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}














