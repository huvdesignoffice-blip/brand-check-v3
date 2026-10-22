'use client';
import { useState, useRef, Suspense } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

// =====================================================================
// Brand Check 診断フォーム
// デザイン：ネイビー × 白（診断レポートと同じトーン）
// 送信処理（Supabase保存・通知メール・AI分析・完了ページ遷移）は従来どおり
// =====================================================================

const NAVY = '#0f2044';

const QUESTIONS = [
  { id: 'q1_target_insight', label: 'ターゲット理解', layer: 'ブランド基盤', description: '自社のターゲット顧客について、年齢・性別などの属性だけでなく、価値観・悩み・本音（インサイト）まで言語化できている。' },
  { id: 'q2_brand_story', label: 'ブランドストーリー／WHY', layer: 'ブランド基盤', description: '「なぜこの事業をするのか」という創業背景・存在意義が言語化され、社内外に一貫して伝えられている。' },
  { id: 'q3_brand_personality', label: 'ブランドパーソナリティ', layer: 'ブランド基盤', description: 'ブランドの性格・人格・話し方のトーンが定義され、コミュニケーション全体に一貫して反映されている。' },
  { id: 'q4_competitive_analysis', label: '競合分析', layer: '戦略設計', description: '主な競合と自社の違いを、根拠をもって言語化して説明できる。' },
  { id: 'q5_self_analysis', label: '自社分析', layer: '戦略設計', description: '自社の強み・弱みを、第三者に説明できるレベルで把握・整理している。' },
  { id: 'q6_value_proposition', label: '価値提案', layer: '戦略設計', description: '自社が「誰に・どんな価値を・なぜ提供できるのか」が明文化され、伝わる形になっている。' },
  { id: 'q7_uniqueness', label: '独自性', layer: '戦略設計', description: '競合が簡単には真似できない「独自の意味・世界観・提供方法」が存在する。' },
  { id: 'q8_product_uniqueness', label: '商品・サービス独自性反映', layer: '実行・浸透', description: '提供する商品・サービスが、ブランドの独自性を反映し、ペルソナの真のお困りごとを解決できている。' },
  { id: 'q9_communication', label: 'コミュニケーション一貫性', layer: '実行・浸透', description: 'ブランドのメッセージが、Web・SNS・営業・採用などすべての接点で一貫している。' },
  { id: 'q10_inner_branding', label: 'インナーブランディング', layer: '実行・浸透', description: '社員がブランドの価値・理念を理解し、日常の業務や顧客対応の中で体現している。' },
  { id: 'q11_kpi', label: 'KPI設定と成果確認', layer: '実行・浸透', description: 'ブランドに関する目標（KPI）を設定し、施策の効果を定期的に確認・改善している。' },
  { id: 'q12_guideline', label: 'ブランドガイドライン整備', layer: '実行・浸透', description: 'ブランドを一貫して体現するための基準（ロゴ・カラー・言語表現・行動指針等）がガイドラインとして整備され、社内外で運用されている。' },
];

const LAYERS = [
  { name: 'ブランド基盤', range: 'Q1–Q3', note: '戦略' },
  { name: '戦略設計', range: 'Q4–Q7', note: '戦略' },
  { name: '実行・浸透', range: 'Q8–Q12', note: '手段と成果' },
];

const SCALE_LABELS = ['当てはまらない', 'あまり当てはまらない', 'どちらともいえない', 'やや当てはまる', '当てはまる'];

const BUSINESS_PHASES = ['構想中', '売り出し中', '成長中', '見直し中'];

const REVENUE_SCALES = [
  '1億円未満', '1〜3億円', '3〜10億円', '10〜30億円', '30〜100億円', '100億円以上', '分からない／回答したくない',
];

const INDUSTRIES = [
  "ソフトウェア開発", "SaaS・クラウドサービス", "Web制作・デザイン", "システムインテグレーション", "ITコンサルティング", "セキュリティ",
  "食品製造", "繊維・アパレル製造", "化学・医薬品製造", "金属・機械製造", "電子部品・デバイス製造", "自動車・輸送機器製造",
  "百貨店・総合小売", "専門小売（食品）", "専門小売（アパレル）", "専門小売（家電・雑貨）", "EC・オンライン販売", "卸売",
  "飲食店（レストラン）", "カフェ・喫茶店", "居酒屋・バー", "ホテル・旅館", "民泊", "観光・レジャー施設",
  "建設・土木", "建築設計", "不動産売買・仲介", "不動産管理", "リフォーム・リノベーション",
  "病院・クリニック", "歯科医院", "介護・福祉施設", "薬局・ドラッグストア", "整体・鍼灸",
  "学習塾・予備校", "語学教室", "専門学校・各種スクール", "企業研修", "オンライン教育",
  "銀行・信用金庫", "証券", "保険", "ファイナンス",
  "法律事務所", "会計・税理士事務所", "人材紹介・派遣",
  "経営コンサルティング", "マーケティング・PR", "広告代理店", "デザイン事務所",
  "運輸・物流", "美容・エステ", "フィットネス・スポーツ", "清掃・メンテナンス", "イベント・企画", "放送・映像制作", "その他",
];

const CHALLENGE_CATEGORIES = [
  { title: 'ブランド戦略', options: ['ブランドの方向性が定まっていない', '競合との差別化ができていない', 'ターゲット顧客が明確でない', '価値提案が言語化できていない'] },
  { title: '認知・集客', options: ['新規顧客の獲得が難しい', 'SNS・Web集客がうまくいかない', '口コミ・紹介が少ない', '広告効果が出ない'] },
  { title: '組織・人材', options: ['採用がうまくいかない', '離職率が高い', '社員のモチベーションが低い', 'ブランド理念が社内に浸透していない'] },
  { title: '売上・収益', options: ['売上が伸び悩んでいる', '価格競争に巻き込まれている', 'リピーターが増えない', '単価が上げられない'] },
];

// ---------------------------------------------------------------------
// 共通の見た目
// ---------------------------------------------------------------------

const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 transition focus:border-[#0f2044] focus:outline-none focus:ring-1 focus:ring-[#0f2044]';

function SectionHeading({ no, title, lead }: { no: string; title: string; lead?: string }) {
  return (
    <div className="mb-8 grid grid-cols-[2.25rem_1fr] items-baseline">
      <span className="font-mono text-xs tracking-[0.2em] text-slate-400">{no}</span>
      <h2 className="text-xl font-semibold tracking-wide text-slate-900 sm:text-2xl">{title}</h2>
      {lead && <p className="col-start-2 mt-3 text-sm leading-relaxed text-slate-500">{lead}</p>}
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
        {label}
        {required ? (
          <span className="text-[11px] font-normal tracking-wider text-slate-400">必須</span>
        ) : (
          <span className="text-[11px] font-normal tracking-wider text-slate-300">任意</span>
        )}
      </label>
      {children}
      {hint && <p className="mt-2 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------
// 本体
// ---------------------------------------------------------------------

function SurveyPageInner() {
  const searchParams = useSearchParams();
  const partnerId = searchParams.get('partner');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const basicRef = useRef<HTMLElement>(null);

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
    mission: '',
    vision_future: '',
    other_challenge: '',
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

  const answeredCount = Object.values(scores).filter((s) => s > 0).length;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleScoreChange = (questionId: string, score: number) => {
    setScores({ ...scores, [questionId]: score });
  };

  const handleChallengeToggle = (challenge: string) => {
    if (challenge === 'その他') {
      setShowOtherChallenge(!showOtherChallenge);
      if (showOtherChallenge) {
        setSelectedChallenges(selectedChallenges.filter((c) => c !== 'その他'));
        setFormData({ ...formData, other_challenge: '' });
      } else {
        setSelectedChallenges([...selectedChallenges, 'その他']);
      }
    } else {
      if (selectedChallenges.includes(challenge)) {
        setSelectedChallenges(selectedChallenges.filter((c) => c !== challenge));
      } else {
        setSelectedChallenges([...selectedChallenges, challenge]);
      }
    }
  };

  const validateForm = () => {
    setShowErrors(true);
    if (!formData.company_name || !formData.respondent_name || !formData.respondent_email) {
      setFormError('企業名・回答者名・メールアドレスをご入力ください。');
      basicRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return false;
    }
    if (!formData.business_phase) {
      setFormError('事業フェーズをお選びください。');
      basicRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return false;
    }
    const firstUnanswered = QUESTIONS.find((q) => !scores[q.id]);
    if (firstUnanswered) {
      setFormError(`未回答の設問があります（残り${12 - answeredCount}問）。`);
      document.getElementById(firstUnanswered.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    if (!agreedToPrivacy) {
      setFormError('個人情報保護方針への同意をお願いいたします。');
      return false;
    }
    setFormError(null);
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
        .insert([{
          ...formData,
          challenges: selectedChallenges,
          ...scores,
          ...(partnerId ? { partner_id: partnerId } : {}),
        }])
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      // 管理者・パートナーにメール通知
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
            partner_id: partnerId,
          }),
        });
      } catch (emailError) {
        console.error('Email notification failed:', emailError);
      }

      // AI分析を実行
      try {
        const aiResponse = await fetch('/api/analyze-with-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resultId: data.id,
            scores: [
              data.q1_target_insight, data.q2_brand_story, data.q3_brand_personality,
              data.q4_competitive_analysis, data.q5_self_analysis, data.q6_value_proposition,
              data.q7_uniqueness, data.q8_product_uniqueness, data.q9_communication,
              data.q10_inner_branding, data.q11_kpi, data.q12_guideline,
            ],
            memo: `【企業理念】\n${data.mission || '未記入'}\n\n【3〜5年後のビジョン】\n${data.vision_future || '未記入'}\n\n【課題】\n${data.challenges?.join('、') || '未選択'}${data.other_challenge ? `\nその他: ${data.other_challenge}` : ''}`,
            businessPhase: data.business_phase,
            companyName: data.company_name,
          }),
        });

        if (aiResponse.ok) {
          const aiReport = await aiResponse.json();
          await supabase.from('survey_results').update({ ai_report: aiReport }).eq('id', data.id);
        } else {
          console.error('AI analysis failed:', await aiResponse.text());
        }
      } catch (aiError) {
        console.error('AI analysis failed:', aiError);
      }

      router.push('/thank-you');
    } catch (error) {
      console.error('Error submitting survey:', error);
      setFormError('送信できませんでした。時間をおいて、もう一度お試しください。');
      setLoading(false);
    }
  };

  const missing = (v: string) => showErrors && !v;

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-slate-900">
      {/* 進捗（上部に固定） */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-5 py-3">
          <span className="text-[11px] font-semibold tracking-[0.25em]" style={{ color: NAVY }}>
            BRAND CHECK
          </span>
          <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(answeredCount / 12) * 100}%`, backgroundColor: NAVY }} />
          </div>
          <span className="font-mono text-xs tabular-nums text-slate-500">{answeredCount} / 12</span>
        </div>
      </div>

      {/* 表紙 */}
      <header className="text-white" style={{ backgroundColor: NAVY }}>
        <div className="mx-auto max-w-3xl px-5 pb-14 pt-16 sm:pb-20 sm:pt-24">
          <p className="text-[11px] font-medium tracking-[0.3em] text-blue-200/80">BRAND CHECK ASSESSMENT</p>
          <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-wide sm:text-[2.6rem]">ブランドチェック診断</h1>
          <p className="mt-6 max-w-xl text-[15px] leading-loose text-blue-100/90">
            12の設問を通じて、ブランドの上流にある戦略から、下流の手段と成果まで、ひとつの流れとしてつながっているかを確認します。
          </p>
          <dl className="mt-10 grid max-w-md grid-cols-3 border-t border-white/15 pt-6 text-sm">
            <div>
              <dt className="text-[11px] tracking-wider text-blue-200/70">所要時間</dt>
              <dd className="mt-1 font-medium">約5分</dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-wider text-blue-200/70">設問数</dt>
              <dd className="mt-1 font-medium">12問</dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-wider text-blue-200/70">診断結果</dt>
              <dd className="mt-1 font-medium">メールでお届け</dd>
            </div>
          </dl>
        </div>
      </header>

      <form onSubmit={handleSubmit} noValidate className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <div className="space-y-6">
          {/* 01 基本情報 */}
          <section ref={basicRef} className="scroll-mt-20 rounded-lg border border-slate-200 bg-white px-6 py-10 sm:px-10">
            <SectionHeading no="01" title="基本情報" />
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="企業名" required>
                  <input type="text" name="company_name" value={formData.company_name} onChange={handleInputChange} autoComplete="organization"
                    className={`${inputClass} ${missing(formData.company_name) ? 'border-amber-500' : ''}`} />
                </Field>
              </div>
              <Field label="回答者名" required>
                <input type="text" name="respondent_name" value={formData.respondent_name} onChange={handleInputChange} autoComplete="name"
                  className={`${inputClass} ${missing(formData.respondent_name) ? 'border-amber-500' : ''}`} />
              </Field>
              <Field label="メールアドレス" required hint="診断結果をお送りします">
                <input type="email" name="respondent_email" value={formData.respondent_email} onChange={handleInputChange} autoComplete="email"
                  className={`${inputClass} ${missing(formData.respondent_email) ? 'border-amber-500' : ''}`} />
              </Field>
              <Field label="業種">
                <select name="industry" value={formData.industry} onChange={handleInputChange} className={inputClass}>
                  <option value="">選択してください</option>
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </Field>
              <Field label="売上規模（年間）">
                <select name="revenue_scale" value={formData.revenue_scale} onChange={handleInputChange} className={inputClass}>
                  <option value="">選択してください</option>
                  {REVENUE_SCALES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="事業フェーズ" required>
                  <div className={`grid grid-cols-2 gap-2 sm:grid-cols-4 ${missing(formData.business_phase) ? 'rounded-md ring-1 ring-amber-500 ring-offset-4' : ''}`}>
                    {BUSINESS_PHASES.map((p) => {
                      const active = formData.business_phase === p;
                      return (
                        <button key={p} type="button" onClick={() => setFormData({ ...formData, business_phase: p })} aria-pressed={active}
                          className={`rounded-md border px-3 py-3 text-sm transition ${
                            active ? 'border-[#0f2044] bg-[#0f2044] text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500'
                          }`}>
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </div>
            </div>
          </section>

          {/* 02 理念とビジョン */}
          <section className="rounded-lg border border-slate-200 bg-white px-6 py-10 sm:px-10">
            <SectionHeading no="02" title="理念とビジョン" lead="入力いただくと、診断結果の中で設問の回答と照らし合わせます。" />
            <div className="space-y-6">
              <Field label="企業理念・大切にしている価値観">
                <textarea name="mission" value={formData.mission} onChange={handleInputChange} rows={3} className={inputClass}
                  placeholder="例：お客様の人生に寄り添い、心から信頼される存在でありたい" />
              </Field>
              <Field label="3〜5年後に目指している姿">
                <textarea name="vision_future" value={formData.vision_future} onChange={handleInputChange} rows={3} className={inputClass}
                  placeholder="例：地域で一番選ばれる工務店になる／3年後に売上10億円を突破する" />
              </Field>
            </div>
          </section>

          {/* 03 現在の課題 */}
          <section className="rounded-lg border border-slate-200 bg-white px-6 py-10 sm:px-10">
            <SectionHeading no="03" title="現在の課題" lead="特に課題だと感じているものを、いくつでもお選びください。" />
            <div className="space-y-7">
              {CHALLENGE_CATEGORIES.map((category) => (
                <div key={category.title}>
                  <p className="mb-3 text-xs font-medium tracking-wider text-slate-500">{category.title}</p>
                  <div className="flex flex-wrap gap-2">
                    {category.options.map((option) => {
                      const active = selectedChallenges.includes(option);
                      return (
                        <button key={option} type="button" onClick={() => handleChallengeToggle(option)} aria-pressed={active}
                          className={`rounded-full border px-4 py-2 text-sm transition ${
                            active ? 'border-[#0f2044] bg-[#0f2044] text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500'
                          }`}>
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div>
                <p className="mb-3 text-xs font-medium tracking-wider text-slate-500">その他</p>
                <button type="button" onClick={() => handleChallengeToggle('その他')} aria-pressed={showOtherChallenge}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    showOtherChallenge ? 'border-[#0f2044] bg-[#0f2044] text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500'
                  }`}>
                  その他（自由記述）
                </button>
                {showOtherChallenge && (
                  <textarea name="other_challenge" value={formData.other_challenge} onChange={handleInputChange} rows={3}
                    className={`${inputClass} mt-3`} placeholder="その他の課題を具体的にお書きください" />
                )}
              </div>
            </div>
          </section>

          {/* 04 診断項目 */}
          <section className="rounded-lg border border-slate-200 bg-white px-6 py-10 sm:px-10">
            <SectionHeading no="04" title="診断項目" lead="それぞれ、現在の状況に最も近いものをお選びください。1は「当てはまらない」、5は「当てはまる」です。" />

            {LAYERS.map((layer) => (
              <div key={layer.name} className="mt-10 first:mt-0">
                <div className="mb-2 flex items-baseline justify-between border-b pb-3" style={{ borderColor: NAVY }}>
                  <p className="text-sm font-semibold tracking-wider" style={{ color: NAVY }}>{layer.name}</p>
                  <p className="text-xs text-slate-400">{layer.range}・{layer.note}</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {QUESTIONS.map((q, index) => ({ q, index }))
                    .filter(({ q }) => q.layer === layer.name)
                    .map(({ q, index }) => {
                      const value = scores[q.id];
                      const unanswered = showErrors && !value;
                      return (
                        <div key={q.id} id={q.id}
                          className={`grid scroll-mt-24 grid-cols-[2.25rem_1fr] items-baseline py-7 ${unanswered ? 'border-l-2 border-l-amber-500 pl-4' : ''}`}>
                          <span className="font-mono text-xs tabular-nums text-slate-400">Q{String(index + 1).padStart(2, '0')}</span>
                          <h3 className="text-[17px] font-semibold text-slate-900">{q.label}</h3>
                          <p className="col-start-2 mt-2 text-sm leading-relaxed text-slate-600">{q.description}</p>
                          <div className="col-span-2 mt-5 sm:col-span-1 sm:col-start-2">
                            <div role="radiogroup" aria-label={q.label} className="grid grid-cols-5 overflow-hidden rounded-md border border-slate-300">
                              {[1, 2, 3, 4, 5].map((score) => {
                                const active = value === score;
                                return (
                                  <button key={score} type="button" role="radio" aria-checked={active} aria-label={`${score}：${SCALE_LABELS[score - 1]}`}
                                    onClick={() => handleScoreChange(q.id, score)}
                                    className={`h-11 border-l border-slate-300 text-sm font-medium tabular-nums transition first:border-l-0 ${
                                      active ? 'bg-[#0f2044] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                                    }`}>
                                    {score}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="mt-2 flex justify-between text-[11px] text-slate-400">
                              <span>当てはまらない</span>
                              <span>当てはまる</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </section>
        </div>

        {/* 同意と送信 */}
        <div className="mt-10">
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-slate-600">
            <input type="checkbox" checked={agreedToPrivacy} onChange={(e) => setAgreedToPrivacy(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-[#0f2044]" />
            <span>
              <a href="https://huvdesignoffice.com/privacy-policy" target="_blank" rel="noopener noreferrer"
                className="font-medium underline underline-offset-2" style={{ color: NAVY }}>個人情報保護方針</a>
              に同意します。入力いただいた情報は、診断結果の提供およびサービス改善の目的にのみ使用します。
            </span>
          </label>

          {formError && (
            <p className="mt-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">{formError}</p>
          )}

          <button type="submit" disabled={loading}
            className="mt-6 w-full rounded-md py-4 text-[15px] font-semibold tracking-wider text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: NAVY }}>
            {loading ? '送信しています…' : '診断結果を受け取る'}
          </button>
          <p className="mt-3 text-center text-xs text-slate-400">回答内容をもとに診断レポートを作成し、ご入力のメールアドレスにお送りします</p>
        </div>
      </form>

      {/* フッター（ロゴは控えめに） */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-5 py-10">
          <Image src="/variation logo_1.png" alt="HUV DESIGN OFFICE" width={80} height={32} unoptimized
            className="h-7 w-auto object-contain opacity-60 grayscale" />
          <p className="text-[11px] tracking-wider text-slate-400">© {new Date().getFullYear()} HUV DESIGN OFFICE Inc.</p>
        </div>
      </footer>
    </div>
  );
}

export default function SurveyPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#f7f8fa] text-sm text-slate-500">読み込み中…</div>}>
      <SurveyPageInner />
    </Suspense>
  );
}
