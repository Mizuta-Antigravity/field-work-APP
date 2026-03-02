import { setupDatabase } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const result = await setupDatabase();
        if (result.success) {
            return NextResponse.json({ success: true, message: 'データベースの初期化が完了しました。' });
        } else {
            return NextResponse.json({ success: false, error: result.error.message }, { status: 500 });
        }
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
