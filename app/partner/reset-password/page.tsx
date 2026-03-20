"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const t = searchParams.get("token");
    if (!t) { router.push("/partner/login"); return; }
    setToken(t);
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("パスワードは8文字以上で入力してください"); return; }
    if (password !== confirm) { setError("パスワードが一致しません"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/partner/reset-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) { setSuccess(true); }
      else { setError(data.error || "エラーが発生しました"); }
    } catch {
      setError("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
      <div className="text-center mb-8">
        <div className="text-4xl mb-3">🔐</div>
        <h1 className="text-2xl font-bold text-gray-900">新しいパスワードを設定</h1>
        <p className="text-gray-500 text-sm mt-1">Brand Check パートナーポータル</p>
      </div>

      {!success ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              placeholder="8文字以上" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード（確認）</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              placeholder="もう一度入力してください" />
          </div>
          {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50">
            {loading ? "更新中..." : "パスワードを更新する"}
          </button>
        </form>
      ) : (
        <div className="text-center space-y-4">
          <div className="text-5xl mb-3">✅</div>
          <p className="text-gray-700 font-medium">パスワードを更新しました</p>
          <button onClick={() => router.push("/partner/login")}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors">
            ログインページへ
          </button>
        </div>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center px-4">
      <Suspense fallback={<div className="text-gray-500">読み込み中...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
