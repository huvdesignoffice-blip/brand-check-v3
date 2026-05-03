'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createBrowserClient } from "@supabase/ssr";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

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
  revenue_scale: string;
  mission: string;
  vision_future: string;
  challenges: string[];
  other_challenge: string | null;
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

export default function PartnerResultPage() {
  const params = useParams();
  const [result, setResult] = useState<SurveyResult | null>(null);
  const [loading, setLoading] = useState(true);

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
      if (!error && data) setResult(data);
      setLoading(false);
    })();
  }, [params.id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-xl text-gray-600">読み込み中...</div>
    </div>
  );

  if (!result) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <h1 className="text-2xl font-bold text-gray-900">結果が見つかりません</h1>
    </div>
  );

  const scores = QUESTIONS.map(q => (result as any)[q.id] as number);
  const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  const chartData = QUESTIONS.map((q, i) => ({ category: q.label, score: scores[i] }));
  const criData = result.ai_report?.cri;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">

        {/* 戻るボタン */}
        <div className="mb-6">
          <a href="/partner/dashboard" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
            ← ダッシュボードに戻る
          </a>
        </div>

        {/* ヘッダー */}
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

        {/* 基本情報 */}
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
              { label: '売上規模', value: result.revenue_scale || '未回答' },
              { label: '回答日時', value: new Date(result.created_at).toLocaleString('ja-JP') },
            ].map((item, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                <p className="text-sm font-semibold text-gray-800">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 企業理念 */}
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

        {/* ビジョン */}
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

        {/* 現在の課題 */}
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
          </div>
        )}

        {/* スコアシート */}
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
                    <span className={`text-sm font-bold px-2 py-0.5 rounded border ${getScoreColor(score)}`}>{score}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* レーダーチャート */}
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

        {/* CRI矛盾リスク診断 */}
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
              <h3 className={`text-sm font-bold mb-3 ${s.text}`}>📌 診断で見えてきた、確認したいポイント</h3>
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

      </div>
    </div>
  );
}
