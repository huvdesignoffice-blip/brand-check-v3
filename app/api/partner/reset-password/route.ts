import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";
import * as nodemailer from "nodemailer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

// リセットメール送信
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    // パートナー存在確認
    const { data: partner, error } = await supabase
      .from("partners")
      .select("id,name,email")
      .eq("email", email)
      .eq("is_active", true)
      .single();

    if (error || !partner) {
      // セキュリティのため存在しない場合も成功を返す
      return NextResponse.json({ success: true });
    }

    // リセットトークン生成
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1時間有効

    // トークンをDBに保存
    await supabase.from("partners").update({
      reset_token: token,
      reset_token_expires_at: expiresAt.toISOString(),
    }).eq("id", partner.id);

    const resetUrl = `https://brand-check-v3.vercel.app/partner/reset-password?token=${token}`;

    // メール送信
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"HUV DESIGN OFFICE" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "【Brand Check】パスワードリセットのご案内",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 22px;">パスワードリセット</h1>
          </div>
          <div style="background: #f8fafc; padding: 32px; border-radius: 0 0 12px 12px;">
            <p style="color: #1e293b;">${partner.name} 様</p>
            <p style="color: #475569;">パスワードリセットのリクエストを受け付けました。以下のボタンからパスワードを再設定してください。</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}"
                style="display: inline-block; background: #4f46e5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px;">
                パスワードを再設定する →
              </a>
            </div>
            <div style="background: #fef3c7; border-radius: 8px; padding: 16px;">
              <p style="color: #92400e; font-size: 13px; margin: 0;">
                ⚠️ このリンクは1時間後に無効になります。心当たりのない場合は無視してください。
              </p>
            </div>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
            <p style="color: #94a3b8; font-size: 12px; text-align: center;">© 2025 HUV DESIGN OFFICE</p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// パスワード更新
export async function PATCH(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    // トークン確認
    const { data: partner, error } = await supabase
      .from("partners")
      .select("id,reset_token_expires_at")
      .eq("reset_token", token)
      .single();

    if (error || !partner) {
      return NextResponse.json({ error: "無効なトークンです" }, { status: 400 });
    }

    // 有効期限確認
    if (new Date(partner.reset_token_expires_at) < new Date()) {
      return NextResponse.json({ error: "トークンの有効期限が切れています" }, { status: 400 });
    }

    // パスワード更新
    const hash = crypto.createHash("sha256").update(password + "huv_salt_2025").digest("hex");
    await supabase.from("partners").update({
      password_hash: hash,
      reset_token: null,
      reset_token_expires_at: null,
    }).eq("id", partner.id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
