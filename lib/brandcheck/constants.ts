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

// ---------------------------------------------------------------------
// 上流 → 下流 のロジック（Q1 → Q12 を1本の流れとして扱う）
// 上流が戦略、下流が手段と成果。上流が整っている範囲までしか、下流の評価を認めない。
// 実効スコア(i) = min(自己評価(i), 実効スコア(i-1) + FLOW_TOLERANCE)
// ---------------------------------------------------------------------
export const FLOW_TOLERANCE = 0; // 上流を何点まで超えても認めるか（0 = 上流を超えた分はすべて「裏付け未確認」）
export const BOTTLENECK_MAX = 3; // 最も上流にある、この点数以下の設問を「流れが止まっている地点」とする
export const CONFIRMED_MIN = 4; // 実効スコアがこの点数以上なら「確定した強み」

// ---------------------------------------------------------------------
// 現在の課題 → 関連設問
// direct：その課題に直接関係する設問（6章のずれの判定、8章のつながりの起点）
// 8章では、direct より上流にある3点以下の設問を、流れに沿ってさかのぼって示す
// aliases：旧アンケートの表記（過去データ）をこの課題として読み替える
// ---------------------------------------------------------------------
export type ChallengeDef = {
  id: string;
  category: string;
  label: string;
  direct: number[];
  aliases?: string[];
};

export const CHALLENGES: ChallengeDef[] = [
  // ブランド戦略
  { id: "direction", category: "ブランド戦略", label: "ブランドの方向性が定まっていない", direct: [2] },
  { id: "differentiation", category: "ブランド戦略", label: "競合との差別化ができていない", direct: [4, 7], aliases: ["競合との差別化"] },
  { id: "target", category: "ブランド戦略", label: "ターゲット顧客が明確でない", direct: [1] },
  { id: "value_prop", category: "ブランド戦略", label: "価値提案が言語化できていない", direct: [6], aliases: ["強みの言語化・明確化", "強みの言語化"] },
  // 認知・集客
  { id: "acquisition", category: "認知・集客", label: "新規顧客の獲得が難しい", direct: [9], aliases: ["新規集客の低迷", "認知・知名度不足"] },
  { id: "sns", category: "認知・集客", label: "SNS・Web集客がうまくいかない", direct: [9], aliases: ["情報発信・SNS運用"] },
  { id: "referral", category: "認知・集客", label: "口コミ・紹介が少ない", direct: [8] },
  { id: "ads", category: "認知・集客", label: "広告効果が出ない", direct: [11] },
  // 組織・人材
  { id: "hiring", category: "組織・人材", label: "採用がうまくいかない", direct: [9] },
  { id: "turnover", category: "組織・人材", label: "離職率が高い", direct: [10] },
  { id: "motivation", category: "組織・人材", label: "社員のモチベーションが低い", direct: [10] },
  { id: "philosophy", category: "組織・人材", label: "ブランド理念が社内に浸透していない", direct: [10], aliases: ["社内の意識統一（理念浸透）", "社内の意識統一"] },
  // 売上・収益
  { id: "sales", category: "売上・収益", label: "売上が伸び悩んでいる", direct: [8] },
  { id: "price", category: "売上・収益", label: "価格競争に巻き込まれている", direct: [7], aliases: ["価格競争からの脱却"] },
  { id: "repeat", category: "売上・収益", label: "リピーターが増えない", direct: [8] },
  { id: "unit_price", category: "売上・収益", label: "単価が上げられない", direct: [7] },
  // 旧アンケートのみに存在した課題
  { id: "design", category: "その他（旧項目）", label: "デザインの一貫性（ロゴ・Web等）", direct: [12], aliases: ["デザインの一貫性"] },
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
