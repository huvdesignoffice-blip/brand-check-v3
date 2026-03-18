"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

type Assessment = {
  id: string;
  created_at: string;
  company_name: string | null;
  respondent_name: string | null;
  respondent_email: string | null;
  industry: string | null;
  business_phase: string | null;
  avg_score: number | null;
  stage2_unlocked: boolean;
  consultation_memo: string | null;
};

type SortField = 'created_at' | 'company_name' | 'avg_score';
type SortOrder = 'asc' | 'desc';

export default function BrandCheckAdminPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [filteredAssessments, setFilteredAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [industryFilter, setIndustryFilter] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('');
  const [industries, setIndustries] = useState<string[]>([]);
  const [phases, setPhases] = useState<string[]>([]);
  const [memoModal, setMemoModal] = useState<{ id: string; memo: string } | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => { checkAuth(); }, []);

  async function checkAuth() {
    try {
      const response = await fetch('/api/admin/auth');
      if (response.ok) {
        setAuthenticated(true);
        sessionStorage.setItem('admin_authenticated', 'true');
        fetchAssessments();
      } else {
        router.push('/admin/login');
      }
    } catch {
      router.push('/admin/login');
    } finally {
      setCheckingAuth(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    sessionStorage.removeItem('admin_authenticated');
    router.push('/admin/login');
  }

  useEffect(() => {
    if (authenticated) filterAndSortAssessments();
  }, [assessments, searchTerm, sortField, sortOrder, industryFilter, phaseFilter, authenticated]);

  async function fetchAssessments() {
    try {
      const { data, error } = await supabase
        .from("survey_results")
        .select("id,created_at,company_name,respondent_name,respondent_email,industry,business_phase,avg_score,stage2_unlocked,consultation_memo")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const d = data || [];
      setAssessments(d);
      setIndustries([...new Set(d.map((a:any) => a.industry).filter(Boolean))].sort() as string[]);
      setPhases([...new Set(d.map((a:any) => a.business_phase).filter(Boolean))].sort() as string[]);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }

  function filterAndSortAssessments() {
    let filtered = [...assessments];
    if (searchTerm) {
      filtered = filtered.filter(a =>
        a.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.respondent_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.respondent_email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (industryFilter) filtered = filtered.filter(a => a.industry === industryFilter);
    if (phaseFilter) filtered = filtered.filter(a => a.business_phase === phaseFilter);
    filtered.sort((a, b) => {
      let av: any = a[sortField], bv: any = b[sortField];
      if (av === null) return 1;
      if (bv === null) return -1;
      if (sortField === 'created_at') { av = new Date(av).getTime(); bv = new Date(bv).getTime(); }
      return sortOrder === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    setFilteredAssessments(filtered);
  }

  // ── 解放フラグ切り替え ──
  async function toggleUnlock(id: string, current: boolean) {
    const next = !current;
    const { error } = await supabase
      .from("survey_results")
      .update({ stage2_unlocked: next })
      .eq("id", id);
    if (error) { alert("更新に失敗しました"); return; }
    setAssessments(prev => prev.map(a => a.id === id ? { ...a, stage2_unlocked: next } : a));
  }

  // ── 壁打ちメモ保存 ──
  async function saveMemo() {
    if (!memoModal) return;
    const { error } = await supabase
      .from("survey_results")
      .update({ consultation_memo: memoModal.memo })
      .eq("id", memoModal.id);
    if (error) { alert("保存に失敗しました"); return; }
    setAssessments(prev => prev.map(a => a.id === memoModal.id ? { ...a, consultation_memo: memoModal.memo } : a));
    setMemoModal(null);
    alert("メモを保存しました");
  }

  // ── 回答者へレポートURLメール送信 ──
  async function sendReportEmail(a: Assessment) {
    if (!a.respondent_email) { alert("メールアドレスがありません"); return; }
    if (!confirm(`${a.company_name} ${a.respondent_name}様にレポートURLを送信しますか？`)) return;
    setSendingEmail(a.id);
    try {
      const res = await fetch('/api/send-report-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: a.respondent_email,
          company_name: a.company_name,
          respondent_name: a.respondent_name,
          result_id: a.id,
        }),
      });
      if (res.ok) { alert("送信しました"); }
      else { alert("送信に失敗しました"); }
    } catch { alert("送信エラー"); }
    finally { setSendingEmail(null); }
  }

  // ── CSV ──
  function exportToCSV() {
    const headers = ['作成日時','会社名','回答者名','メール','業界','フェーズ','平均スコア','解放状態'];
    const rows = filteredAssessments.map(a => [
      new Date(a.created_at).toLocaleString('ja-JP'),
      a.company_name || '', a.respondent_name || '', a.respondent_email || '',
      a.industry || '', a.business_phase || '',
      (a.avg_score || 0).toFixed(1),
      a.stage2_unlocked ? '解放済み' : 'ロック中',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `brand-check-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  async function handleDelete(id: string) {
    if (!confirm("削除しますか？")) return;
    const { error } = await supabase.from("survey_results").delete().eq("id", id);
    if (error) { alert("削除失敗"); return; }
    setAssessments(prev => prev.filter(a => a.id !== id));
  }

  if (checkingAuth) return <div className="min-h-screen flex items-center justify-center"><div className="text-xl">認証確認中...</div></div>;
  if (!authenticated) return null;
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="text-xl">読み込み中...</div></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6">

          {/* ヘッダー */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Brand Check 管理画面</h1>
            <div className="flex gap-3">
              <button onClick={exportToCSV} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">
                📥 CSV ({filteredAssessments.length}件)
              </button>
              <button onClick={handleLogout} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium">
                ログアウト
              </button>
            </div>
          </div>

          {/* フィルター */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6 grid grid-cols-2 md:grid-cols-5 gap-3">
            <input type="text" placeholder="会社名・回答者で検索" value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm col-span-2 md:col-span-1" />
            <select value={industryFilter} onChange={e => setIndustryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="">業界：すべて</option>
              {industries.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
            <select value={phaseFilter} onChange={e => setPhaseFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="">フェーズ：すべて</option>
              {phases.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={sortField} onChange={e => setSortField(e.target.value as SortField)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="created_at">日時順</option>
              <option value="company_name">会社名順</option>
              <option value="avg_score">スコア順</option>
            </select>
            <button onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm">
              {sortOrder === 'desc' ? '↓ 降順' : '↑ 昇順'}
            </button>
          </div>

          {/* テーブル */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700">
                  {['日時','会社名','回答者','スコア','解放状態','壁打ちメモ','操作'].map(h => (
                    <th key={h} className="p-3 text-left border border-gray-200 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAssessments.length === 0 ? (
                  <tr><td colSpan={7} className="p-6 text-center text-gray-400">データがありません</td></tr>
                ) : filteredAssessments.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50 border-b border-gray-100">
                    <td className="p-3 text-gray-500 whitespace-nowrap">
                      {new Date(a.created_at).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="p-3 font-medium text-gray-900">{a.company_name}</td>
                    <td className="p-3 text-gray-600">
                      <div>{a.respondent_name}</div>
                      <div className="text-xs text-gray-400">{a.respondent_email}</div>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`font-bold text-lg ${(a.avg_score || 0) >= 4 ? 'text-green-600' : (a.avg_score || 0) >= 3 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {(a.avg_score || 0).toFixed(1)}
                      </span>
                    </td>

                    {/* 解放フラグ */}
                    <td className="p-3 text-center">
                      <button onClick={() => toggleUnlock(a.id, a.stage2_unlocked)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                          a.stage2_unlocked
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}>
                        {a.stage2_unlocked ? '🔓 解放済み' : '🔒 ロック中'}
                      </button>
                    </td>

                    {/* 壁打ちメモ */}
                    <td className="p-3">
                      <button onClick={() => setMemoModal({ id: a.id, memo: a.consultation_memo || '' })}
                        className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-medium">
                        {a.consultation_memo ? '📝 編集' : '📝 追加'}
                      </button>
                    </td>

                    {/* 操作 */}
                    <td className="p-3">
                      <div className="flex gap-2 flex-wrap">
                        <a href={`/results/${a.id}`} target="_blank"
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium">
                          詳細
                        </a>
                        <button onClick={() => sendReportEmail(a)}
                          disabled={sendingEmail === a.id || !a.respondent_email}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium disabled:opacity-40">
                          {sendingEmail === a.id ? '送信中...' : '📧 送信'}
                        </button>
                        <button onClick={() => handleDelete(a.id)}
                          className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium">
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 壁打ちメモモーダル */}
      {memoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-bold text-gray-900 mb-4">💬 壁打ちメモ</h3>
            <textarea
              value={memoModal.memo}
              onChange={e => setMemoModal({ ...memoModal, memo: e.target.value })}
              className="w-full p-4 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-purple-400"
              rows={8}
              placeholder="壁打きセッションの内容・気づき・次のアクションを記録してください"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setMemoModal(null)}
                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium">
                キャンセル
              </button>
              <button onClick={saveMemo}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium">
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
