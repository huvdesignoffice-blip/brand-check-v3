import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "huv_salt_2025").digest("hex");
}

// ログイン
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    const hash = hashPassword(password);

    const { data, error } = await supabase
      .from("partners")
      .select("*")
      .eq("email", email)
      .eq("password_hash", hash)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "メールアドレスまたはパスワードが正しくありません" }, { status: 401 });
    }

    // 最終ログイン更新
    await supabase.from("partners").update({ last_login_at: new Date().toISOString() }).eq("id", data.id);

    const response = NextResponse.json({ success: true, partner: { id: data.id, name: data.name, company_name: data.company_name, email: data.email } });
    response.cookies.set("partner_session", data.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return response;
  } catch (err) {
    return NextResponse.json({ error: "ログインエラー" }, { status: 500 });
  }
}

// セッション確認
export async function GET(request: NextRequest) {
  const partnerId = request.cookies.get("partner_session")?.value;
  if (!partnerId) return NextResponse.json({ error: "未認証" }, { status: 401 });

  const { data, error } = await supabase
    .from("partners")
    .select("id,name,company_name,email")
    .eq("id", partnerId)
    .eq("is_active", true)
    .single();

  if (error || !data) return NextResponse.json({ error: "未認証" }, { status: 401 });
  return NextResponse.json({ partner: data });
}

// ログアウト
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("partner_session", "", { maxAge: 0, path: "/" });
  return response;
}
