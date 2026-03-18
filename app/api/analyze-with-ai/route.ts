import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// v2.2 新12設問（時計回り因果連鎖順）
const categoryNames = [
  "ターゲット理解",
  "ブランドストーリー/WHY",
  "ブランドパーソナリティ",
  "競合分析",
  "自社分析",
  "価値提案",
  "独自性",
  "商品・サービス独自性反映",
  "コミュニケーション一貫性",
  "インナーブランディング",
  "KPI設定と成果確認",
  "ブランドガイドライン整備",
];

// 層定義
const LAYERS = {
  base: { name: "ブランド基盤", indices: [0, 1, 2], sd: 0.8 },
  strategy: { name: "戦略設計", indices: [3, 4, 5, 6], sd: 0.9 },
  execution: { name: "実行・浸透", indices: [7, 8, 9, 10, 11], sd: 0.8 },
};

// 業界平均（参考値）
const INDUSTRY_AVG = [2.8, 2.4, 2.2, 3.1, 3.0, 2.9, 2.7, 2.9, 2.8, 2.5, 2.3, 2.6];

// 因果ペア定義（川上index, 川下index, 重み, リスク説明）
const CAUSAL_PAIRS: [number, number, number, string][] = [
  [0, 6, 1.5, "インサイト不足のまま独自性を高評価→市場に刺さらない差別化になる「顧客不在の独自化リスク」"],
  [1, 8, 1.5, "WHYなき一貫性→形式は整うが顧客の心を動かさない発信になる「軸なき発信リスク」"],
  [2, 11, 1.5, "性格未定義のままガイドライン整備→何のための基準か不明な形骸化リスク"],
  [3, 5, 1.0, "競合分析不足のまま価値提案を高評価→単なる自己申告になる「根拠なき価値提案リスク」"],
  [4, 7, 1.0, "自社分析不足のまま商品独自性を主張→強みの過信・過小評価リスク"],
  [0, 7, 1.0, "インサイト不足→真のお困りごとを解決できていない商品になる「顧客課題不在リスク」"],
  [5, 7, 0.5, "価値提案と商品設計の整合が不十分な可能性"],
  [9, 10, 0.5, "インナー浸透なきKPI管理→数字は追うが現場が動かない「KPI空回りリスク」"],
  [1, 9, 0.5, "WHY未定義のままインナーBDを進める→何を体現すべきか不明確なリスク"],
];

// Zスコア計算
function calcZ(score: number, avg: number, sd: number): number {
  return (score - avg) / sd;
}

// CRI計算
function calcCRI(scores: number[]): {
  cri: number;
  level: string;
  pairs: { upstream: string; downstream: string; score: number; risk: string }[];
} {
  const pairs = CAUSAL_PAIRS.map(([ui, di, w, risk]) => {
    const uAvg = INDUSTRY_AVG[ui];
    const dAvg = INDUSTRY_AVG[di];
    const uLayer = Object.values(LAYERS).find(l => l.indices.includes(ui))!;
    const dLayer = Object.values(LAYERS).find(l => l.indices.includes(di))!;
    const zU = calcZ(scores[ui], uAvg, uLayer.sd);
    const zD = calcZ(scores[di], dAvg, dLayer.sd);
    const contradictionScore = Math.max(0, zD - zU) * w;
    return {
      upstream: categoryNames[ui],
      downstream: categoryNames[di],
      score: Math.round(contradictionScore * 100) / 100,
      risk,
    };
  });

  const cri = Math.round(pairs.reduce((sum, p) => sum + p.score, 0) * 100) / 100;
  const level = cri > 5.0 ? "重大な乖離リスク" : cri > 2.5 ? "要注意の乖離" : "概ね整合";

  return { cri, level, pairs };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      scores,
      memo,
      consultationMemo,
      businessPhase,
      companyName,
      vision,
      challenges,
    } = body;

    if (!scores || scores.length !== 12) {
      return NextResponse.json(
        { error: "12項目のスコアが必要です" },
        { status: 400 }
      );
    }

    // CRI計算
    const criResult = calcCRI(scores);

    // 層別スコア計算
    const layerScores = Object.entries(LAYERS).map(([key, layer]) => {
      const layerAvg =
        layer.indices.reduce((sum, i) => sum + scores[i], 0) / layer.indices.length;
      return `${layer.name}: ${layerAvg.toFixed(1)}点`;
    });

    // スコアと項目名を整形
    const scoresWithLabels = scores
      .map(
        (score: number, i: number) =>
          `${categoryNames[i]}: ${score}点（業界平均${INDUSTRY_AVG[i]}点）`
      )
      .join("\n");

    const avgScore = (
      scores.reduce((a: number, b: number) => a + b, 0) / scores.length
    ).toFixed(1);

    // 高リスクペアを抽出（スコア上位3件）
    const topRiskPairs = [...criResult.pairs]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const criSummary = topRiskPairs
      .map(
        (p, i) =>
          `${i + 1}. 【${p.upstream}】→【${p.downstream}】 矛盾スコア:${p.score} / ${p.risk}`
      )
      .join("\n");

    const prompt = `あなたはブランディングの専門家です。以下の企業のBrand Check診断結果を分析してください。

【企業情報】
会社名: ${companyName || "未入力"}
事業フェーズ: ${businessPhase || "未入力"}

【企業理念・ビジョン】
${memo || "記載なし"}

【3〜5年後のビジョン】
${vision || "記載なし"}

【現在の課題】
${challenges || "記載なし"}

【壁打ち内容】
${consultationMemo || "記載なし"}

---

【診断スコア（5点満点）】
${scoresWithLabels}
平均スコア: ${avgScore}点

【層別スコア】
${layerScores.join("\n")}

---

【統計的矛盾リスク分析（CRI: Contradiction Risk Index）】
CRI総合スコア: ${criResult.cri}（判定: ${criResult.level}）

CRIとは「川上（基盤）が弱いのに川下（実行）が高い」という自社都合評価の乖離を数値化した指標です。
設問1→12は時計回りの因果連鎖（市場理解→戦略→実行）であり、川上の精度が低いまま川下を高評価することは市場との乖離を示します。

検出された主要矛盾ペア:
${criSummary}

---

以下の項目について分析してください。ですます調・配慮ある表現を使用してください。

1. **総合評価**: 平均スコア・層別バランス・CRI判定を踏まえた全体状況を4-5文で評価してください。企業理念・ビジョン・課題の内容も十分考慮し、現状の強みと可能性に触れてください。

2. **矛盾点とリスク（CRIベース）**: 上記のCRI分析で検出された矛盾ペアを3個取り上げ、それぞれについて**このまま放置した場合の具体的な損失**を描写してください。
   表現例：「ターゲットインサイトが弱いまま独自性を高評価し続けた場合、${companyName || "貴社"}の差別化は市場に刺さらず、価格競争に引き戻されるリスクがあります。」
   ※原因説明ではなく未来の損失を具体的に描写すること。

3. **改善提案**: スコアが低い層・項目を中心に**必ず3個のみ**提案してください。
   各項目は「【領域名（スコア点）】については、〜という状況です。〜というリスクがあります。改善の方向性としては〜が必要です。具体的な手順は壁打ちで一緒に設計します。」の流れで記述してください。
   ※具体的なアクション手順は書かないこと。★マークは自動付与のため記述不要。

4. **3ヶ月後のアクションプラン**: 今から3ヶ月で取り組むべきテーマを1個提案してください。「詳細は壁打ちで設計」という文言で締めてください。

5. **6ヶ月後のアクションプラン**: 3〜6ヶ月で取り組むべきテーマを1個提案してください。「詳細は壁打ちで設計」という文言で締めてください。

6. **1年後のアクションプラン**: 6ヶ月〜1年で取り組むべきテーマを1個提案してください。「詳細は壁打ちで設計」という文言で締めてください。

7. **事業フェーズ別アドバイス**: ${businessPhase || "現在"}フェーズに特化したアドバイスを3〜4文で提供してください。このフェーズならではの重要ポイントを前向きかつ具体的に示してください。

重要な注意事項：
- 企業理念・ビジョン・課題・壁打ち内容を丁寧に読み取り、経営者の想いを尊重した分析を行うこと
- CRIの矛盾ペアを分析の核心に置き、総合スコアだけで判断しないこと
- 矛盾指摘は「〜の可能性があります」等の配慮ある表現を使うこと
- 断定表現を避け、提案型の表現を使うこと
- 全文ですます調で統一すること
- ポジティブな面も認めながら建設的な改善提案を行うこと

必ず以下のJSON形式で出力してください：
\`\`\`json
{
  "overallComment": "総合評価の文章",
  "contradictionsAndRisks": ["矛盾とリスク1", "矛盾とリスク2", "矛盾とリスク3"],
  "improvementRecommendations": ["【領域名（スコア点）】改善提案1", "【領域名（スコア点）】改善提案2", "【領域名（スコア点）】改善提案3"],
  "actionPlan3Months": ["3ヶ月後アクション"],
  "actionPlan6Months": ["6ヶ月後アクション"],
  "actionPlan1Year": ["1年後アクション"],
  "phaseAdvice": "事業フェーズ別アドバイスの文章"
}
\`\`\``;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      throw new Error("AIのレスポンス形式が不正です");
    }

    const analysis = JSON.parse(jsonMatch[1]);

    // スコアに基づいて緊急度（★）を自動付与
    if (
      analysis.improvementRecommendations &&
      Array.isArray(analysis.improvementRecommendations)
    ) {
      const scoreMap: { [key: string]: number } = {};
      categoryNames.forEach((name, i) => {
        scoreMap[name] = scores[i];
      });

      analysis.improvementRecommendations = analysis.improvementRecommendations.map(
        (item: string) => {
          if (item.match(/^★+/)) return item;

          let score = 3;
          for (const [category, categoryScore] of Object.entries(scoreMap)) {
            if (item.includes(category)) {
              score = categoryScore as number;
              break;
            }
          }

          const stars = score <= 2 ? "★★★" : score <= 3 ? "★★" : "★";
          return `${stars} ${item}`;
        }
      );

      analysis.improvementRecommendations.sort((a: string, b: string) => {
        const starsA = (a.match(/^★+/) || [""])[0].length;
        const starsB = (b.match(/^★+/) || [""])[0].length;
        return starsB - starsA;
      });
    }

    // CRI結果をレスポンスに追加
    analysis.cri = criResult;

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("AI分析エラー:", error);
    return NextResponse.json(
      {
        error: "AI分析に失敗しました",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
