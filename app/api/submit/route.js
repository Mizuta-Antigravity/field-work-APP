import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { sql } from '@vercel/postgres';
import { randomUUID } from 'crypto';

// メール送信用のトランスポーター生成
function createTransporter() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD
        }
    });
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export async function POST(request) {
    try {
        const body = await request.json();
        const { formData, adminId } = body;

        if (!adminId) {
            return NextResponse.json({ success: false, error: '提出先の管理者が選択されていません。' }, { status: 400 });
        }

        // DBから管理者のメールアドレスを取得
        const { rows: admins } = await sql`SELECT name, email FROM admins WHERE id = ${adminId}`;
        const admin = admins[0];

        if (!admin) {
            return NextResponse.json({ success: false, error: '指定された管理者がみつかりません。' }, { status: 404 });
        }

        // 1. データベースに申請データを保存
        const { rows: results } = await sql`
            INSERT INTO applications (
                group_number, leader_class, leader_number, leader_name, leader_email, emergency_contact,
                purpose, schedules, target, method,
                survey_content, hypothesis, is_alma_mater, has_request_letter,
                has_confirmed_teacher, ai_comment, members
            ) VALUES (
                ${formData.groupNumber}, ${formData.groupLeader.class}, ${formData.groupLeader.number},
                ${formData.groupLeader.name}, ${formData.email}, ${formData.emergencyContact},
                ${formData.purpose}, ${JSON.stringify(formData.schedules || [])},
                ${formData.target}, ${formData.method}, ${formData.surveyContent}, ${formData.hypothesis},
                ${formData.isAlmaMater ? 1 : 0}, ${formData.hasRequestLetter ? 1 : 0},
                ${formData.hasConfirmedWithTeacher ? 1 : 0}, '',
                ${JSON.stringify(formData.members || [])}
            )
            RETURNING id
        `;

        const applicationId = results[0].id;

        // 2. 再申請用のワンタイムトークンを生成 (72時間有効)
        const token = randomUUID();
        const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

        await sql`
            INSERT INTO edit_tokens (token, application_id, expires_at) 
            VALUES (${token}, ${applicationId}, ${expiresAt})
        `;

        const resubmitUrl = `${BASE_URL}/resubmit?token=${token}`;

        const transporter = createTransporter();

        const members = formData.members || [];
        const schedules = formData.schedules || [];
        const buildMailContent = (recipientName) => `
${recipientName} 様

以下の内容でフィールドワーク計画書が申請されました。

■ グループ情報
グループ番号: ${formData.groupNumber}
【リーダー】 ${formData.groupLeader.class} ${formData.groupLeader.number}番 ${formData.groupLeader.name} (${formData.groupLeader.furigana})
メールアドレス: ${formData.email}
連絡先: ${formData.emergencyContact}
${members.length > 0 ? `\n【メンバー】\n${members.map((m, i) => `  ${i + 1}. ${m.class} ${m.number}番 ${m.name} (${m.furigana})`).join('\n')}\n` : ''}
■ フィールドワーク情報
【実施スケジュール】
${schedules.map((s, i) => `  日程 ${i + 1}: ${s.date} ${s.departureTime ? s.departureTime + '時間目' : '未選択'} (${s.location})`).join('\n')}
対象者: ${formData.target}
実施方法: ${formData.method}

【実施目的】
${formData.purpose}

【事前仮説】
${formData.hypothesis}
${formData.method === 'アンケート' ? `\n【アンケート内容】\n${formData.surveyContent}\n` : ''}
■ その他チェック事項
小中学校母校チェック: ${formData.isAlmaMater ? 'はい' : '該当なし'}
依頼書チェック: ${formData.hasRequestLetter ? 'はい' : '該当なし'}
関西大学教員確認チェック: ${formData.hasConfirmedWithTeacher ? 'はい' : '該当なし'}
`;

        // 3. 管理者へのメール送信
        await transporter.sendMail({
            from: `"フィールドワーク申請システム" <${process.env.GMAIL_USER}>`,
            to: admin.email,
            subject: `【申請】フィールドワーク計画書 グループ${formData.groupNumber} (${formData.groupLeader.name})`,
            text: buildMailContent(admin.name + ' 先生') + `
ご確認ください。内容の修正が必要な場合は、申請者（${formData.groupLeader.name}）にその旨をお伝えください。
申請者には、以下のURLから修正・再申請できるリンクを送付済みです（72時間有効）。
${resubmitUrl}
`,
        });

        // 4. 申請者（グループリーダー）へのメール送信
        await transporter.sendMail({
            from: `"フィールドワーク申請システム" <${process.env.GMAIL_USER}>`,
            to: formData.email, // formData.email が正しい（リーダーのメールアドレス）
            subject: `【申請完了】フィールドワーク計画書 グループ${formData.groupNumber}`,
            text: buildMailContent(formData.groupLeader.name) + `
申請が完了しました。

担当の先生から内容の修正を求められた場合は、以下のURLから修正・再申請できます。
このURLは72時間有効です。URLが期限切れの場合は、もう一度最初からお申し込みください。

✏️ 修正・再申請URL:
${resubmitUrl}

ご確認ください。
`,
        });

        return NextResponse.json({
            success: true,
            message: '申請メールを管理者と申請者に送信しました。',
        });

    } catch (error) {
        console.error('Submit API Error:', error);
        return NextResponse.json({ success: false, error: 'メール送信中にエラーが発生しました。サーバーログを確認してください。' }, { status: 500 });
    }
}
