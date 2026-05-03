import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const partnerId = request.cookies.get("partner_session")?.value;
    if (!partnerId) return NextResponse.json({ error: "未認証" }, { status: 401 });

    const { password } = await request.json();
    if (!password || password.length < 8) {
      return NextResponse.json({ error: "パスワードは8文字以上で入力してください" }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 12);
    const { error } = await supabase
      .from("partners")
      .update({ password_hash: hash, must_change_password: false })
      .eq("id", partnerId);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
