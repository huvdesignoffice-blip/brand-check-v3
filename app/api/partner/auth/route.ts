import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    const { data, error } = await supabase
      .from("partners")
      .select("*")
      .eq("email", email)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "メールアドレスまたはパスワードが正しくありません" }, { status: 401 });
    }

    // bcryptで検証
    const valid = await bcrypt.compare(password, data.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "メールアドレスまたはパスワードが正しくありません" }, { status: 401 });
    }

    // 最終ログイン更新
    await supabase.from("partners").update({ last_login_at: new Date().toISOString() }).eq("id", data.id);

    const response = NextResponse.json({
      success: true,
      partner: { id: data.id, name: data.name, company_name: data.company_name, email: data.email },
      mustChangePassword: data.must_change_password === true,
    });

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

export async function GET(request: NextRequest) {
  const partnerId = request.cookies.get("partner_session")?.value;
  if (!partnerId) return NextResponse.json({ error: "未認証" }, { status: 401 });

  const { data, error } = await supabase
    .from("partners")
    .select("id,name,company_name,email,must_change_password")
    .eq("id", partnerId)
    .eq("is_active", true)
    .single();

  if (error || !data) return NextResponse.json({ error: "未認証" }, { status: 401 });
  return NextResponse.json({ partner: data });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("partner_session", "", { maxAge: 0, path: "/" });
  return response;
}
