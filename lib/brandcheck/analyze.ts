// =====================================================================
// 数値と判定はすべてここで計算します（AIには計算させません）。
// レポート・管理画面・メールで同じ数字が出ることを保証するためです。
// =====================================================================

import {
  CONTRADICTION_MIN_GAP,
  CONTRADICTION_PAIRS,
  CRI_PER_SEVERITY,
  DOMAINS,
  PERCEPTION_GAP_MIN_SCORE,
  Q1_CHAIN,
  Q1_THRESHOLD,
  type DomainKey,
  qTitle,
} from "./constants";
import type { BrandCheckInput } from "./normalize";

export type Contradiction = {
  up: number;
  down: number;
  upScore: number;
  downScore: number;
  gap: number;
  severity: number; // 1〜3
  note: string;
};

export type VerticalStep = {
  from: DomainKey;
  to: DomainKey;
  fromAvg: number;
  toAvg: number;
  reversed: boolean; // 下流の領域が上流を0.5以上上回っている
};

export type PerceptionGap = {
  challengeLabel: string;
  question: number;
  score: number;
};

export type ChallengeLink = {
  challengeLabel: string;
  category: string;
  direct: { no: number; score: number }[];
  upstream: { no: number; score: number }[];
  lowPoints: number[]; // 3点以下の関連設問
};

export type PhilosophyVisionCheck = {
  hasPhilosophy: boolean;
  hasVision: boolean;
  visionHasNumericTarget: boolean;
  points: { label: string; question: number; score: number; observation: string }[];
};

export type BrandCheckMetrics = {
  totalAvg: number;
  domainAvgs: { key: DomainKey; label: string; avg: number; questions: number[] }[];
  q1Score: number;
  q1Mode: "foundation_weak" | "foundation_ok";
  q1Chain: { no: number; score: number }[];
  strengths: number[]; // 4点以上（Q1が弱いときは「確定した強み」とは扱わない）
  lowItems: number[]; // 2点以下
  contradictions: Contradiction[];
  cri: number; // 0〜10、高いほど問題が大きい
  vertical: VerticalStep[];
  perceptionGaps: PerceptionGap[];
  challengeLinks: ChallengeLink[];
  philosophyVision: PhilosophyVisionCheck;
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const avgOf = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);

export function computeMetrics(input: BrandCheckInput): BrandCheckMetrics {
  const s = (no: number) => input.scores[no - 1];

  const totalAvg = round1(avgOf(input.scores));

  const domainAvgs = DOMAINS.map((d) => ({
    key: d.key,
    label: d.label,
    questions: d.questions,
    avg: round1(avgOf(d.questions.map(s))),
  }));

  const q1Score = s(1);
  const q1Mode = q1Score <= Q1_THRESHOLD ? "foundation_weak" : "foundation_ok";
  const q1Chain = Q1_CHAIN.map((no) => ({ no, score: s(no) }));

  const strengths = input.scores.map((v, i) => ({ v, no: i + 1 })).filter((x) => x.v >= 4).map((x) => x.no);
  const lowItems = input.scores.map((v, i) => ({ v, no: i + 1 })).filter((x) => x.v <= 2).map((x) => x.no);

  // 横の一貫性（矛盾）
  const contradictions: Contradiction[] = CONTRADICTION_PAIRS.map((p) => {
    const upScore = s(p.up);
    const downScore = s(p.down);
    const gap = downScore - upScore;
    return { ...p, upScore, downScore, gap, severity: Math.min(3, gap - (CONTRADICTION_MIN_GAP - 1)) };
  })
    .filter((c) => c.gap >= CONTRADICTION_MIN_GAP)
    .sort((a, b) => b.gap - a.gap || a.up - b.up);

  const severitySum = contradictions.reduce((a, c) => a + c.severity, 0);
  const cri = round1(Math.min(10, severitySum * CRI_PER_SEVERITY));

  // 縦の一貫性（基盤 → 戦略設計 → 実行・浸透）
  const vertical: VerticalStep[] = [];
  for (let i = 0; i < domainAvgs.length - 1; i++) {
    const a = domainAvgs[i];
    const b = domainAvgs[i + 1];
    vertical.push({ from: a.key, to: b.key, fromAvg: a.avg, toAvg: b.avg, reversed: b.avg - a.avg >= 0.5 });
  }

  // 自己評価と課題認識のずれ
  const perceptionGaps: PerceptionGap[] = [];
  for (const c of input.challenges) {
    for (const q of c.direct) {
      if (s(q) >= PERCEPTION_GAP_MIN_SCORE) {
        perceptionGaps.push({ challengeLabel: c.label, question: q, score: s(q) });
      }
    }
  }

  // 課題とのつながり
  const challengeLinks: ChallengeLink[] = input.challenges.map((c) => {
    const direct = c.direct.map((no) => ({ no, score: s(no) }));
    const upstream = c.upstream.map((no) => ({ no, score: s(no) }));
    const lowPoints = [...direct, ...upstream].filter((x) => x.score <= 3).map((x) => x.no);
    return { challengeLabel: c.label, category: c.category, direct, upstream, lowPoints: Array.from(new Set(lowPoints)) };
  });

  // 理念・ビジョンとの照合
  const hasPhilosophy = input.philosophy.length > 0;
  const hasVision = input.vision.length > 0;
  // 「3年後」「5年以内」などの期間表現を除いてから、数値目標の有無を見る
  const visionWithoutPeriod = input.vision.replace(/[0-9０-９〜~～\-ー]+\s*(年|ヶ月|か月|カ月)(後|以内|で|まで)?/g, "");
  const visionHasNumericTarget = /[0-9０-９]|[一二三四五六七八九十百千万億]+(倍|割|億|万|店|人|社)|倍|%|％|売上|年商|シェア/.test(visionWithoutPeriod);
  const points: PhilosophyVisionCheck["points"] = [];
  if (hasPhilosophy) {
    points.push({
      label: "理念 × WHYの言語化",
      question: 2,
      score: s(2),
      observation: s(2) >= 4 ? "理念と存在意義の言語化が、ともに進んでいると自己評価されています" : "理念は書かれていますが、存在意義を社内外に伝える段階の評価は控えめです",
    });
    points.push({
      label: "理念 × 社内での体現",
      question: 10,
      score: s(10),
      observation: s(10) >= 4 ? "理念が日常業務で体現されていると自己評価されています" : "理念が日常業務での体現にまで至っているかは、確認の余地があります",
    });
  }
  if (hasVision) {
    points.push({
      label: visionHasNumericTarget ? "数値目標を含むビジョン × KPI" : "ビジョン × KPI",
      question: 11,
      score: s(11),
      observation:
        s(11) >= 4
          ? "ビジョンに向けた進み具合を測る仕組みがあると自己評価されています"
          : visionHasNumericTarget
            ? "目標は数値で示されていますが、そこまでの道のりを測る仕組みの評価は控えめです"
            : "ビジョンに向けた進み具合を測る仕組みの評価は控えめです",
    });
  }

  return {
    totalAvg,
    domainAvgs,
    q1Score,
    q1Mode,
    q1Chain,
    strengths,
    lowItems,
    contradictions,
    cri,
    vertical,
    perceptionGaps,
    challengeLinks,
    philosophyVision: { hasPhilosophy, hasVision, visionHasNumericTarget, points },
  };
}

/** AIに渡すための、事実だけを並べたテキスト */
export function metricsToFacts(input: BrandCheckInput, m: BrandCheckMetrics): string {
  const lines: string[] = [];
  lines.push(`企業名: ${input.companyName || "未入力"}`);
  lines.push(`業種: ${input.industry || "未入力"} / 事業フェーズ: ${input.businessPhase || "未入力"} / 売上規模: ${input.revenueScale || "未入力"}`);
  lines.push(`企業理念: ${input.philosophy || "（未入力）"}`);
  lines.push(`3〜5年後のビジョン: ${input.vision || "（未入力）"}`);
  lines.push("");
  lines.push("【設問別スコア（1〜5）】");
  input.scores.forEach((v, i) => lines.push(`Q${i + 1} ${qTitle(i + 1)}: ${v}`));
  lines.push("");
  lines.push(`総合スコア: ${m.totalAvg} / 5.0`);
  m.domainAvgs.forEach((d) => lines.push(`領域「${d.label}」（Q${d.questions[0]}〜Q${d.questions[d.questions.length - 1]}）平均: ${d.avg}`));
  lines.push("");
  lines.push(`Q1ターゲット理解: ${m.q1Score} → ${m.q1Mode === "foundation_weak" ? "Q1が3以下（土台が伴っていない可能性があるモード）" : "Q1が4以上（強みを先に示すモード）"}`);
  lines.push(`Q1起点の連鎖: ${m.q1Chain.map((c) => `Q${c.no}${qTitle(c.no)}=${c.score}`).join(" → ")}`);
  lines.push(`4点以上の項目: ${m.strengths.map((n) => `Q${n}${qTitle(n)}`).join("、") || "なし"}`);
  lines.push(`2点以下の項目: ${m.lowItems.map((n) => `Q${n}${qTitle(n)}`).join("、") || "なし"}`);
  lines.push("");
  lines.push(`CRI（矛盾リスク指数、0〜10、高いほど食い違いが大きい）: ${m.cri}`);
  if (m.contradictions.length) {
    lines.push("検出された矛盾（上流 → 下流、下流の評価が先行）:");
    m.contradictions.forEach((c) => lines.push(`- Q${c.up}${qTitle(c.up)}(${c.upScore}) → Q${c.down}${qTitle(c.down)}(${c.downScore}) 差${c.gap}: ${c.note}`));
  } else {
    lines.push("検出された矛盾: なし");
  }
  lines.push("縦の流れ（基盤 → 戦略設計 → 実行・浸透）:");
  m.vertical.forEach((v) => lines.push(`- ${v.fromAvg} → ${v.toAvg}${v.reversed ? "（下流の評価が上流を上回っている）" : ""}`));
  lines.push("");
  lines.push(`チェックされた課題: ${input.challenges.map((c) => c.label).join("、") || "なし"}`);
  if (input.unknownChallenges.length) lines.push(`対応表にない課題の表記: ${input.unknownChallenges.join("、")}`);
  if (input.otherChallengeText) lines.push(`その他の課題（自由記述）: ${input.otherChallengeText}`);
  if (m.perceptionGaps.length) {
    lines.push("自己評価と課題認識のずれ（課題にチェックがあり、直接関連する設問を4点以上と自己評価）:");
    m.perceptionGaps.forEach((g) => lines.push(`- 課題「${g.challengeLabel}」 × Q${g.question}${qTitle(g.question)}=${g.score}`));
  } else {
    lines.push("自己評価と課題認識のずれ: なし");
  }
  if (m.challengeLinks.length) {
    lines.push("課題と関連設問:");
    m.challengeLinks.forEach((l) =>
      lines.push(
        `- ${l.challengeLabel}: 直接 ${l.direct.map((d) => `Q${d.no}=${d.score}`).join(" ")} / 上流 ${l.upstream.map((d) => `Q${d.no}=${d.score}`).join(" ") || "なし"}`
      )
    );
  }
  if (m.philosophyVision.points.length) {
    lines.push("理念・ビジョンとの照合:");
    m.philosophyVision.points.forEach((p) => lines.push(`- ${p.label}: Q${p.question}=${p.score}（${p.observation}）`));
  }
  return lines.join("\n");
}
