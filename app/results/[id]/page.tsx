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

function getScoreColor(score: number) {
  if (score >= 4) return 'text-green-600 bg-green-50 border-green-200';
  if (score >= 3) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  return 'text-red-600 bg-red-50 border-red-200';
}

function getScoreBarColor(score: number) {
  if (score >= 4) return 'bg-green-500';
  if (score >= 3) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getCRIStyle(level: string) {
  if (level.includes('優先') || level.includes('重大')) return { bg: 'bg-red-50', border: 'border-red-400', text: 'text-red-700', badge: 'bg-red-600 text-white', bar: 'bg-red-500' };
  if (level.includes('確認') || level.includes('要注意')) return { bg: 'bg-yellow-50', border: 'border-yellow-400', text: 'text-yellow-700', badge: 'bg-yellow-500 text-white', bar: 'bg-yellow-400' };
  return { bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-700', badge: 'bg-green-600 text-white', bar: 'bg-green-500' };
}

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
        // 管理者の場合は全ステージ解放
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-xl text-gray-600">読み込み中...</div>
    </div>
  );

  if (!result) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">結果が見つかりません</h1>
        <p className="text-gray-600">指定されたIDのデータが存在しません。</p>
      </div>
    </div>
  );

  const scores = QUESTIONS.map(q => (result as any)[q.id] as number);
  const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  const chartData = QUESTIONS.map((q, i) => ({ category: q.label, score: scores[i] }));
  const criData = result.ai_report?.cri;
  const displayAnalysis = editMode && editedReport ? editedReport : result.ai_report;

  return (
    <>
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          @page { margin: 1cm; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">

          {/* ── 管理者ボタン ── */}
          {isAdmin && (
            <div className="no-print mb-6 flex justify-end gap-3">
              {!editMode ? (
                <>
                  <button onClick={() => window.print()} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">PDF印刷</button>
                  <button onClick={handleEdit} disabled={!result.ai_report} className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">編集</button>
                  <button onClick={() => generateAIReport(result)} className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium">AI再生成</button>
                  <a href="/admin/brand-check" className="px-5 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium inline-block">管理画面</a>
                </>
              ) : (
                <>
                  <button onClick={handleSaveEdit} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">保存</button>
                  <button onClick={handleCancelEdit} className="px-5 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium">キャンセル</button>
                </>
              )}
            </div>
          )}

          {/* ── ページヘッダー ── */}
          <div className="bg-gradient-to-r from-indigo-700 to-purple-700 text-white rounded-2xl shadow-xl p-8 mb-8">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🔍</span>
              <h1 className="text-2xl font-bold">ブランド診断レポート</h1>
            </div>
            <p className="text-indigo-200 text-sm">Brand Check Assessment Report</p>
            <div className="mt-4 flex items-center gap-4">
              <div className="bg-white bg-opacity-20 rounded-lg px-4 py-2 text-center">
                <p className="text-xs text-indigo-200">総合スコア</p>
                <p className="text-3xl font-bold text-gray-900">{avgScore}<span className="text-lg font-normal text-indigo-200"> / 5.0</span></p>
              </div>
              <div className="text-indigo-100 text-sm">
                <p>{result.company_name} 御中</p>
                <p>{new Date(result.created_at).toLocaleDateString('ja-JP')}</p>
              </div>
            </div>
          </div>

          {/* ── AI生成中 ── */}
          {generatingAI && (
            <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-6 mb-8 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-3"></div>
              <p className="text-indigo-700 font-semibold">AI分析中...（10〜20秒お待ちください）</p>
            </div>
          )}

          {/* ════════ STAGE1：全員に開示 ════════ */}

          {/* 1. 基本情報 */}
          <div className="bg-white rounded-2xl shadow-md p-7 mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-5 flex items-center gap-2">
              <span className="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
              基本情報
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: '企業名', value: result.company_name + ' 御中' },
                { label: '回答者', value: result.respondent_name + ' 様' },
                { label: '業種', value: result.industry || '未回答' },
                { label: '事業フェーズ', value: result.business_phase },
                { label: '回答日時', value: new Date(result.created_at).toLocaleString('ja-JP') },
              ].map((item, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                  <p className="text-sm font-semibold text-gray-800">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 2. 企業理念 */}
          {result.mission && (
            <div className="bg-white rounded-2xl shadow-md p-7 mb-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                企業理念
              </h2>
              <div className="bg-purple-50 border-l-4 border-purple-400 rounded-r-lg p-5">
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{result.mission}</p>
              </div>
            </div>
          )}

          {/* 3. ビジョン */}
          {result.vision_future && (
            <div className="bg-white rounded-2xl shadow-md p-7 mb-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                3〜5年後のビジョン
              </h2>
              <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-lg p-5">
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{result.vision_future}</p>
              </div>
            </div>
          )}

          {/* 4. 現在の課題 */}
          {result.challenges?.length > 0 && (
            <div className="bg-white rounded-2xl shadow-md p-7 mb-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
                現在の課題
              </h2>
              <div className="flex flex-wrap gap-2">
                {result.challenges.map((c, i) => (
                  <span key={i} className="bg-orange-50 border border-orange-300 text-orange-800 px-4 py-2 rounded-full text-sm font-medium">{c}</span>
                ))}
              </div>
              {result.other_challenge && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs font-semibold text-gray-500 mb-1">その他</p>
                  <p className="text-sm text-gray-700">{result.other_challenge}</p>
                </div>
              )}
            </div>
          )}

          {/* 5. スコアシート */}
          <div className="bg-white rounded-2xl shadow-md p-7 mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
              <span className="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">5</span>
              スコアシート
            </h2>
            <p className="text-xs text-gray-500 mb-5">設問1→12は時計回りの因果連鎖（ブランド基盤→戦略設計→実行・浸透）</p>
            <div className="flex gap-3 mb-4 flex-wrap">
              {[
                { label: 'ブランド基盤', color: 'bg-purple-100 text-purple-700 border-purple-300' },
                { label: '戦略設計',     color: 'bg-teal-100 text-teal-700 border-teal-300' },
                { label: '実行・浸透',   color: 'bg-blue-100 text-blue-700 border-blue-300' },
              ].map(l => (
                <span key={l.label} className={`text-xs px-3 py-1 rounded-full border font-medium ${l.color}`}>{l.label}</span>
              ))}
            </div>
            <div className="space-y-3">
              {QUESTIONS.map((q, i) => {
                const score = (result as any)[q.id] as number;
                const layerColor =
                  q.layer === 'ブランド基盤' ? 'bg-purple-100 text-purple-700' :
                  q.layer === '戦略設計'     ? 'bg-teal-100 text-teal-700' :
                                               'bg-blue-100 text-blue-700';
                return (
                  <div key={q.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-xs text-gray-400 font-bold w-6 text-right flex-shrink-0">Q{i+1}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${layerColor}`}>{q.layer}</span>
                    <p className="flex-1 text-sm font-semibold text-gray-800 truncate">{q.label}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div className={`h-2 rounded-full ${getScoreBarColor(score)}`} style={{ width: `${(score/5)*100}%` }} />
                      </div>
                      {isAdmin && editMode ? (
                        <input type="number" min={1} max={5} value={score}
                          onChange={e => setResult(prev => prev ? {...prev, [q.id]: Number(e.target.value)} : null)}
                          className="w-12 text-center font-bold border-2 border-blue-400 rounded text-sm py-0.5" />
                      ) : (
                        <span className={`text-sm font-bold px-2 py-0.5 rounded border ${getScoreColor(score)}`}>{score}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 6. レーダーチャート */}
          <div className="bg-white rounded-2xl shadow-md p-7 mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-5 flex items-center gap-2">
              <span className="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">6</span>
              スコア分布
            </h2>
            <ResponsiveContainer width="100%" height={380}>
              <RadarChart data={chartData}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 10, fill: '#6b7280' }} />
                <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={{ fontSize: 9, fill: '#9ca3af' }} />
                <Radar name="スコア" dataKey="score" stroke="#6D28D9" fill="#6D28D9" fillOpacity={0.25} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* 7. CRI矛盾リスク診断 */}
          {criData && (() => {
            const s = getCRIStyle(criData.level);
            const topPairs = [...criData.pairs].sort((a, b) => b.score - a.score).slice(0, 4);
            return (
              <div className={`rounded-2xl shadow-md p-7 mb-6 border-2 ${s.bg} ${s.border}`}>
                <h2 className={`text-lg font-bold mb-2 flex items-center gap-2 ${s.text}`}>
                  <span className="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">7</span>
                  ブランド整合度チェック（CRI）
                </h2>
                <p className="text-xs text-gray-500 mb-5">ブランドの各要素が整合しているかを確認する指標です。スコアが高い項目は、壁打ちで一緒に整理していきましょう。</p>
                <div className="flex items-center gap-5 mb-6 bg-white rounded-xl p-5 border border-gray-100">
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">CRI総合スコア</p>
                    <p className={`text-5xl font-bold ${s.text}`}>{criData.cri.toFixed(2)}</p>
                  </div>
                  <div className="flex-1">
                    <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-2 ${s.badge}`}>{criData.level}</span>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div className={`h-3 rounded-full transition-all ${s.bar}`} style={{ width: `${Math.min((criData.cri / 10) * 100, 100)}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>0　整合</span><span>5.0</span><span>10.0　要整理</span>
                    </div>
                  </div>
                </div>
                <h3 className={`text-sm font-bold mb-3 ${s.text}`}>⚠ 検出された主要矛盾</h3>
                <div className="space-y-3">
                  {topPairs.map((pair, i) => (
                    <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.badge}`}>{i+1}</span>
                        <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">{pair.upstream}</span>
                        <span className="text-gray-300 text-sm">→</span>
                        <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{pair.downstream}</span>
                        <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded ${pair.score > 1.2 ? 'bg-red-100 text-red-700' : pair.score > 0.5 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                          確認優先度 {pair.score.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{pair.risk}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* PDF用URL（印刷時のみ表示） */}
          <div className="hidden print:block bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6 text-center">
            <p className="text-sm text-gray-600 mb-1">無料壁打ちセッションのご予約はこちら</p>
            <p className="text-sm font-bold text-indigo-700">https://timerex.net/s/huvdesignoffice_50ec/6cdca60c</p>
          </div>
          {/* ════════ STAGE1 CTA：壁打ち予約 ════════ */}
          {!stage2Unlocked && (
            <div className="no-print bg-gradient-to-br from-indigo-700 to-purple-700 text-white rounded-2xl shadow-xl p-8 mb-8 text-center">
              <div className="text-4xl mb-3">📅</div>
              <h2 className="text-xl font-bold mb-2">結果について、一緒に整理しませんか？</h2>
              <p className="text-indigo-200 text-sm mb-2">診断結果を見ながら、現状と方向性をざっくばらんにお話しします。</p>
              <p className="text-indigo-300 text-xs mb-6">所要時間：60分 / 完全無料 / 押し売り一切なし</p>
              <a href="https://timerex.net/s/huvdesignoffice_50ec/6cdca60c" target="_blank" rel="noopener noreferrer"
                className="inline-block bg-white text-indigo-700 font-bold px-8 py-3 rounded-full hover:bg-indigo-50 transition-colors shadow-md">
                無料壁打ちセッションを予約する →
              </a>
            </div>
          )}

          {/* ════════ STAGE2：壁打ち後 ════════ */}
          {stage2Unlocked && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-sm font-bold text-gray-500 bg-white px-3">🔓 壁打ち後レポート</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              {/* 管理者用壁打ちメモ */}
              {isAdmin && (
                <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6">
                  <h3 className="text-sm font-bold text-gray-700 mb-3">💬 壁打ちメモ（内部記録）</h3>
                  {editMode ? (
                    <textarea value={consultationMemo} onChange={e => setConsultationMemo(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg text-sm" rows={5} />
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white p-3 rounded-lg border border-gray-100">{consultationMemo || '未記入'}</p>
                  )}
                </div>
              )}

              {/* 改善提案タイトルのみ */}
              {(displayAnalysis?.improvementRecommendations?.length ?? 0) > 0 && (
                <div className="bg-white rounded-2xl shadow-md p-7 border-l-4 border-purple-400">
                  <h3 className="text-lg font-bold text-purple-700 mb-2">🎯 改善提案（優先3項目）</h3>
                  <p className="text-xs text-gray-500 mb-5">壁打ちを通じて、特に一緒に取り組みたい領域が見えてきました。詳細はブランド診断パッケージでご一緒します。</p>
                  <div className="space-y-3">
                    {displayAnalysis?.improvementRecommendations?.map((item, i) => {
                      const titleMatch = item.match(/【.+?】/);
                      const title = titleMatch ? titleMatch[0] : `改善項目 ${i + 1}`;
                      const stars = item.match(/^★+/)?.[0] || '';
                      return (
                        <div key={i} className="flex items-center gap-3 p-4 bg-purple-50 rounded-xl border border-purple-100">
                          <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-gray-800">{stars} {title}</p>
                            {!stage3Unlocked && <p className="text-xs text-gray-400 mt-0.5">詳細はブランド診断パッケージでご提供します</p>}
                          </div>
                          {!stage3Unlocked && <span className="text-gray-300 text-xl">🔒</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* PDF用URL（印刷時のみ表示） */}
              <div className="hidden print:block bg-gray-50 border border-gray-200 rounded-xl p-5 mb-4 text-center">
                <p className="text-sm text-gray-600 mb-1">ブランド診断パッケージのご相談はこちら</p>
                <p className="text-sm font-bold text-purple-700">https://timerex.net/s/huvdesignoffice_50ec/6cdca60c</p>
              </div>
              {/* STAGE2 CTA：ブランド診断パッケージ */}
              {!stage3Unlocked && (
                <div className="no-print bg-gradient-to-br from-purple-700 to-indigo-700 text-white rounded-2xl shadow-xl p-8 text-center">
                  <div className="text-4xl mb-3">📋</div>
                  <h2 className="text-xl font-bold mb-2">ブランド診断パッケージ</h2>
                  <p className="text-purple-200 text-sm mb-1">改善提案の詳細 / アクションプラン / フェーズ別アドバイス / 総合評価</p>
                  <p className="text-purple-300 text-xs mb-5">壁打ちで見えてきた課題をもとに、貴社専用の戦略レポートをお届けします。一緒に前に進みましょう。</p>
                  <div className="bg-white bg-opacity-10 rounded-xl p-4 mb-6 inline-block">
                    <p className="text-3xl font-bold">150,000<span className="text-lg font-normal text-purple-200"> 円（税別）</span></p>
                  </div>
                  <br/>
                  <a href="https://timerex.net/s/huvdesignoffice_50ec/6cdca60c" target="_blank" rel="noopener noreferrer"
                    className="inline-block bg-white text-purple-700 font-bold px-8 py-3 rounded-full hover:bg-purple-50 transition-colors shadow-md">
                    パッケージについて相談する →
                  </a>
                </div>
              )}

              {/* ════════ STAGE3：成約後フルレポート ════════ */}
              {stage3Unlocked && displayAnalysis && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="text-sm font-bold text-gray-500 bg-white px-3">🎉 ブランド診断パッケージ フルレポート</span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>

                  {/* 総合評価 */}
                  <div className="bg-white rounded-2xl shadow-md p-7 border-l-4 border-indigo-400">
                    <h3 className="text-lg font-bold text-indigo-700 mb-3">📊 総合評価</h3>
                    {editMode ? (
                      <textarea value={editedReport?.overallComment || ''} onChange={e => updateField('overallComment', e.target.value)}
                        className="w-full p-4 border border-gray-300 rounded-lg" rows={6} />
                    ) : (
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{displayAnalysis.overallComment}</p>
                    )}
                  </div>

                  {/* 矛盾点とリスク */}
                  {displayAnalysis.contradictionsAndRisks?.length > 0 && (
                    <div className="bg-gradient-to-r from-yellow-50 to-red-50 rounded-2xl shadow-md p-7 border-2 border-orange-200">
                      <h3 className="text-lg font-bold text-orange-700 mb-2">⚠️ 矛盾点とリスク（CRIベース）</h3>
                      <p className="text-xs text-orange-500 mb-5">このまま放置した場合に起こりうる具体的な損失です</p>
                      <ul className="space-y-4">
                        {displayAnalysis.contradictionsAndRisks.map((item, i) => (
                          <li key={i} className="bg-white rounded-xl p-4 border-l-4 border-orange-400 shadow-sm">
                            <div className="flex items-start gap-3">
                              <span className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i+1}</span>
                              {editMode ? (
                                <textarea value={editedReport?.contradictionsAndRisks?.[i] || ''} onChange={e => updateArrayField('contradictionsAndRisks', i, e.target.value)}
                                  className="flex-1 p-2 border border-gray-300 rounded text-sm" rows={3} />
                              ) : (
                                <p className="text-gray-800 text-sm leading-relaxed flex-1">{item}</p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 改善提案詳細 */}
                  {displayAnalysis.improvementRecommendations?.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-md p-7 border-l-4 border-purple-400">
                      <h3 className="text-lg font-bold text-purple-700 mb-5">🎯 改善提案 詳細</h3>
                      <ul className="space-y-4">
                        {displayAnalysis.improvementRecommendations.map((item, i) => (
                          <li key={i} className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                            <div className="flex items-start gap-3">
                              <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i+1}</span>
                              {editMode ? (
                                <textarea value={editedReport?.improvementRecommendations?.[i] || ''} onChange={e => updateArrayField('improvementRecommendations', i, e.target.value)}
                                  className="flex-1 p-2 border border-gray-300 rounded text-sm" rows={4} />
                              ) : (
                                <p className="text-gray-800 text-sm leading-relaxed flex-1">{item}</p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* アクションプラン */}
                  <div className="bg-white rounded-2xl shadow-md p-7 border-l-4 border-green-400">
                    <h3 className="text-lg font-bold text-green-700 mb-5">📅 アクションプラン</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { key: 'actionPlan3Months' as keyof AIReport, label: '3ヶ月後', border: 'border-green-300', bg: 'bg-green-50', text: 'text-green-700' },
                        { key: 'actionPlan6Months' as keyof AIReport, label: '6ヶ月後', border: 'border-teal-300',  bg: 'bg-teal-50',  text: 'text-teal-700' },
                        { key: 'actionPlan1Year'   as keyof AIReport, label: '1年後',   border: 'border-blue-300',  bg: 'bg-blue-50',  text: 'text-blue-700' },
                      ].map(({ key, label, border, bg, text }) => (
                        <div key={key} className={`${bg} rounded-xl p-4 border ${border}`}>
                          <h4 className={`font-bold text-sm mb-2 ${text}`}>{label}</h4>
                          {editMode ? (
                            <textarea value={(editedReport?.[key] as string[])?.[0] || ''} onChange={e => updateArrayField(key, 0, e.target.value)}
                              className="w-full p-2 border border-gray-200 rounded text-xs" rows={5} />
                          ) : (
                            <p className="text-xs text-gray-700 leading-relaxed">{(displayAnalysis[key] as string[])?.[0]}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* フェーズ別アドバイス */}
                  {displayAnalysis.phaseAdvice && (
                    <div className="bg-indigo-50 rounded-2xl shadow-md p-7 border-l-4 border-indigo-400">
                      <h3 className="text-lg font-bold text-indigo-700 mb-3">💡 事業フェーズ別アドバイス</h3>
                      {editMode ? (
                        <textarea value={editedReport?.phaseAdvice || ''} onChange={e => updateField('phaseAdvice', e.target.value)}
                          className="w-full p-4 border border-gray-300 rounded-lg" rows={5} />
                      ) : (
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">{displayAnalysis.phaseAdvice}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}













