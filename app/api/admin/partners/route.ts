import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";
import * as nodemailer from "nodemailer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "huv_salt_2025").digest("hex");
}

function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

export async function GET() {
  const { data, error } = await supabase
    .from("partners")
    .select("id,email,name,company_name,is_active,created_at,last_login_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ partners: data });
}

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

    // GmailでSMTP送信
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"HUV DESIGN OFFICE" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "【Brand Check】パートナーアカウントのご案内",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 22px;">Brand Check パートナーポータル</h1>
            <p style="color: #c7d2fe; margin: 8px 0 0;">アカウントが発行されました</p>
          </div>
          <div style="background: #f8fafc; padding: 32px; border-radius: 0 0 12px 12px;">
            <p style="color: #1e293b;">${name} 様</p>
            <p style="color: #475569;">Brand Checkパートナーアカウントが発行されました。以下の情報でログインしてください。</p>
            <div style="background: white; border: 2px solid #e0e7ff; border-radius: 12px; padding: 20px; margin: 24px 0;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px;">ログイン情報</p>
              <p style="margin: 0 0 6px;"><strong>メールアドレス：</strong>${email}</p>
              <p style="margin: 0;"><strong>パスワード：</strong>${password}</p>
            </div>
            <div style="text-align: center; margin: 32px 0;">
              <a href="https://brand-check-v3.vercel.app/partner/login"
                style="display: inline-block; background: #4f46e5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px;">
                パートナーポータルにログイン →
              </a>
            </div>
            <div style="background: #fef3c7; border-radius: 8px; padding: 16px;">
              <p style="color: #92400e; font-size: 13px; margin: 0;">
                ⚠️ セキュリティのため、ログイン情報は第三者に共有しないでください。
              </p>
            </div>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
            <p style="color: #94a3b8; font-size: 12px; text-align: center;">© 2025 HUV DESIGN OFFICE</p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ success: true, partner: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, is_active } = await request.json();
    const { error } = await supabase.from("partners").update({ is_active }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "更新エラー" }, { status: 500 });
  }
}

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
