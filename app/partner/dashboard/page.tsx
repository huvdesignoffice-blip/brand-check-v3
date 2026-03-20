"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

type Partner = {
  id: string;
  name: string;
  company_name: string;
  email: string;
};

type Assessment = {
  id: string;
  created_at: string;
  company_name: string;
  respondent_name: string;
  respondent_email: string;
  industry: string;
  business_phase: string;
  avg_score: number;
  stage2_unlocked: boolean;
};

export default function PartnerDashboard() {
  const router = useRouter();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [surveyUrl, setSurveyUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const session = sessionStorage.getItem("partner_session");
    if (!session) { router.push("/partner/login"); return; }
    const p = JSON.parse(session);
    setPartner(p);
    setSurveyUrl(`${window.location.origin}/survey?partner=${p.id}`);
    fetchAssessments(p.id);
  }, []);

  async function fetchAssessments(partnerId: string) {
    const { data, error } = await supabase
      .from("survey_results")
      .select("id,created_at,company_name,respondent_name,respondent_email,industry,business_phase,avg_score,stage2_unlocked")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false });
    if (!error && data) setAssessments(data);
    setLoading(false);
  }

  async function toggleUnlock(id: string, current: boolean) {
    const { error } = await supabase
      .from("survey_results")
      .update({ stage2_unlocked: !current })
      .eq("id", id);
    if (!error) setAssessments(prev => prev.map(a => a.id === id ? { ...a, stage2_unlocked: !current } : a));
  }

  async function sendReportEmail(a: Assessment) {
    if (!a.respondent_email) { alert("メールアドレスがありません"); return; }
    if (!confirm(`${a.respondent_name}様にレポートURLを送信しますか？`)) return;
    const res = await fetch("/api/send-report-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: a.respondent_email, company_name: a.company_name, respondent_name: a.respondent_name, result_id: a.id }),
    });
    alert(res.ok ? "送信しました" : "送信に失敗しました");
  }

  function copySurveyUrl() {
    navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleLogout() {
    sessionStorage.removeItem("partner_session");
    router.push("/partner/login");
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="text-xl">読み込み中...</div></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">

        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl p-6 mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">パートナーダッシュボード</h1>
            <p className="text-indigo-200 text-sm mt-1">{partner?.company_name}　{partner?.name} 様</p>
          </div>
          <button onClick={handleLogout} className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg text-sm font-medium">
            ログアウト
          </button>
        </div>

        {/* 診断URL発行 */}
        <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">📋 顧客用診断URLを発行する</h2>
          <p className="text-sm text-gray-500 mb-4">このURLを顧客に送付してください。回答は自動的にあなたのダッシュボードに紐付きます。</p>
          <div className="flex gap-3">
            <input type="text" value={surveyUrl} readOnly
              className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700" />
            <button onClick={copySurveyUrl}
              className={`px-6 py-3 rounded-xl font-bold text-sm transition-colors ${copied ? 'bg-green-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
              {copied ? '✓ コピー済み' : 'URLをコピー'}
            </button>
          </div>
        </div>

        {/* 統計 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: '総診断数', value: assessments.length, color: 'text-indigo-600' },
            { label: '解放済み', value: assessments.filter(a => a.stage2_unlocked).length, color: 'text-green-600' },
            { label: '平均スコア', value: assessments.length > 0 ? (assessments.reduce((s, a) => s + a.avg_score, 0) / assessments.length).toFixed(1) : '-', color: 'text-purple-600' },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-md p-5 text-center">
              <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
              <p className={`text-4xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* 顧客一覧 */}
        <div className="bg-white rounded-2xl shadow-md p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">顧客一覧</h2>
          {assessments.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">📭</p>
              <p>まだ診断データがありません</p>
              <p className="text-sm mt-1">上記のURLを顧客に送付してください</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    {['日時','会社名','回答者','スコア','状態','操作'].map(h => (
                      <th key={h} className="p-3 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assessments.map(a => (
                    <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="p-3 text-gray-400 whitespace-nowrap">{new Date(a.created_at).toLocaleDateString('ja-JP')}</td>
                      <td className="p-3 font-medium text-gray-900">{a.company_name}</td>
                      <td className="p-3 text-gray-600">
                        <div>{a.respondent_name}</div>
                        <div className="text-xs text-gray-400">{a.respondent_email}</div>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`font-bold text-lg ${a.avg_score >= 4 ? 'text-green-600' : a.avg_score >= 3 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {(a.avg_score || 0).toFixed(1)}
                        </span>
                      </td>
                      <td className="p-3">
                        <button onClick={() => toggleUnlock(a.id, a.stage2_unlocked)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold ${a.stage2_unlocked ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {a.stage2_unlocked ? '🔓 解放済み' : '🔒 ロック中'}
                        </button>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <a href={`/results/${a.id}`} target="_blank"
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium">
                            詳細
                          </a>
                          <button onClick={() => sendReportEmail(a)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium">
                            📧
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

