// =====================================================================
// AIには「所見の文章」だけを書かせます。数値・判定は analyze.ts で計算済み。
// 出力は tool use で JSON の形を固定しているので、パースエラーが起きにくい作りです。
// =====================================================================

import Anthropic from "@anthropic-ai/sdk";
import { metricsToFacts, type BrandCheckMetrics } from "./analyze";
import type { BrandCheckInput } from "./normalize";

// モデル名は環境変数 BRANDCHECK_MODEL で上書きできます（2026年10月時点の最新Sonnet）
export const DEFAULT_MODEL = "claude-sonnet-5-5";

export type DomainFinding = { state: string; evidence: string; ifUnchanged: string };

export type AiFindings = {
  overall: string;
  domainSummary: string;
  domains: { foundation: DomainFinding; strategy: DomainFinding; execution: DomainFinding };
  consistency: string;
  perceptionGap: string;
  philosophyVision: string;
  challengeLinks: string;
  // STAGE2（面談後）
  improvementTitles: string[];
  // STAGE3（パッケージ購入後）
  stage3: {
    improvements: { title: string; detail: string }[];
    actionPlan: { months3: string; months6: string; year1: string };
    phaseAdvice: string;
    overallAssessment: string;
  };
};

/** ステージに応じて絞り込んだ後の所見（STAGE1では改善関連のキーが存在しない） */
export type VisibleFindings = Omit<AiFindings, "improvementTitles" | "stage3"> & {
  improvementTitles?: string[];
  stage3?: AiFindings["stage3"];
};

const domainSchema = {
  type: "object",
  properties: {
    state: { type: "string", description: "この領域の状態（2〜3文）" },
    evidence: { type: "string", description: "根拠となる設問と点数（1〜2文。点数は与えられた事実のとおりに書く）" },
    ifUnchanged: { type: "string", description: "このままの場合に起こりうること（2文程度、可能性として書く）" },
  },
  required: ["state", "evidence", "ifUnchanged"],
};

const TOOL = {
  name: "write_brand_check_report",
  description: "Brand Check 診断レポートの所見を記入する",
  input_schema: {
    type: "object" as const,
    properties: {
      overall: { type: "string", description: "1章 総評（4〜6文）。Q1起点ロジックに従う" },
      domainSummary: { type: "string", description: "3章 3領域のスコアの全体の形（1〜2文のみ）" },
      domains: {
        type: "object",
        properties: { foundation: domainSchema, strategy: domainSchema, execution: domainSchema },
        required: ["foundation", "strategy", "execution"],
      },
      consistency: { type: "string", description: "5章 一貫性（縦・横）の所見（3〜4文）" },
      perceptionGap: { type: "string", description: "6章 自己評価と課題認識のずれの所見（2〜4文）。ずれがなければ、その事実を1〜2文で" },
      philosophyVision: { type: "string", description: "7章 理念・ビジョンとの照合の所見（2〜4文）。両方未入力なら空文字" },
      challengeLinks: { type: "string", description: "8章 課題とのつながりの所見（3〜4文）。課題のチェックがなければ空文字" },
      improvementTitles: {
        type: "array",
        items: { type: "string" },
        description: "改善の方向性のタイトルを3つ（各20字以内、名詞止め。手段・手順は含めない）",
      },
      stage3: {
        type: "object",
        properties: {
          improvements: {
            type: "array",
            items: {
              type: "object",
              properties: { title: { type: "string" }, detail: { type: "string", description: "4〜6文。状況・リスク・改善の方向性" } },
              required: ["title", "detail"],
            },
            description: "improvementTitles と同じ3つのタイトルの詳細",
          },
          actionPlan: {
            type: "object",
            properties: {
              months3: { type: "string", description: "今から3ヶ月で取り組むテーマ（2〜3文）" },
              months6: { type: "string", description: "3〜6ヶ月で取り組むテーマ（2〜3文）" },
              year1: { type: "string", description: "6ヶ月〜1年で取り組むテーマ（2〜3文）" },
            },
            required: ["months3", "months6", "year1"],
          },
          phaseAdvice: { type: "string", description: "事業フェーズに即したアドバイス（3〜4文）" },
          overallAssessment: { type: "string", description: "総合評価（4〜5文）" },
        },
        required: ["improvements", "actionPlan", "phaseAdvice", "overallAssessment"],
      },
    },
    required: [
      "overall",
      "domainSummary",
      "domains",
      "consistency",
      "perceptionGap",
      "philosophyVision",
      "challengeLinks",
      "improvementTitles",
      "stage3",
    ],
  },
};

const SYSTEM = `あなたは株式会社HUV DESIGN OFFICEのブランド戦略コンサルタントとして、ブランド診断「Brand Check」のレポート所見を書きます。

# 文体（最優先）
- 客観的・冷静・プロフェッショナル。ですます調。
- 煽らない、脅さない、突き放さない。「危険」「深刻」「手遅れ」「1人では改善できない」などの表現は使わない。
- 推測は推測として書く（「〜の可能性があります」「〜と考えられます」）。原因を断定しない。
- 点数・指標は与えられた事実のとおりに書く。自分で計算し直したり、新しい数字を作ったりしない。
- 回答者の自己評価を否定しない。「自己評価と実感している課題の間に差がある可能性」のように、どちらが正しいとも言わない。
- 「壁打ち」と表記する（「壁打き」は誤り）。

# 分析の起点：Q1（ターゲット理解）
- Q1が3以下：他の設問が高くても「確定した強み」として書かない。「土台が伴っていない可能性がある」と表現し、総評は Q1 → Q3 → Q9 → Q10 → Q11 の連鎖として組み立てる。
- Q1が4以上：確認できた強みを先に示し、その後に改善の優先度を示す。

# 「このままの場合に起こりうること」
- 原因の説明ではなく、今の状態が続いた場合に起こりうる事業上の損失を、可能性として具体的に書く。
- 恐怖を煽る書き方はしない。事実から無理なく導ける範囲に留める。

# 情報開示のルール（重要）
- overall / domainSummary / domains / consistency / perceptionGap / philosophyVision / challengeLinks は、回答直後に誰でも読める部分です。ここには「何が起きているか」と「起こりうること」だけを書き、改善の方法・手段・手順は一切書かないでください。
- improvementTitles は面談後に見せる部分です。方向性のタイトルのみで、手段は含めません（例：「ターゲット像の解像度の向上」）。
- stage3 はパッケージ購入後に見せる完全版です。ここでは改善の方向性を具体的に書いてよいですが、特定の媒体や施策名を並べるより、何をどの順で整えるかを示してください。詳細は壁打ちで一緒に設計する前提で書きます。

# 章ごとの役割（重複させない）
- domainSummary は全体の形を1〜2文だけ。領域ごとの詳細は domains に書く。
- consistency は「縦」（基盤 → 戦略設計 → 実行・浸透の流れ）と「横」（設問どうしの食い違い）の両方に触れる。
- challengeLinks は、チェックされた課題が、上流のどの設問と関連している可能性があるかを書く。因果は断定しない。`;

export async function generateFindings(input: BrandCheckInput, metrics: BrandCheckMetrics): Promise<{ findings: AiFindings; model: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY が設定されていません");

  const model = process.env.BRANDCHECK_MODEL || DEFAULT_MODEL;
  const client = new Anthropic({ apiKey });

  const facts = metricsToFacts(input, metrics);

  const message = await client.messages.create({
    model,
    max_tokens: 8000,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [
      {
        role: "user",
        content: `以下は計算済みの診断結果です。この事実だけに基づいて、write_brand_check_report ツールで所見を記入してください。\n\n${facts}`,
      },
    ],
  });

  const block = message.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("AIの応答に所見が含まれていませんでした");
  }
  const findings = block.input as AiFindings;
  return { findings: sanitize(findings), model };
}

/** 表記の最終チェック（AIの出力に誤記が混じった場合の保険） */
function sanitize(f: AiFindings): AiFindings {
  const fix = (s: unknown) => (typeof s === "string" ? s.replace(/壁打き/g, "壁打ち") : "");
  const fixDomain = (d: DomainFinding | undefined): DomainFinding => ({
    state: fix(d?.state),
    evidence: fix(d?.evidence),
    ifUnchanged: fix(d?.ifUnchanged),
  });
  return {
    overall: fix(f.overall),
    domainSummary: fix(f.domainSummary),
    domains: {
      foundation: fixDomain(f.domains?.foundation),
      strategy: fixDomain(f.domains?.strategy),
      execution: fixDomain(f.domains?.execution),
    },
    consistency: fix(f.consistency),
    perceptionGap: fix(f.perceptionGap),
    philosophyVision: fix(f.philosophyVision),
    challengeLinks: fix(f.challengeLinks),
    improvementTitles: (f.improvementTitles ?? []).map(fix).filter(Boolean).slice(0, 3),
    stage3: {
      improvements: (f.stage3?.improvements ?? []).slice(0, 3).map((i) => ({ title: fix(i.title), detail: fix(i.detail) })),
      actionPlan: {
        months3: fix(f.stage3?.actionPlan?.months3),
        months6: fix(f.stage3?.actionPlan?.months6),
        year1: fix(f.stage3?.actionPlan?.year1),
      },
      phaseAdvice: fix(f.stage3?.phaseAdvice),
      overallAssessment: fix(f.stage3?.overallAssessment),
    },
  };
}
