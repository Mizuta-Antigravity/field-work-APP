import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(request) {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
        return NextResponse.json({ success: false, error: 'トークンが指定されていません。' }, { status: 400 });
    }

    const { rows: tokenRows } = await sql`SELECT * FROM edit_tokens WHERE token = ${token}`;
    const tokenRow = tokenRows[0];

    if (!tokenRow) {
        return NextResponse.json({ success: false, error: '無効なトークンです。' }, { status: 404 });
    }

    if (tokenRow.used) {
        return NextResponse.json({ success: false, error: 'このリンクは既に使用済みです。再度申請が必要な場合はお申し込みください。' }, { status: 410 });
    }

    const now = new Date();
    const expiresAt = new Date(tokenRow.expires_at);
    if (now > expiresAt) {
        return NextResponse.json({ success: false, error: 'このリンクは有効期限切れです。再度最初からお申し込みください。' }, { status: 410 });
    }

    const { rows: applications } = await sql`SELECT * FROM applications WHERE id = ${tokenRow.application_id}`;
    const application = applications[0];

    if (!application) {
        return NextResponse.json({ success: false, error: '元の申請データが見つかりません。' }, { status: 404 });
    }

    return NextResponse.json({ success: true, application, token });
}
