"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PartnerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/partner/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        sessionStorage.setItem("partner_session", JSON.stringify(data.partner));
        router.push("/partner/dashboard");
      } else {
        setError(data.error || "ログインに失敗しました");
      }
    } catch {
      setError("ログインエラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    setResetLoading(true);
    try {
      const res = await fetch("/api/partner/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });
      if (res.ok) {
        setResetSent(true);
      } else {
        const data = await res.json();
        setError(data.error || "送信に失敗しました");
      }
    } catch {
      setError("エラーが発生しました");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🤝</div>
          <h1 className="text-2xl font-bold text-gray-900">
            {resetMode ? "パスワードをリセット" : "パートナーログイン"}
          </h1>
          <p className="text-gray-500 text-sm mt-1">Brand Check パートナーポータル</p>
        </div>

        {/* ログインフォーム */}
        {!resetMode && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                placeholder="partner@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                placeholder="••••••••" />
            </div>
            {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50">
              {loading ? "ログイン中..." : "ログイン"}
            </button>
            <div className="text-center">
              <button type="button" onClick={() => { setResetMode(true); setError(""); }}
                className="text-sm text-indigo-600 hover:text-indigo-800 underline">
                パスワードをお忘れですか？
              </button>
            </div>
          </form>
        )}

        {/* パスワードリセットフォーム */}
        {resetMode && !resetSent && (
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <p className="text-sm text-gray-600 bg-blue-50 p-4 rounded-lg">
              登録済みのメールアドレスを入力してください。パスワードリセット用のリンクをお送りします。
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
              <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                placeholder="partner@example.com" />
            </div>
            {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}
            <button type="submit" disabled={resetLoading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50">
              {resetLoading ? "送信中..." : "リセットメールを送信"}
            </button>
            <div className="text-center">
              <button type="button" onClick={() => { setResetMode(false); setError(""); }}
                className="text-sm text-gray-500 hover:text-gray-700 underline">
                ログインに戻る
              </button>
            </div>
          </form>
        )}

        {/* 送信完了 */}
        {resetMode && resetSent && (
          <div className="text-center space-y-4">
            <div className="text-5xl mb-3">📧</div>
            <p className="text-gray-700 font-medium">リセットメールを送信しました</p>
            <p className="text-sm text-gray-500">{resetEmail} 宛にパスワードリセット用のリンクをお送りしました。メールをご確認ください。</p>
            <button onClick={() => { setResetMode(false); setResetSent(false); setError(""); }}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors">
              ログインに戻る
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
