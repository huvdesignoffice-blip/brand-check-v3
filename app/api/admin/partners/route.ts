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

// パートナー一覧取得
export async function GET() {
  const { data, error } = await supabase
    .from("partners")
    .select("id,email,name,company_name,is_active,created_at,last_login_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ partners: data });
}

// パートナー新規作成
export async function POST(request: NextRequest) {
  try {
    const { email, password, name, company_name } = await request.json();
    const hash = hashPassword(password);
    const { data, error } = await supabase
      .from("partners")
      .insert({ email, password_hash: hash, name, company_name })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, partner: data });
  } catch (err) {
    return NextResponse.json({ error: "作成エラー" }, { status: 500 });
  }
}

// パートナー停止・有効化
export async function PATCH(request: NextRequest) {
  try {
    const { id, is_active } = await request.json();
    const { error } = await supabase
      .from("partners")
      .update({ is_active })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "更新エラー" }, { status: 500 });
  }
}

// パートナー削除
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    const { error } = await supabase.from("partners").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "削除エラー" }, { status: 500 });
  }
}
