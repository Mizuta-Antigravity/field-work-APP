'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './admin.module.css';

export default function AdminDashboard() {
    const [admins, setAdmins] = useState([]);
    const [applications, setApplications] = useState([]);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const checkAuthAndFetchAdmins = async () => {
            const isAuth = sessionStorage.getItem('adminAuth');
            if (isAuth !== 'true') {
                router.push('/admin/login');
                return;
            }

            try {
                const [adminsRes, appsRes] = await Promise.all([
                    fetch('/api/admins'),
                    fetch('/api/applications')
                ]);

                const adminsData = await adminsRes.json();
                const appsData = await appsRes.json();

                if (adminsData.success) {
                    setAdmins(adminsData.admins);
                } else {
                    setError('管理者の取得に失敗しました。');
                }

                if (appsData.success) {
                    setApplications(appsData.applications);
                }
            } catch (err) {
                setError('データの取得に失敗しました。');
            } finally {
                setLoading(false);
            }
        };

        checkAuthAndFetchAdmins();
    }, [router]);

    const handleLogout = () => {
        sessionStorage.removeItem('adminAuth');
        router.push('/admin/login');
    };

    const handleAddAdmin = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const res = await fetch('/api/admins', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    email,
                    password: 'hokuyoJ1326' // 簡易的なAPI認証用
                }),
            });

            const data = await res.json();

            if (data.success) {
                setAdmins([data.admin, ...admins]);
                setName('');
                setEmail('');
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('通信エラーが発生しました。');
        }
    };

    const handleRemoveAdmin = async (id, name) => {
        if (!confirm(`管理者「${name}」を削除してもよろしいですか？`)) {
            return;
        }

        try {
            const res = await fetch(`/api/admins?id=${id}`, {
                method: 'DELETE',
            });
            const data = await res.json();

            if (data.success) {
                setAdmins(admins.filter(a => a.id !== id));
            } else {
                alert(data.error);
            }
        } catch (err) {
            alert('削除中にエラーが発生しました。');
        }
    };

    const downloadCSV = () => {
        if (applications.length === 0) return;

        const headers = [
            'ID', '送信日時', 'グループ番号', 'クラス', '出席番号', 'リーダー', 'メンバー', '連絡先',
            '目的', '実施日', '出発時間', '場所', '対象者', '方法', 'アンケート内容', '仮説',
            '母校', '依頼書', '教員確認'
        ];

        const csvContent = [
            headers.join(','),
            ...applications.map(app => {
                let membersStr = '';
                try {
                    const members = JSON.parse(app.members || '[]');
                    membersStr = members.map(m => m.name).filter(n => n).join('・');
                } catch (e) {
                    console.error("Failed to parse members for app", app.id);
                }

                const datesStr = app.schedules ? JSON.parse(app.schedules).map(s => s.date).join(' | ') : app.date;
                const timesStr = app.schedules ? JSON.parse(app.schedules).map(s => s.departureTime ? s.departureTime + '限' : '').join(' | ') : (app.departure_time ? app.departure_time + '限' : '');
                const locationsStr = app.schedules ? JSON.parse(app.schedules).map(s => s.location).join(' | ') : app.location;

                const row = [
                    app.id,
                    app.submitted_at,
                    app.group_number,
                    app.leader_class,
                    app.leader_number,
                    app.leader_name,
                    membersStr,
                    app.emergency_contact,
                    app.purpose,
                    datesStr,
                    timesStr,
                    locationsStr,
                    app.target,
                    app.method,
                    app.survey_content,
                    app.hypothesis,
                    app.is_alma_mater ? '〇' : '',
                    app.has_request_letter ? '〇' : '',
                    app.has_confirmed_teacher ? '〇' : ''
                ];
                // エスケープ処理 (カンマや改行を含む場合に対応)
                return row.map(field => {
                    const str = String(field || '');
                    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                        return `"${str.replace(/"/g, '""')}"`;
                    }
                    return str;
                }).join(',');
            })
        ].join('\n');

        // BOM付きでUTF-8化してExcelで文字化けしないようにする
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        link.setAttribute('download', `刀_Q-Board_${dateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return <div className={styles.adminContainer} style={{ textAlign: 'center', marginTop: '50px' }}>読み込み中...</div>;

    return (
        <div className={styles.adminContainer}>
            <div className={styles.dashboardHeader}>
                <div>
                    <h1 className={styles.title} style={{ marginBottom: 0 }}>管理者ダッシュボード</h1>
                    <p style={{ color: '#4a5568', marginTop: '0.2rem' }}>関西大学北陽高等学校 企×学協働プロジェクト「刀」</p>
                </div>
                <button onClick={handleLogout} className={styles.logoutButton}>ログアウト</button>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.card}>
                <h2 className={styles.cardTitle}>新規管理者登録</h2>
                <form onSubmit={handleAddAdmin}>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <div className={styles.formGroup} style={{ flex: '1', minWidth: '200px' }}>
                            <label className={styles.label} htmlFor="name">名前</label>
                            <input
                                type="text"
                                id="name"
                                className={styles.input}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>
                        <div className={styles.formGroup} style={{ flex: '2', minWidth: '250px' }}>
                            <label className={styles.label} htmlFor="email">メールアドレス</label>
                            <input
                                type="email"
                                id="email"
                                className={styles.input}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '1.5rem' }}>
                            <button type="submit" className={styles.button} style={{ width: 'auto' }}>登録する</button>
                        </div>
                    </div>
                </form>
            </div>

            <div className={styles.card}>
                <h2 className={styles.cardTitle}>登録済み管理者一覧</h2>
                {admins.length > 0 ? (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>名前</th>
                                <th>メールアドレス</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {admins.map((admin) => (
                                <tr key={admin.id}>
                                    <td>admin_{admin.id}</td>
                                    <td style={{ fontWeight: '500' }}>{admin.name}</td>
                                    <td style={{ color: '#4a5568' }}>{admin.email}</td>
                                    <td>
                                        <button
                                            onClick={() => handleRemoveAdmin(admin.id, admin.name)}
                                            style={{ padding: '0.3rem 0.6rem', backgroundColor: '#e53e3e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                        >
                                            削除
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className={styles.emptyState}>
                        管理者がまだ登録されていません。上のフォームから登録してください。
                    </div>
                )}
            </div>

            <div className={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 className={styles.cardTitle} style={{ marginBottom: 0 }}>申請済み計画書一覧</h2>
                    <button
                        onClick={downloadCSV}
                        style={{ padding: '0.5rem 1rem', backgroundColor: '#3182ce', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }}
                        disabled={applications.length === 0}
                    >
                        CSVでダウンロード
                    </button>
                </div>
                {applications.length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>提出日時</th>
                                    <th>グループ</th>
                                    <th>代表者</th>
                                    <th>実施日</th>
                                    <th>出発</th>
                                    <th>場所</th>
                                    <th>方法</th>
                                </tr>
                            </thead>
                            <tbody>
                                {applications.map((app) => (
                                    <tr key={app.id}>
                                        <td style={{ color: '#4a5568', fontSize: '0.9rem' }}>{new Date(app.submitted_at).toLocaleString('ja-JP')}</td>
                                        <td>{app.group_number}班</td>
                                        <td>{app.leader_class} {app.leader_number}番<br />{app.leader_name}</td>
                                        <td>{app.date}</td>
                                        <td>{app.departure_time ? `${app.departure_time}限` : '-'}</td>
                                        <td>{app.location}</td>
                                        <td>{app.method}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className={styles.emptyState}>
                        現在、提出された計画書はありません。
                    </div>
                )}
            </div>
        </div>
    );
}
