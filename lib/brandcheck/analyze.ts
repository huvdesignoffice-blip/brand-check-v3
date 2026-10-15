// =====================================================================
// 数値と判定はすべてここで計算します（AIには計算させません）。
//
// 基本ロジック：Q1 → Q12 を1本の流れとして扱う
//   上流が戦略、下流が手段と成果。
//   上流が整っている範囲までしか、下流の評価を認めない。
//
//   実効スコア(Q1) = 自己評価(Q1)
//   実効スコア(Qi) = min(自己評価(Qi), 実効スコア(Qi-1) + FLOW_TOLERANCE)
//
//   自己評価 − 実効スコア ＝ 上流の裏付けを超えている部分（裏付け未確認）
// =====================================================================

import {
  BOTTLENECK_MAX,
  CONFIRMED_MIN,
  DOMAINS,
  FLOW_TOLERANCE,
  PERCEPTION_GAP_MIN_SCORE,
  type DomainKey,
  qTitle,
} from "./constants";
import type { BrandCheckInput } from "./normalize";

export type FlowStep = {
  no: number;
  score: number; // 自己評価
  effective: number; // 上流の裏付けがある範囲での評価
  overreach: number; // score - effective（0より大きいと、上流の裏付けを超えている）
  domain: DomainKey;
};

export type PerceptionGap = {
  challengeLabel: string;
  question: number;
  score: number;
  effective: number;
};

export type ChallengeLink = {
  challengeLabel: string;
  category: string;
  direct: { no: number; score: number; effective: number }[];
  weakUpstream: { no: number; score: number }[]; // 直接の設問より上流にある、3点以下の設問
};

export type PhilosophyVisionCheck = {
  hasPhilosophy: boolean;
  hasVision: boolean;
  visionHasNumericTarget: boolean;
  points: { label: string; question: number; score: number; observation: string }[];
};

export type BrandCheckMetrics = {
  totalAvg: number; // 自己評価の平均
  effectiveAvg: number; // 実効スコアの平均
  domainAvgs: { key: DomainKey; label: string; avg: number; effectiveAvg: number; questions: number[] }[];
  flow: FlowStep[];
  bottleneck: { no: number; score: number } | null; // 最も上流にある3点以下の設問
  lowestUpstream: { no: number; score: number }; // 流れの中で最も低い地点（最初に現れたもの）
  confirmedStrengths: number[]; // 実効スコア4以上
  unconfirmedHighs: number[]; // 自己評価4以上だが、実効スコアは4未満
  overreachItems: number[]; // 上流の裏付けを超えている設問
  overreachTotal: number; // 超えている点数の合計
  cri: number; // 0〜10、高いほど上流と下流の食い違いが大きい
  perceptionGaps: PerceptionGap[];
  challengeLinks: ChallengeLink[];
  philosophyVision: PhilosophyVisionCheck;
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const avgOf = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);
const domainOf = (no: number): DomainKey => DOMAINS.find((d) => d.questions.includes(no))?.key ?? "execution";

/** CRIの分母：起こりうる最大の超過（Q1=1、Q2〜Q12=5）。FLOW_TOLERANCE=0のとき 4×11=44 */
const MAX_OVERREACH = Array.from({ length: 11 }, (_, i) => Math.max(0, 5 - Math.min(5, 1 + FLOW_TOLERANCE * (i + 1)))).reduce(
  (a, b) => a + b,
  0
);

export function computeMetrics(input: BrandCheckInput): BrandCheckMetrics {
  const s = (no: number) => input.scores[no - 1];

  // ---- 上流 → 下流 の流れ ----
  const flow: FlowStep[] = [];
  for (let no = 1; no <= 12; no++) {
    const score = s(no);
    const effective = no === 1 ? score : Math.min(score, flow[no - 2].effective + FLOW_TOLERANCE);
    flow.push({ no, score, effective, overreach: score - effective, domain: domainOf(no) });
  }
  const eff = (no: number) => flow[no - 1].effective;

  const totalAvg = round1(avgOf(input.scores));
  const effectiveAvg = round1(avgOf(flow.map((f) => f.effective)));

  const domainAvgs = DOMAINS.map((d) => ({
    key: d.key,
    label: d.label,
    questions: d.questions,
    avg: round1(avgOf(d.questions.map(s))),
    effectiveAvg: round1(avgOf(d.questions.map(eff))),
  }));

  const bottleneckStep = flow.find((f) => f.score <= BOTTLENECK_MAX);
  const bottleneck = bottleneckStep ? { no: bottleneckStep.no, score: bottleneckStep.score } : null;

  const minScore = Math.min(...input.scores);
  const lowestNo = input.scores.indexOf(minScore) + 1;
  const lowestUpstream = { no: lowestNo, score: minScore };

  const confirmedStrengths = flow.filter((f) => f.effective >= CONFIRMED_MIN).map((f) => f.no);
  const unconfirmedHighs = flow.filter((f) => f.score >= CONFIRMED_MIN && f.effective < CONFIRMED_MIN).map((f) => f.no);
  const overreachItems = flow.filter((f) => f.overreach > 0).map((f) => f.no);
  const overreachTotal = flow.reduce((a, f) => a + f.overreach, 0);
  const cri = round1(Math.min(10, (overreachTotal / (MAX_OVERREACH || 44)) * 10));

  // ---- 自己評価と課題認識のずれ ----
  const perceptionGaps: PerceptionGap[] = [];
  for (const c of input.challenges) {
    for (const q of c.direct) {
      if (s(q) >= PERCEPTION_GAP_MIN_SCORE) {
        perceptionGaps.push({ challengeLabel: c.label, question: q, score: s(q), effective: eff(q) });
      }
    }
  }

  // ---- 課題とのつながり（流れに沿って上流へさかのぼる） ----
  const challengeLinks: ChallengeLink[] = input.challenges.map((c) => {
    const firstDirect = Math.min(...c.direct);
    const weakUpstream = flow
      .filter((f) => f.no < firstDirect && f.score <= BOTTLENECK_MAX)
      .map((f) => ({ no: f.no, score: f.score }));
    return {
      challengeLabel: c.label,
      category: c.category,
      direct: c.direct.map((no) => ({ no, score: s(no), effective: eff(no) })),
      weakUpstream,
    };
  });

  // ---- 理念・ビジョンとの照合 ----
  const hasPhilosophy = input.philosophy.length > 0;
  const hasVision = input.vision.length > 0;
  // 「3年後」「5年以内」などの期間表現を除いてから、数値目標の有無を見る
  const visionWithoutPeriod = input.vision.replace(/[0-9０-９〜~～\-ー]+\s*(年|ヶ月|か月|カ月)(後|以内|で|まで)?/g, "");
  const visionHasNumericTarget = /[0-9０-９]|[一二三四五六七八九十百千万億]+(倍|割|億|万|店|人|社)|倍|%|％|売上|年商|シェア/.test(
    visionWithoutPeriod
  );
  const points: PhilosophyVisionCheck["points"] = [];
  if (hasPhilosophy) {
    points.push({
      label: "理念 × WHYの言語化",
      question: 2,
      score: s(2),
      observation:
        s(2) >= 4 ? "理念と存在意義の言語化が、ともに進んでいると自己評価されています" : "理念は書かれていますが、存在意義を社内外に伝える段階の評価は控えめです",
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
    effectiveAvg,
    domainAvgs,
    flow,
    bottleneck,
    lowestUpstream,
    confirmedStrengths,
    unconfirmedHighs,
    overreachItems,
    overreachTotal,
    cri,
    perceptionGaps,
    challengeLinks,
    philosophyVision: { hasPhilosophy, hasVision, visionHasNumericTarget, points },
  };
}

const q = (no: number) => `Q${no}${qTitle(no)}`;

/** AIに渡すための、事実だけを並べたテキスト（上流から下流の順） */
export function metricsToFacts(input: BrandCheckInput, m: BrandCheckMetrics): string {
  const lines: string[] = [];
  lines.push(`企業名: ${input.companyName || "未入力"}`);
  lines.push(`業種: ${input.industry || "未入力"} / 事業フェーズ: ${input.businessPhase || "未入力"} / 売上規模: ${input.revenueScale || "未入力"}`);
  lines.push(`企業理念: ${input.philosophy || "（未入力）"}`);
  lines.push(`3〜5年後のビジョン: ${input.vision || "（未入力）"}`);
  lines.push("");
  lines.push("【上流 → 下流 の流れ（Q1〜Q3 ブランド基盤／Q4〜Q7 戦略設計 ＝ 戦略、Q8〜Q12 実行・浸透 ＝ 手段と成果）】");
  lines.push("各設問：自己評価 / 実効スコア（上流の裏付けがある範囲の評価）");
  m.flow.forEach((f) =>
    lines.push(`${q(f.no)}: 自己評価 ${f.score} / 実効 ${f.effective}${f.overreach > 0 ? `（上流の裏付けを ${f.overreach} 点超えている）` : ""}`)
  );
  lines.push("");
  lines.push(`自己評価の平均: ${m.totalAvg} / 実効スコアの平均: ${m.effectiveAvg}`);
  m.domainAvgs.forEach((d) => lines.push(`領域「${d.label}」: 自己評価平均 ${d.avg} / 実効平均 ${d.effectiveAvg}`));
  lines.push("");
  lines.push(
    m.bottleneck
      ? `流れが止まっている地点（最も上流にある3点以下の設問）: ${q(m.bottleneck.no)}（${m.bottleneck.score}点）`
      : "流れが止まっている地点: なし（すべての設問が4点以上）"
  );
  lines.push(`確定した強み（自分も上流もすべて4点以上）: ${m.confirmedStrengths.map(q).join("、") || "なし"}`);
  lines.push(`自己評価は4点以上だが、上流の裏付けが未確認の設問: ${m.unconfirmedHighs.map(q).join("、") || "なし"}`);
  lines.push(`上流の裏付けを超えている設問: ${m.overreachItems.map(q).join("、") || "なし"}（超過の合計 ${m.overreachTotal} 点）`);
  lines.push(`CRI（上流と下流の食い違いの指数、0〜10、高いほど大きい）: ${m.cri}`);
  lines.push("");
  lines.push(`チェックされた課題: ${input.challenges.map((c) => c.label).join("、") || "なし"}`);
  if (input.unknownChallenges.length) lines.push(`対応表にない課題の表記: ${input.unknownChallenges.join("、")}`);
  if (input.otherChallengeText) lines.push(`その他の課題（自由記述）: ${input.otherChallengeText}`);
  if (m.perceptionGaps.length) {
    lines.push("自己評価と課題認識のずれ（課題にチェックがあり、直接関係する設問を4点以上と自己評価）:");
    m.perceptionGaps.forEach((g) => lines.push(`- 課題「${g.challengeLabel}」 × ${q(g.question)} 自己評価 ${g.score} / 実効 ${g.effective}`));
  } else {
    lines.push("自己評価と課題認識のずれ: なし");
  }
  if (m.challengeLinks.length) {
    lines.push("課題と、流れに沿った関係（直接の設問 ← それより上流の3点以下の設問）:");
    m.challengeLinks.forEach((l) =>
      lines.push(
        `- ${l.challengeLabel}: 直接 ${l.direct.map((d) => `Q${d.no}=${d.score}`).join(" ")} ← 上流の弱い地点 ${
          l.weakUpstream.map((w) => `Q${w.no}=${w.score}`).join(" ") || "なし"
        }`
      )
    );
  }
  if (m.philosophyVision.points.length) {
    lines.push("理念・ビジョンとの照合:");
    m.philosophyVision.points.forEach((p) => lines.push(`- ${p.label}: Q${p.question}=${p.score}（${p.observation}）`));
  }
  return lines.join("\n");
}
