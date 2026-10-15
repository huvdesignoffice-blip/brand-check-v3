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
      overall: { type: "string", description: "1章 総評（4〜6文）。流れが止まっている地点から下流へ一方向にたどる" },
      domainSummary: { type: "string", description: "3章 3領域のスコアの全体の形（1〜2文のみ）" },
      domains: {
        type: "object",
        properties: { foundation: domainSchema, strategy: domainSchema, execution: domainSchema },
        required: ["foundation", "strategy", "execution"],
      },
      consistency: { type: "string", description: "5章 上流→下流の流れの所見（3〜4文）" },
      perceptionGap: { type: "string", description: "6章 自己評価と課題認識のずれの所見（2〜4文）。ずれがなければ、その事実を1〜2文で" },
      philosophyVision: { type: "string", description: "7章 理念・ビジョンとの照合の所見（2〜4文）。両方未入力なら空文字" },
      challengeLinks: { type: "string", description: "8章 課題とのつながりの所見（3〜4文）。課題のチェックがなければ空文字" },
      improvementTitles: {
        type: "array",
        items: { type: "string" },
        description: "改善の方向性のタイトルを3つ。上流の地点から順に並べる（各20字以内、名詞止め。手段・手順は含めない）",
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
- 回答者の自己評価を否定しない。「自己評価が誤っている」とは書かず、「上流の裏付けが確認できていない」と書く。
- 「壁打ち」と表記する（「壁打き」は誤り）。

# 分析の根幹：上流 → 下流 の一本の流れ
- 設問は Q1 → Q12 の一本の流れです。上流（Q1〜Q7）が戦略、下流（Q8〜Q12）が手段と成果です。
- 上流が整っている範囲までしか、下流は機能しないと考えます。下流の評価が高くても、上流がそれより低ければ、その高評価は「上流の裏付けが確認できていない」ものとして扱います。
- 「実効スコア」は、上流の裏付けがある範囲での評価です。自己評価と実効スコアの差が、裏付けが確認できていない部分です。
- 「確定した強み」として書いてよいのは、与えられた「確定した強み」の設問だけです。それ以外の4点以上の設問を、強みとして書かないでください。
- 「流れが止まっている地点」が、分析の起点です。総評は必ずこの地点から書き始め、そこから下流へ一方向にたどります。下流から上流へさかのぼる書き方、領域を並列に並べる書き方はしないでください。
- 流れが止まっている地点がない場合（すべて4点以上）は、確定した強みを先に示し、その後に流れの中で相対的に低い地点を示します。

# 「このままの場合に起こりうること」
- 原因の説明ではなく、今の状態が続いた場合に起こりうる事業上の損失を、可能性として具体的に書く。
- 上流が整わないまま下流（手段）に投資を続けた場合に、成果につながりにくい、という流れに沿って書く。
- 恐怖を煽る書き方はしない。事実から無理なく導ける範囲に留める。

# 情報開示のルール（重要）
- overall / domainSummary / domains / consistency / perceptionGap / philosophyVision / challengeLinks は、回答直後に誰でも読める部分です。ここには「何が起きているか」と「起こりうること」だけを書き、改善の方法・手段・手順は一切書かないでください。
- improvementTitles は面談後に見せる部分です。方向性のタイトルのみで、手段は含めません。必ず上流の地点から順に並べます（例：1つ目が流れの止まっている地点）。
- stage3 はパッケージ購入後に見せる完全版です。改善は必ず上流から順に整える前提で書きます。下流（手段）から先に手を付ける提案はしないでください。詳細は壁打ちで一緒に設計する前提で書きます。

# 章ごとの役割（重複させない）
- overall：流れが止まっている地点 → その影響を受けている下流 → 起こりうること、の順で4〜6文。
- domainSummary：3領域を上流から順に見たときの全体の形を1〜2文だけ。
- domains：各領域の状態を、その領域より上流の状態と関連づけて書く。ブランド基盤 → 戦略設計 → 実行・浸透 の順に、前の領域を受けて書く。
- consistency：上流の裏付けを超えている設問を、流れの順に取り上げる。どこで流れが止まり、その先がどう「上積み」になっているかを書く。
- perceptionGap：課題に挙げた項目の自己評価が高い場合、それが上流の裏付けを超えた評価である可能性に触れる。
- challengeLinks：チェックされた課題（多くは下流で表れる症状）と、その上流で流れが止まっている地点との関係を書く。因果は断定しない。`;

export async function generateFindings(input: BrandCheckInput, metrics: BrandCheckMetrics): Promise<{ findings: AiFindings; model: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY が設定されていません");

  const model = process.env.BRANDCHECK_MODEL || DEFAULT_MODEL;
  const client = new Anthropic({ apiKey });

  const facts = metricsToFacts(input, metrics);

  // 最新モデルはツールの強制指定（tool_choice: tool / any）に対応していないため、
  // auto のままツール使用を指示し、ツールが使われなかった場合は本文のJSONを読む
  const message = await client.messages.create({
    model,
    max_tokens: 8000,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: "auto" },
    messages: [
      {
        role: "user",
        content: `以下は計算済みの診断結果です。この事実だけに基づいて、必ず write_brand_check_report ツールを1回だけ呼び出して所見を記入してください。ツール以外の文章は不要です。\n\n${facts}`,
      },
    ],
  });

  const block = message.content.find((b) => b.type === "tool_use");
  if (block && block.type === "tool_use") {
    return { findings: sanitize(block.input as AiFindings), model };
  }

  const text = message.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n");
  const parsed = extractJson(text);
  if (parsed) return { findings: sanitize(parsed as AiFindings), model };

  throw new Error(`AIの応答に所見が含まれていませんでした（stop_reason: ${message.stop_reason}）`);
}

/** 本文中のJSON（```json ブロック、または最初の { から最後の } まで）を取り出す */
function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (!candidate || !candidate.trim().startsWith("{")) return null;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
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
