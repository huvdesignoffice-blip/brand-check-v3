// =====================================================================
// survey_results の1行を、レポート用の形に整える
// 実際のカラム名が多少違っていても読めるように、候補名を順に探します。
// 見つからなかった項目は warnings に入るので、導入時に確認できます。
// =====================================================================

import { CHALLENGES, type ChallengeDef } from "./constants";

export type Row = Record<string, unknown>;

export type BrandCheckInput = {
  id: string;
  companyName: string;
  respondentName: string;
  industry: string;
  businessPhase: string;
  revenueScale: string;
  philosophy: string;
  vision: string;
  scores: number[]; // index 0 = Q1 … index 11 = Q12
  challenges: ChallengeDef[]; // 対応表に一致した課題
  unknownChallenges: string[]; // 対応表に一致しなかった課題（表記ゆれ・旧項目など）
  otherChallengeText: string; // 「その他（自由記述）」
  createdAt: string;
  stage: 1 | 2 | 3;
  warnings: string[];
};

const FIELD_CANDIDATES = {
  companyName: ["company_name", "company", "companyName"],
  respondentName: ["respondent_name", "name", "respondentName", "contact_name"],
  industry: ["industry", "business_type", "industry_category"],
  businessPhase: ["business_phase", "phase", "businessPhase"],
  revenueScale: ["revenue_scale", "annual_revenue", "sales_scale", "revenue", "sales_volume"],
  philosophy: ["philosophy", "corporate_philosophy", "company_philosophy", "mission", "brand_philosophy"],
  vision: ["vision", "future_vision", "vision_3_5_years", "vision_text"],
  challenges: ["challenges", "current_challenges", "issues", "selected_challenges", "challenge_list"],
  otherChallenge: ["challenges_other", "other_challenge", "challenge_other", "other_challenges", "challenges_other_text"],
  createdAt: ["created_at", "submitted_at", "createdAt"],
  stage2: ["stage2_unlocked", "consultation_completed", "consultation_done"],
  stage3: ["stage3_unlocked"],
} as const;

function pick(row: Row, keys: readonly string[]): unknown {
  for (const k of keys) {
    if (k in row && row[k] !== null && row[k] !== undefined) return row[k];
  }
  return undefined;
}

function hasAny(row: Row, keys: readonly string[]): boolean {
  return keys.some((k) => k in row);
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

/** Q1〜Q12 の点数を探す（q1_target_insight のような v2.2 形式、または q1 形式） */
function readScore(row: Row, no: number): number | null {
  const re = new RegExp(`^q${no}(_|$)`);
  const key = Object.keys(row).find((k) => re.test(k) && typeof row[k] !== "object");
  if (!key) return null;
  const n = Number(row[key]);
  if (!Number.isFinite(n)) return null;
  return Math.min(5, Math.max(1, Math.round(n)));
}

/** 配列・JSON文字列・区切り文字列のどれでも、課題の一覧として読む */
function readList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(str).filter(Boolean);
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return [];
    if (t.startsWith("[")) {
      try {
        const parsed = JSON.parse(t);
        if (Array.isArray(parsed)) return parsed.map(str).filter(Boolean);
      } catch {
        /* 区切り文字列として扱う */
      }
    }
    // Postgres の配列リテラル {a,b} にも対応
    const body = t.startsWith("{") && t.endsWith("}") ? t.slice(1, -1) : t;
    return body
      .split(/[,、\n|]/)
      .map((s) => s.replace(/^"|"$/g, "").trim())
      .filter(Boolean);
  }
  return [];
}

const norm = (s: string) => s.replace(/[\s　]/g, "").replace(/[（(].*?[）)]/g, "").toLowerCase();

function matchChallenge(text: string): ChallengeDef | null {
  const t = norm(text);
  if (!t) return null;
  for (const c of CHALLENGES) {
    const names = [c.label, ...(c.aliases ?? [])].map(norm);
    if (names.some((n) => n === t)) return c;
  }
  for (const c of CHALLENGES) {
    const names = [c.label, ...(c.aliases ?? [])].map(norm);
    if (names.some((n) => n.length >= 4 && (t.includes(n) || n.includes(t)))) return c;
  }
  return null;
}

const isTruthy = (v: unknown) => v === true || v === "true" || v === 1 || v === "1";

export function normalizeRow(row: Row): BrandCheckInput {
  const warnings: string[] = [];

  const scores: number[] = [];
  for (let i = 1; i <= 12; i++) {
    const s = readScore(row, i);
    if (s === null) {
      warnings.push(`Q${i}の点数のカラムが見つかりません（3点として仮計算しています）`);
      scores.push(3);
    } else {
      scores.push(s);
    }
  }

  // 候補名で見つからないときは、カラム名に含まれる語で探す（例：vision_future など）
  const FUZZY: Partial<Record<keyof typeof FIELD_CANDIDATES, RegExp>> = {
    vision: /vision|future|goal|ビジョン/i,
    philosophy: /philosoph|mission|理念|value/i,
    revenueScale: /revenue|sales|売上/i,
    otherChallenge: /(challenge|issue).*(other|text|free)|(other|free).*(challenge|issue)/i,
  };
  const fuzzyKey = (key: keyof typeof FIELD_CANDIDATES) => {
    const re = FUZZY[key];
    if (!re) return undefined;
    return Object.keys(row).find((k) => re.test(k) && !/^q\d/.test(k) && (typeof row[k] === "string" || row[k] === null));
  };

  const textField = (key: keyof typeof FIELD_CANDIDATES, label: string, required = false) => {
    if (!hasAny(row, FIELD_CANDIDATES[key])) {
      const fk = fuzzyKey(key);
      if (fk) return str(row[fk]);
      if (required) warnings.push(`${label}のカラムが見つかりません（候補：${FIELD_CANDIDATES[key].join(", ")}）`);
      return "";
    }
    return str(pick(row, FIELD_CANDIDATES[key]));
  };

  const companyName = textField("companyName", "企業名", true);
  const respondentName = textField("respondentName", "回答者名", true);
  const industry = textField("industry", "業種");
  const businessPhase = textField("businessPhase", "事業フェーズ", true);
  const revenueScale = textField("revenueScale", "売上規模");
  const philosophy = textField("philosophy", "企業理念", true);
  const vision = textField("vision", "ビジョン", true);
  const otherChallengeText = textField("otherChallenge", "その他の課題");

  if (!hasAny(row, FIELD_CANDIDATES.challenges)) {
    warnings.push(`現在の課題のカラムが見つかりません（候補：${FIELD_CANDIDATES.challenges.join(", ")}）`);
  }
  const rawChallenges = readList(pick(row, FIELD_CANDIDATES.challenges));
  const matched = new Map<string, ChallengeDef>();
  const unknownChallenges: string[] = [];
  for (const text of rawChallenges) {
    if (/^その他/.test(text)) continue; // 「その他（自由記述）」のチェック自体は除外
    const c = matchChallenge(text);
    if (c) matched.set(c.id, c);
    else unknownChallenges.push(text);
  }

  const stage3 = isTruthy(pick(row, FIELD_CANDIDATES.stage3));
  const stage2 = isTruthy(pick(row, FIELD_CANDIDATES.stage2));
  const stage: 1 | 2 | 3 = stage3 ? 3 : stage2 ? 2 : 1;

  return {
    id: str(row.id),
    companyName,
    respondentName,
    industry,
    businessPhase,
    revenueScale,
    philosophy,
    vision,
    scores,
    challenges: Array.from(matched.values()),
    unknownChallenges,
    otherChallengeText,
    createdAt: str(pick(row, FIELD_CANDIDATES.createdAt)),
    stage,
    warnings,
  };
}
