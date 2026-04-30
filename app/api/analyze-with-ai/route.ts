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

// 業界平均・層定義は不要になりました（スコア絶対差方式に変更）

// 因果ペア定義（川上index, 川下index, 重み, リスク説明）
const CAUSAL_PAIRS: [number, number, number, string][] = [
  [0, 6, 1.5, "ターゲットインサイトの解像度を上げると、独自性がより市場に届きやすくなる可能性があります。"],
  [1, 8, 1.5, "ブランドのWHYを整理することで、コミュニケーションの一貫性がさらに高まる余地があります。"],
  [2, 11, 1.5, "ブランドパーソナリティを明確にすることで、ガイドラインの活用精度が上がると考えられます。"],
  [3, 5, 1.0, "競合との違いを整理することで、価値提案の説得力がより高まる可能性があります。"],
  [4, 7, 1.0, "自社の強みをさらに深掘りすることで、商品の独自性をより際立たせられると考えられます。"],
  [0, 7, 1.0, "顧客インサイトを深めることで、商品・サービスがより課題解決に近づく余地があります。"],
  [5, 7, 0.5, "価値提案と商品設計の整合性を確認することで、ブランドの一貫性が高まります。"],
  [9, 10, 0.5, "インナーブランディングとKPIを連動させることで、現場への浸透がより進む可能性があります。"],
  [1, 9, 0.5, "WHYを起点にインナーブランディングを進めることで、組織の方向性が揃いやすくなります。"],
];

// CRI計算（スコア絶対差方式）
// 川上より川下が高い場合に矛盾スコアを発生させる
function calcCRI(scores: number[]): {
  cri: number;
  level: string;
  pairs: { upstream: string; downstream: string; score: number; risk: string }[];
} {
  const pairs = CAUSAL_PAIRS.map(([ui, di, w, risk]) => {
    const upstream = scores[ui];
    const downstream = scores[di];
    // 川下が川上より高い場合のみ矛盾スコアを発生
    const contradictionScore = Math.max(0, downstream - upstream) * w;
    return {
      upstream: categoryNames[ui],
      downstream: categoryNames[di],
      score: Math.round(contradictionScore * 100) / 100,
      risk,
    };
  });

  const cri = Math.round(pairs.reduce((sum, p) => sum + p.score, 0) * 100) / 100;
  const level = cri > 5.0 ? "優先的に整理が必要な状態" : cri > 2.5 ? "いくつか確認したい点があります" : "概ね整合しています";

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
    const layerDefs = [
      { name: "ブランド基盤", indices: [0, 1, 2] },
      { name: "戦略設計", indices: [3, 4, 5, 6] },
      { name: "実行・浸透", indices: [7, 8, 9, 10, 11] },
    ];
    const layerScores = layerDefs.map(layer => {
      const layerAvg =
        layer.indices.reduce((sum, i) => sum + scores[i], 0) / layer.indices.length;
      return `${layer.name}: ${layerAvg.toFixed(1)}点`;
    });

    // スコアと項目名を整形
    const scoresWithLabels = scores
      .map(
        (score: number, i: number) =>
          `${categoryNames[i]}: ${score}点`
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





