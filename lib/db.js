import { sql } from '@vercel/postgres';

export default sql;

// 初期テーブル作成用の関数（必要に応じてAPIから呼び出す）
export async function setupDatabase() {
  try {
    await sql`
            CREATE TABLE IF NOT EXISTS admins (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

    await sql`
            CREATE TABLE IF NOT EXISTS applications (
                id SERIAL PRIMARY KEY,
                group_number TEXT,
                leader_class TEXT,
                leader_number TEXT,
                leader_name TEXT,
                leader_email TEXT,
                emergency_contact TEXT,
                purpose TEXT,
                date TEXT,
                departure_time TEXT,
                location TEXT,
                target TEXT,
                method TEXT,
                survey_content TEXT,
                hypothesis TEXT,
                is_alma_mater INTEGER,
                has_request_letter INTEGER,
                has_confirmed_teacher INTEGER,
                ai_comment TEXT,
                members TEXT DEFAULT '[]',
                schedules TEXT DEFAULT '[]',
                submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

    await sql`
            CREATE TABLE IF NOT EXISTS edit_tokens (
                id SERIAL PRIMARY KEY,
                token TEXT NOT NULL UNIQUE,
                application_id INTEGER NOT NULL REFERENCES applications(id),
                expires_at TIMESTAMP NOT NULL,
                used INTEGER DEFAULT 0
            );
        `;

    console.log("Database tables initialized successfully");
    return { success: true };
  } catch (error) {
    console.error("Database initialization failed:", error);
    return { success: false, error };
  }
}
