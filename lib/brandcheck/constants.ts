// =====================================================================
// Brand Check v3 — レポート用の定数（設問・領域・課題対応表・色）
// ここを書き換えるだけで、判定ロジックと表示がまとめて変わります。
// =====================================================================

export const BOOKING_URL = "https://timerex.net/s/huvdesignoffice_50ec/6cdca60c";

export type DomainKey = "foundation" | "strategy" | "execution";

export const DOMAINS: { key: DomainKey; label: string; questions: number[] }[] = [
  { key: "foundation", label: "ブランド基盤", questions: [1, 2, 3] },
  { key: "strategy", label: "戦略設計", questions: [4, 5, 6, 7] },
  { key: "execution", label: "実行・浸透", questions: [8, 9, 10, 11, 12] },
];

export type QuestionDef = {
  no: number;
  title: string;
  description: string;
  domain: DomainKey;
};

// 現在のアンケート（v2.2）の設問文そのまま
export const QUESTIONS: QuestionDef[] = [
  { no: 1, title: "ターゲット理解", domain: "foundation", description: "自社のターゲット顧客について、年齢・性別などの属性だけでなく、価値観・悩み・本音（インサイト）まで言語化できている。" },
  { no: 2, title: "ブランドストーリー／WHY", domain: "foundation", description: "「なぜこの事業をするのか」という創業背景・存在意義が言語化され、社内外に一貫して伝えられている。" },
  { no: 3, title: "ブランドパーソナリティ", domain: "foundation", description: "ブランドの性格・人格・話し方のトーンが定義され、コミュニケーション全体に一貫して反映されている。" },
  { no: 4, title: "競合分析", domain: "strategy", description: "主な競合と自社の違いを、根拠をもって言語化して説明できる。" },
  { no: 5, title: "自社分析", domain: "strategy", description: "自社の強み・弱みを、第三者に説明できるレベルで把握・整理している。" },
  { no: 6, title: "価値提案", domain: "strategy", description: "自社が「誰に・どんな価値を・なぜ提供できるのか」が明文化され、伝わる形になっている。" },
  { no: 7, title: "独自性", domain: "strategy", description: "競合が簡単には真似できない「独自の意味・世界観・提供方法」が存在する。" },
  { no: 8, title: "商品・サービス独自性反映", domain: "execution", description: "提供する商品・サービスが、ブランドの独自性を反映し、ペルソナの真のお困りごとを解決できている。" },
  { no: 9, title: "コミュニケーション一貫性", domain: "execution", description: "ブランドのメッセージが、Web・SNS・営業・採用などすべての接点で一貫している。" },
  { no: 10, title: "インナーブランディング", domain: "execution", description: "社員がブランドの価値・理念を理解し、日常の業務や顧客対応の中で体現している。" },
  { no: 11, title: "KPI設定と成果確認", domain: "execution", description: "ブランドに関する目標（KPI）を設定し、施策の効果を定期的に確認・改善している。" },
  { no: 12, title: "ブランドガイドライン整備", domain: "execution", description: "ブランドを一貫して体現するための基準（ロゴ・カラー・言語表現・行動指針等）がガイドラインとして整備され、社内外で運用されている。" },
];

export const qTitle = (no: number) => QUESTIONS[no - 1]?.title ?? `Q${no}`;

// Q1が3以下のときに、レポートで示す連鎖の順番
export const Q1_CHAIN = [1, 3, 9, 10, 11];
export const Q1_THRESHOLD = 3; // Q1 <= 3 で「土台が伴っていない可能性」モード

// ---------------------------------------------------------------------
// 横の一貫性：上流 → 下流 の組み合わせ
// 下流の点数が上流より2点以上高いとき「土台を超えた高評価」として矛盾に数える
// ---------------------------------------------------------------------
export type ContradictionPair = { up: number; down: number; note: string };

export const CONTRADICTION_PAIRS: ContradictionPair[] = [
  { up: 1, down: 6, note: "「誰に」の解像度に対して、価値提案の評価が先行している" },
  { up: 1, down: 7, note: "ターゲットの理解に対して、独自性の評価が先行している" },
  { up: 1, down: 8, note: "ターゲットの理解に対して、商品・サービスへの反映の評価が先行している" },
  { up: 4, down: 6, note: "競合との違いの整理に対して、価値提案の評価が先行している" },
  { up: 4, down: 7, note: "競合との違いの整理に対して、独自性の評価が先行している" },
  { up: 5, down: 6, note: "自社の強み・弱みの整理に対して、価値提案の評価が先行している" },
  { up: 5, down: 7, note: "自社の強み・弱みの整理に対して、独自性の評価が先行している" },
  { up: 2, down: 9, note: "WHYの言語化に対して、接点ごとの一貫性の評価が先行している" },
  { up: 2, down: 10, note: "WHYの言語化に対して、社内での体現の評価が先行している" },
  { up: 3, down: 9, note: "ブランドの人格・トーンの定義に対して、コミュニケーションの一貫性の評価が先行している" },
  { up: 3, down: 12, note: "ブランドの人格・トーンの定義に対して、ガイドラインの評価が先行している" },
  { up: 6, down: 8, note: "価値提案の明文化に対して、商品・サービスへの反映の評価が先行している" },
  { up: 7, down: 8, note: "独自性の評価に対して、商品・サービスへの反映の評価が先行している" },
];

export const CONTRADICTION_MIN_GAP = 2; // 2点以上の差で矛盾として数える
export const CRI_PER_SEVERITY = 2; // 深刻度1につきCRI +2.0（上限10）

// ---------------------------------------------------------------------
// 現在の課題 → 関連設問
// direct：6章「自己評価と課題認識のずれ」の判定に使う
// upstream：8章「課題とのつながり」で連鎖をさかのぼる説明に使う
// aliases：旧アンケートの表記（過去データ）をこの課題として読み替える
// ---------------------------------------------------------------------
export type ChallengeDef = {
  id: string;
  category: string;
  label: string;
  direct: number[];
  upstream: number[];
  aliases?: string[];
};

export const CHALLENGES: ChallengeDef[] = [
  // ブランド戦略
  { id: "direction", category: "ブランド戦略", label: "ブランドの方向性が定まっていない", direct: [2], upstream: [1] },
  { id: "differentiation", category: "ブランド戦略", label: "競合との差別化ができていない", direct: [4, 7], upstream: [1, 5], aliases: ["競合との差別化"] },
  { id: "target", category: "ブランド戦略", label: "ターゲット顧客が明確でない", direct: [1], upstream: [] },
  { id: "value_prop", category: "ブランド戦略", label: "価値提案が言語化できていない", direct: [6], upstream: [1, 5], aliases: ["強みの言語化・明確化", "強みの言語化"] },
  // 認知・集客
  { id: "acquisition", category: "認知・集客", label: "新規顧客の獲得が難しい", direct: [9], upstream: [1, 6], aliases: ["新規集客の低迷", "認知・知名度不足"] },
  { id: "sns", category: "認知・集客", label: "SNS・Web集客がうまくいかない", direct: [9], upstream: [3, 12], aliases: ["情報発信・SNS運用"] },
  { id: "referral", category: "認知・集客", label: "口コミ・紹介が少ない", direct: [8], upstream: [1, 7] },
  { id: "ads", category: "認知・集客", label: "広告効果が出ない", direct: [11], upstream: [1, 9] },
  // 組織・人材
  { id: "hiring", category: "組織・人材", label: "採用がうまくいかない", direct: [9], upstream: [2] },
  { id: "turnover", category: "組織・人材", label: "離職率が高い", direct: [10], upstream: [2] },
  { id: "motivation", category: "組織・人材", label: "社員のモチベーションが低い", direct: [10], upstream: [2] },
  { id: "philosophy", category: "組織・人材", label: "ブランド理念が社内に浸透していない", direct: [10], upstream: [2, 12], aliases: ["社内の意識統一（理念浸透）", "社内の意識統一"] },
  // 売上・収益
  { id: "sales", category: "売上・収益", label: "売上が伸び悩んでいる", direct: [8], upstream: [6, 11] },
  { id: "price", category: "売上・収益", label: "価格競争に巻き込まれている", direct: [7], upstream: [4, 6], aliases: ["価格競争からの脱却"] },
  { id: "repeat", category: "売上・収益", label: "リピーターが増えない", direct: [8], upstream: [1] },
  { id: "unit_price", category: "売上・収益", label: "単価が上げられない", direct: [7], upstream: [6, 8] },
  // 旧アンケートのみに存在した課題
  { id: "design", category: "その他（旧項目）", label: "デザインの一貫性（ロゴ・Web等）", direct: [12], upstream: [3], aliases: ["デザインの一貫性"] },
];

export const PERCEPTION_GAP_MIN_SCORE = 4; // 直接関連の設問が4点以上でチェックあり → ずれ

// ---------------------------------------------------------------------
// 色（信号ロジック：1〜2=赤、3=黄、4〜5=青）
// ---------------------------------------------------------------------
export const NAVY = "#0f2044";
export const SIGNAL = {
  red: "#dc2626",
  yellow: "#d97706",
  blue: "#2563eb",
  redBg: "#fef2f2",
  yellowBg: "#fffbeb",
  blueBg: "#eff6ff",
};

export function scoreColor(score: number): string {
  if (score <= 2) return SIGNAL.red;
  if (score < 4) return SIGNAL.yellow; // 3（平均値では 2.5〜3.9 相当）
  return SIGNAL.blue;
}

/** 平均値（小数）用。2.5未満=赤、3.5未満=黄、それ以上=青 */
export function avgColor(avg: number): string {
  if (avg < 2.5) return SIGNAL.red;
  if (avg < 3.5) return SIGNAL.yellow;
  return SIGNAL.blue;
}

/** CRIは逆ロジック：高いほど問題が大きい */
export function criColor(cri: number): string {
  if (cri >= 5) return SIGNAL.red;
  if (cri >= 2) return SIGNAL.yellow;
  return SIGNAL.blue;
}

export function criLabel(cri: number): string {
  if (cri >= 5) return "複数の要素の間に、整理が必要な食い違いがあります";
  if (cri >= 2) return "一部の要素の間に、確認したい食い違いがあります";
  return "要素間の大きな食い違いは見られません";
}

export function totalLabel(avg: number): string {
  if (avg >= 4) return "全体として整備が進んでいます";
  if (avg >= 3) return "一部に整備の余地があります";
  if (avg >= 2) return "複数の領域に整備の余地があります";
  return "基盤から整備を進める余地があります";
}
