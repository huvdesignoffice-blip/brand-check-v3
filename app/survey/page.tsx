'use client';
import { useState, useEffect, Suspense } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
const QUESTIONS = [
  {
    id: 'q1_target_insight',
    label: 'ターゲット理解',
    layer: 'ブランド基盤',
    description: '自社のターゲット顧客について、年齢・性別などの属性だけでなく、価値観・悩み・本音（インサイト）まで言語化できている。',
  },
  {
    id: 'q2_brand_story',
    label: 'ブランドストーリー／WHY',
    layer: 'ブランド基盤',
    description: '「なぜこの事業をするのか」という創業背景・存在意義が言語化され、社内外に一貫して伝えられている。',
  },
  {
    id: 'q3_brand_personality',
    label: 'ブランドパーソナリティ',
    layer: 'ブランド基盤',
    description: 'ブランドの性格・人格・話し方のトーンが定義され、コミュニケーション全体に一貫して反映されている。',
  },
  {
    id: 'q4_competitive_analysis',
    label: '競合分析',
    layer: '戦略設計',
    description: '主な競合と自社の違いを、根拠をもって言語化して説明できる。',
  },
  {
    id: 'q5_self_analysis',
    label: '自社分析',
    layer: '戦略設計',
    description: '自社の強み・弱みを、第三者に説明できるレベルで把握・整理している。',
  },
  {
    id: 'q6_value_proposition',
    label: '価値提案',
    layer: '戦略設計',
    description: '自社が「誰に・どんな価値を・なぜ提供できるのか」が明文化され、伝わる形になっている。',
  },
  {
    id: 'q7_uniqueness',
    label: '独自性',
    layer: '戦略設計',
    description: '競合が簡単には真似できない「独自の意味・世界観・提供方法」が存在する。',
  },
  {
    id: 'q8_product_uniqueness',
    label: '商品・サービス独自性反映',
    layer: '実行・浸透',
    description: '提供する商品・サービスが、ブランドの独自性を反映し、ペルソナの真のお困りごとを解決できている。',
  },
  {
    id: 'q9_communication',
    label: 'コミュニケーション一貫性',
    layer: '実行・浸透',
    description: 'ブランドのメッセージが、Web・SNS・営業・採用などすべての接点で一貫している。',
  },
  {
    id: 'q10_inner_branding',
    label: 'インナーブランディング',
    layer: '実行・浸透',
    description: '社員がブランドの価値・理念を理解し、日常の業務や顧客対応の中で体現している。',
  },
  {
    id: 'q11_kpi',
    label: 'KPI設定と成果確認',
    layer: '実行・浸透',
    description: 'ブランドに関する目標（KPI）を設定し、施策の効果を定期的に確認・改善している。',
  },
  {
    id: 'q12_guideline',
    label: 'ブランドガイドライン整備',
    layer: '実行・浸透',
    description: 'ブランドを一貫して体現するための基準（ロゴ・カラー・言語表現・行動指針等）がガイドラインとして整備され、社内外で運用されている。',
  },
];

const BUSINESS_PHASES = ['構想中', '売り出し中', '成長中', '見直し中'];

const REVENUE_SCALES = [
  '1億円未満',
  '1〜3億円',
  '3〜10億円',
  '10〜30億円',
  '30〜100億円',
  '100億円以上',
  '分からない／回答したくない',
];

const INDUSTRIES = [
  // IT・テクノロジー
  "ソフトウェア開発",
  "SaaS・クラウドサービス",
  "Web制作・デザイン",
  "システムインテグレーション",
  "ITコンサルティング",
  "セキュリティ",
  // 製造業
  "食品製造",
  "繊維・アパレル製造",
  "化学・医薬品製造",
  "金属・機械製造",
  "電子部品・デバイス製造",
  "自動車・輸送機器製造",
  // 小売・EC
  "百貨店・総合小売",
  "専門小売（食品）",
  "専門小売（アパレル）",
  "専門小売（家電・雑貨）",
  "EC・オンライン販売",
  "卸売",
  // 飲食・宿泊
  "飲食店（レストラン）",
  "カフェ・喫茶店",
  "居酒屋・バー",
  "ホテル・旅館",
  "民泊",
  "観光・レジャー施設",
  // 建設・不動産
  "建設・土木",
  "建築設計",
  "不動産売買・仲介",
  "不動産管理",
  "リフォーム・リノベーション",
  // 医療・福祉
  "病院・クリニック",
  "歯科医院",
  "介護・福祉施設",
  "薬局・ドラッグストア",
  "整体・鍼灸",
  // 教育
  "学習塾・予備校",
  "語学教室",
  "専門学校・各種スクール",
  "企業研修",
  "オンライン教育",
  // 金融・保険
  "銀行・信用金庫",
  "証券",
  "保険",
  "ファイナンス",
  // 専門サービス
  "経営コンサルティング",
  "マーケティング・PR",
  "広告代理店",
  "デザイン事務所",
  "法律事務所",
  "会計・税理士事務所",
  "人材紹介・派遣",
  // その他
  "運輸・物流",
  "美容・エステ",
  "フィットネス・スポーツ",
  "清掃・メンテナンス",
  "イベント・企画",
  "その他",
];

// 課題の選択肢（カテゴリー別）
const CHALLENGE_CATEGORIES = [
  {
    title: '売上・市場での立ち位置',
    options: [
      '認知・知名度不足',
      '価格競争からの脱却',
      '新規集客の低迷',
      'リピート率の向上',
    ],
  },
  {
    title: '戦略・差別化',
    options: [
      '強みの言語化・明確化',
      '競合との差別化',
      'ターゲット設定の曖昧さ',
    ],
  },
  {
    title: '組織・採用',
    options: [
      '採用ブランディング（人材獲得）',
      '社内の意識統一（理念浸透）',
      '事業承継・世代交代',
    ],
  },
  {
    title: 'クリエイティブ・発信',
    options: [
      'デザインの一貫性（ロゴ・Web等）',
      '情報発信・SNS運用',
    ],
  },
];

function SurveyPageInner() {
  const searchParams = useSearchParams();
  const partnerId = searchParams.get('partner');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [formData, setFormData] = useState({
    company_name: '',
    respondent_name: '',
    respondent_email: '',
    industry: '',
    business_phase: '',
    revenue_scale: '',
    mission: '',           // 企業理念
    vision_future: '',     // 3〜5年後のビジョン
    other_challenge: '',   // その他の課題
  });

  const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);
  const [showOtherChallenge, setShowOtherChallenge] = useState(false);

  const [scores, setScores] = useState<{ [key: string]: number }>({
    q1_target_insight: 0,
    q2_brand_story: 0,
    q3_brand_personality: 0,
    q4_competitive_analysis: 0,
    q5_self_analysis: 0,
    q6_value_proposition: 0,
    q7_uniqueness: 0,
    q8_product_uniqueness: 0,
    q9_communication: 0,
    q10_inner_branding: 0,
    q11_kpi: 0,
    q12_guideline: 0,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleScoreChange = (questionId: string, score: number) => {
    setScores({
      ...scores,
      [questionId]: score,
    });
  };

  const handleChallengeToggle = (challenge: string) => {
    if (challenge === 'その他') {
      setShowOtherChallenge(!showOtherChallenge);
      if (showOtherChallenge) {
        // その他のチェックを外す場合、選択肢からも削除
        setSelectedChallenges(selectedChallenges.filter(c => c !== 'その他'));
        setFormData({ ...formData, other_challenge: '' });
      } else {
        // その他をチェックする場合、選択肢に追加
        setSelectedChallenges([...selectedChallenges, 'その他']);
      }
    } else {
      if (selectedChallenges.includes(challenge)) {
        setSelectedChallenges(selectedChallenges.filter(c => c !== challenge));
      } else {
        setSelectedChallenges([...selectedChallenges, challenge]);
      }
    }
  };

  const validateForm = () => {
    if (!formData.company_name || !formData.respondent_name || !formData.respondent_email) {
      alert('企業名、回答者名、メールアドレスは必須です。');
      return false;
    }

    if (!formData.business_phase) {
      alert('事業フェーズを選択してください。');
      return false;
    }

    const allAnswered = Object.values(scores).every(score => score > 0);
    if (!allAnswered) {
      alert('すべての質問に回答してください。');
      return false;
    }

    if (!agreedToPrivacy) {
      alert('個人情報保護方針に同意してください。');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);

    try {
      // Supabaseにデータを保存
      const { data, error } = await supabase
        .from('survey_results')
        .insert([
          {
            ...formData,
            challenges: selectedChallenges,
            ...scores,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Success! Data:', data);

      // 管理者にメール通知を送信
      try {
        await fetch('/api/send-survey-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_name: data.company_name,
            respondent_name: data.respondent_name,
            respondent_email: data.respondent_email,
            industry: data.industry,
            revenue_scale: data.revenue_scale,
            business_phase: data.business_phase,
            avg_score: data.avg_score,
            result_id: data.id,
          }),
        });
        console.log('Email notification sent successfully');
      } catch (emailError) {
        console.error('Email notification failed:', emailError);
      }

      // AI分析を実行して結果を保存
      try {
        const aiResponse = await fetch('/api/analyze-with-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resultId: data.id,
            scores: [
              data.q1_target_insight,
              data.q2_brand_story,
              data.q3_brand_personality,
              data.q4_competitive_analysis,
              data.q5_self_analysis,
              data.q6_value_proposition,
              data.q7_uniqueness,
              data.q8_product_uniqueness,
              data.q9_communication,
              data.q10_inner_branding,
              data.q11_kpi,
              data.q12_guideline,
            ],
            memo: `【企業理念】\n${data.mission || '未記入'}\n\n【3〜5年後のビジョン】\n${data.vision_future || '未記入'}\n\n【課題】\n${data.challenges?.join('、') || '未選択'}${data.other_challenge ? `\nその他: ${data.other_challenge}` : ''}`,
            businessPhase: data.business_phase,
            companyName: data.company_name,
          }),
        });

        if (aiResponse.ok) {
          const aiReport = await aiResponse.json();
          
          const { error: updateError } = await supabase
            .from('survey_results')
            .update({ ai_report: aiReport })
            .eq('id', data.id);

          if (updateError) {
            console.error('Failed to save AI report:', updateError);
          } else {
            console.log('AI report saved successfully');
          }
        } else {
          console.error('AI analysis failed:', await aiResponse.text());
        }
      } catch (aiError) {
        console.error('AI analysis failed:', aiError);
      }

      // サンキューページにリダイレクト
      router.push('/thank-you');
    } catch (error) {
      console.error('Error submitting survey:', error);
      const errorMessage = error instanceof Error
        ? error.message
        : JSON.stringify(error);
      alert(`エラーが発生しました: ${errorMessage}`);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* ロゴ */}
        <div className="flex justify-center mb-8">
          <Image
            src="/variation logo_1.png"
            alt="HUV Design Office Logo"
            width={120}
            height={48}
            className="object-contain"
            priority
            style={{ width: 'auto', height: 'auto' }}
          />
        </div>

        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl shadow-lg p-8 mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">ブランドチェック診断</h1>
          <p className="text-blue-100">Brand Check Assessment</p>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-8 space-y-8">
          {/* 基本情報 */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-2 border-b-2 border-blue-200">基本情報</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  企業名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  回答者名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="respondent_name"
                  value={formData.respondent_name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  メールアドレス <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="respondent_email"
                  value={formData.respondent_email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <p className="mt-1 text-sm text-gray-500">診断結果をお送りするメールアドレスをご入力ください</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">業種</label>
                <select
                  name="industry"
                  value={formData.industry}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">選択してください</option>
                  {INDUSTRIES.map((industry) => (
                    <option key={industry} value={industry}>
                      {industry}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  事業フェーズ <span className="text-red-500">*</span>
                </label>
                <select
                  name="business_phase"
                  value={formData.business_phase}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">選択してください</option>
                  {BUSINESS_PHASES.map((phase) => (
                    <option key={phase} value={phase}>
                      {phase}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">売上規模（年間）</label>
                <select
                  name="revenue_scale"
                  value={formData.revenue_scale}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">選択してください</option>
                  {REVENUE_SCALES.map((scale) => (
                    <option key={scale} value={scale}>
                      {scale}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* ① 企業理念 */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-2 border-b-2 border-purple-200">① 企業理念</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                貴社の企業理念や大切にしている価値観をお聞かせください
              </label>
              <textarea
                name="mission"
                value={formData.mission}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="例：お客様の人生に寄り添い、心から信頼される存在でありたい"
              />
              <p className="mt-1 text-sm text-gray-500">※任意入力</p>
            </div>
          </section>

          {/* ② 3〜5年後のビジョン */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-2 border-b-2 border-purple-200">② 3〜5年後のビジョン</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                3〜5年後、どのような姿を目指していますか？
              </label>
              <textarea
                name="vision_future"
                value={formData.vision_future}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="例：地域で一番愛される工務店になりたい、3年後に売上10億円を突破したい、など自由にお書きください"
              />
              <p className="mt-1 text-sm text-gray-500">※任意入力</p>
            </div>
          </section>

          {/* ③ 課題 */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-2 border-b-2 border-purple-200">③ 現在の課題</h2>
            <p className="text-sm text-gray-600 mb-6">
              現在、特に課題だと感じていることを選択してください（複数選択可）
            </p>

            <div className="space-y-6">
              {CHALLENGE_CATEGORIES.map((category, catIndex) => (
                <div key={catIndex} className="bg-purple-50 rounded-lg p-5">
                  <h3 className="text-lg font-bold text-purple-900 mb-3">【{category.title}】</h3>
                  <div className="space-y-2">
                    {category.options.map((option) => (
                      <label key={option} className="flex items-center gap-3 cursor-pointer hover:bg-purple-100 p-2 rounded transition">
                        <input
                          type="checkbox"
                          checked={selectedChallenges.includes(option)}
                          onChange={() => handleChallengeToggle(option)}
                          className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                        <span className="text-gray-700">{option}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              {/* その他 */}
              <div className="bg-gray-50 rounded-lg p-5">
                <h3 className="text-lg font-bold text-gray-900 mb-3">【その他】</h3>
                <label className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 p-2 rounded transition mb-3">
                  <input
                    type="checkbox"
                    checked={showOtherChallenge}
                    onChange={() => handleChallengeToggle('その他')}
                    className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <span className="text-gray-700">その他（自由記述）</span>
                </label>

                {showOtherChallenge && (
                  <textarea
                    name="other_challenge"
                    value={formData.other_challenge}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="その他の課題を具体的にお書きください"
                  />
                )}
              </div>
            </div>
          </section>

          {/* ④ 診断質問 */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-2 border-b-2 border-blue-200">④ 診断項目</h2>
            <p className="text-sm text-gray-600 mb-6">
              各項目について、現在の状況に最も近いものを5段階で評価してください。
              <br />
              <strong>1 = まったく当てはまらない</strong>　〜　<strong>5 = 完全に当てはまる</strong>
            </p>

            <div className="space-y-6">
              {QUESTIONS.map((question, index) => (
                <div key={question.id} className="bg-gray-50 rounded-lg p-6">
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-blue-600">Q{index + 1}</span>
                      <h3 className="text-lg font-bold text-gray-900">{question.label}</h3>
                    </div>
                    <p className="text-sm text-gray-600">{question.description}</p>
                  </div>

                  <div className="flex justify-center gap-4">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => handleScoreChange(question.id, score)}
                        className={`w-12 h-12 rounded-full font-bold transition-all ${
                          scores[question.id] === score
                            ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg scale-110'
                            : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-blue-400'
                        }`}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* プライバシーポリシー */}
          <section className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="privacy"
                checked={agreedToPrivacy}
                onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="privacy" className="text-sm text-gray-700">
                <a
                  href="/privacy"
                  target="_blank"
                  className="text-blue-600 hover:underline font-medium"
                >
                  個人情報保護方針
                </a>
                に同意する <span className="text-red-500">*</span>
              </label>
            </div>
          </section>

          {/* 送信ボタン */}
          <div className="flex justify-center">
            <button
              type="submit"
              disabled={loading}
              className={`px-12 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-lg font-bold rounded-lg shadow-lg transition-all ${
                loading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
              }`}
            >
              {loading ? '送信中...' : '診断結果を送信'}
            </button>
          </div>
        </form>

        {/* フッター */}
        <div className="text-center text-gray-600 text-sm mt-8">
          <p>© 2025 HUV DESIGN OFFICE</p>
        </div>
      </div>
    </div>
  );
}


export default function SurveyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-xl">読み込み中...</div></div>}>
      <SurveyPageInner />
    </Suspense>
  );
}


