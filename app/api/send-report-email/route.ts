import { Resend } from 'resend';
import { NextRequest, NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { to, company_name, respondent_name, result_id } = await request.json();

    const resultUrl = `https://brand-check-v3.vercel.app/results/${result_id}`;

    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: [to],
      subject: `【Brand Check】${company_name} 様のブランド診断レポート`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">ブランド診断レポート</h1>
            <p style="color: #c7d2fe; margin: 8px 0 0;">Brand Check Assessment Report</p>
          </div>
          <div style="background: #f8fafc; padding: 32px; border-radius: 0 0 12px 12px;">
            <p style="color: #1e293b; font-size: 16px;">${respondent_name} 様</p>
            <p style="color: #475569;">このたびはBrand Checkをご受診いただきありがとうございます。</p>
            <p style="color: #475569;">診断レポートが準備できましたのでご確認ください。</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resultUrl}"
                style="display: inline-block; background: #4f46e5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px;">
                診断レポートを確認する →
              </a>
            </div>
            <div style="background: #e0e7ff; border-radius: 8px; padding: 16px; margin-top: 24px;">
              <p style="color: #3730a3; font-size: 14px; margin: 0;">
                💡 レポートには現状スコアと矛盾リスク診断（CRI）が含まれています。<br>
                詳細な分析レポートは壁打ちセッション後に解放されます。
              </p>
            </div>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
            <p style="color: #94a3b8; font-size: 12px; text-align: center;">
              © 2025 HUV DESIGN OFFICE<br>
              株式会社HUV DESIGN OFFICE
            </p>
          </div>
        </div>
      `,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
