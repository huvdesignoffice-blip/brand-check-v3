import { Resend } from 'resend';
import { NextRequest, NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    console.log('=== SEND NOTIFICATION START ===');
    
    const body = await request.json();
    console.log('Request body:', body);
    
    const { company_name, respondent_name, respondent_email, avg_score, business_phase, industry, result_id } = body;

    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set');
      return NextResponse.json({ error: 'API Key not configured' }, { status: 500 });
    }

    if (!process.env.ADMIN_EMAIL) {
      console.error('ADMIN_EMAIL is not set');
      return NextResponse.json({ error: 'Admin email not configured' }, { status: 500 });
    }

    console.log('Sending email to:', process.env.ADMIN_EMAIL);

    const resultUrl = result_id 
    ? `https://brand-check-v2.vercel.app/results/${result_id}`
: 'https://brand-check-v2.vercel.app/admin';

    const { data, error } = await resend.emails.send({
      from: 'noreply@huvdesignoffice.com',
      to: [process.env.ADMIN_EMAIL],
      subject: `新しいブランドチェック回答: ${company_name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0f172a;">新しいブランドチェック回答が届きました</h2>
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>企業名:</strong> ${company_name}</p>
<p><strong>回答者:</strong> ${respondent_name}</p>
<p><strong>メール:</strong> ${respondent_email || '未入力'}</p>
<p><strong>業種:</strong> ${industry || '未入力'}</p>
<p><strong>事業フェーズ:</strong> ${business_phase}</p>
<p><strong>平均スコア:</strong> ${avg_score} / 5.0</p>
          </div>
          <div style="margin: 30px 0;">
            <a href="${resultUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">結果を確認する</a>
          </div>
          <p style="color: #64748b; font-size: 14px;">
            または、管理画面で詳細を確認してください。
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            © 2025 HUV DESIGN OFFICE
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.log('Email sent successfully:', data);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Send notification error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
