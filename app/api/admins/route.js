import { sql } from '@vercel/postgres';

export async function GET(request) {
    try {
        const { rows: admins } = await sql`
            SELECT id, name, email, created_at 
            FROM admins 
            ORDER BY created_at DESC
        `;
        return Response.json({ success: true, admins });
    } catch (error) {
        console.error('Failed to fetch admins:', error);
        return Response.json({ success: false, error: 'データベースエラーが発生しました。' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const data = await request.json();

        if (data.password !== 'hokuyoJ1326') {
            return Response.json({ success: false, error: 'パスワードが間違っています。' }, { status: 401 });
        }

        if (!data.name || !data.email) {
            return Response.json({ success: false, error: '名前とメールアドレスは必須です。' }, { status: 400 });
        }

        const { rows } = await sql`
            INSERT INTO admins (name, email) 
            VALUES (${data.name}, ${data.email}) 
            RETURNING id
        `;

        return Response.json({
            success: true,
            admin: { id: rows[0].id, name: data.name, email: data.email }
        });

    } catch (error) {
        console.error('Failed to add admin:', error);
        if (error.message.includes('unique constraint') || error.code === '23505') {
            return Response.json({ success: false, error: 'このメールアドレスは既に登録されています。' }, { status: 400 });
        }
        return Response.json({ success: false, error: 'データベースエラーが発生しました。' }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const url = new URL(request.url);
        const id = url.searchParams.get('id');

        if (!id) {
            return Response.json({ success: false, error: '削除する管理者のIDが指定されていません。' }, { status: 400 });
        }

        const { rowCount } = await sql`
            DELETE FROM admins WHERE id = ${id}
        `;

        if (rowCount === 0) {
            return Response.json({ success: false, error: '指定された管理者が見つかりません。' }, { status: 404 });
        }

        return Response.json({ success: true, message: '管理者を削除しました。' });
    } catch (error) {
        console.error('Failed to delete admin:', error);
        return Response.json({ success: false, error: 'データベースエラーが発生しました。' }, { status: 500 });
    }
}
