import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const { rows: applications } = await sql`
            SELECT * FROM applications ORDER BY submitted_at DESC
        `;

        return NextResponse.json({ success: true, applications });
    } catch (error) {
        console.error("Fetch Applications Error:", error);
        return NextResponse.json({ success: false, error: '申請データの取得に失敗しました。' }, { status: 500 });
    }
}
