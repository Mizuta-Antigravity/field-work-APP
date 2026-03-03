'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../admin.module.css';

export default function AdminLogin() {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();

    const handleLogin = (e) => {
        e.preventDefault();
        // 簡易的なクライアントサイドのチェックとセッションストレージへの保存
        if (password === 'hokuyoJ1326') {
            sessionStorage.setItem('adminAuth', 'true');
            router.push('/admin');
        } else {
            setError('パスワードが間違っています。');
        }
    };

    return (
        <div className={styles.adminContainer}>
            <div className={styles.loginCard}>
                <h1 className={styles.title}>管理者ログイン</h1>
                <p style={{ marginBottom: '1.5rem', color: '#718096' }}>関西大学北陽高等学校 企×学協働プロジェクト「刀」<br />フィールドワーク計画書の申請先管理</p>
                <div style={{ marginBottom: '2rem' }}>
                    <span style={{ fontSize: '0.75rem', backgroundColor: '#edf2f7', padding: '0.2rem 0.5rem', borderRadius: '4px', color: '#4a5568', fontWeight: 'bold' }}>Ver 1.0.2</span>
                </div>

                {error && <div className={styles.error}>{error}</div>}

                <form onSubmit={handleLogin}>
                    <div className={styles.formGroup}>
                        <label className={styles.label} htmlFor="password">パスワード</label>
                        <input
                            type="password"
                            id="password"
                            className={styles.input}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className={styles.button}>ログイン</button>
                </form>
            </div>
        </div>
    );
}
