import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as nodemailer from 'nodemailer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { company_name, respondent_name, respondent_email, avg_score, business_phase, industry, result_id } = body;

    const resultUrl = `https://brand-check-v3.vercel.app/results/${result_id}`;

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">新しいブランド診断が届きました</h1>
        </div>
        <div style="background: #f8fafc; padding: 32px; border-radius: 0 0 12px 12px;">
          <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px;"><strong>企業名：</strong>${company_name}</p>
            <p style="margin: 0 0 8px;"><strong>回答者：</strong>${respondent_name}</p>
            <p style="margin: 0 0 8px;"><strong>メール：</strong>${respondent_email || '未入力'}</p>
            <p style="margin: 0 0 8px;"><strong>業種：</strong>${industry || '未入力'}</p>
            <p style="margin: 0 0 8px;"><strong>フェーズ：</strong>${business_phase}</p>
            <p style="margin: 0;"><strong>平均スコア：</strong>${avg_score} / 5.0</p>
          </div>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${resultUrl}"
              style="display: inline-block; background: #4f46e5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 50px; font-weight: bold;">
              結果を確認する →
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">© 2025 HUV DESIGN OFFICE</p>
        </div>
      </div>
    `;

    const transporter = createTransporter();

    // マスターに必ず通知
    await transporter.sendMail({
      from: `"Brand Check" <${process.env.GMAIL_USER}>`,
      to: 'huvdesignoffice@gmail.com',
      subject: `【Brand Check】新しい診断回答: ${company_name}`,
      html: emailHtml,
    });

    // パートナー経由の場合はパートナーにも通知
    if (body.partner_id) {
      const { data: partner } = await supabase
        .from('partners')
        .select('email, name')
        .eq('id', body.partner_id)
        .eq('is_active', true)
        .single();

      if (partner?.email) {
        await transporter.sendMail({
          from: `"Brand Check" <${process.env.GMAIL_USER}>`,
          to: partner.email,
          subject: `【Brand Check】顧客から新しい診断回答: ${company_name}`,
          html: emailHtml,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Send notification error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
