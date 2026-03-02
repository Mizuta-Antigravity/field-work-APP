'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from '../page.module.css';

function ResubmitForm() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [formData, setFormData] = useState(null);
    const [admins, setAdmins] = useState([]);
    const [selectedAdminId, setSelectedAdminId] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [tokenError, setTokenError] = useState('');

    useEffect(() => {
        if (!token) {
            setTokenError('URLにトークンが含まれていません。メールのリンクを再確認してください。');
            setLoading(false);
            return;
        }

        // トークンを検証して元のデータを取得
        Promise.all([
            fetch(`/api/resubmit?token=${token}`).then(r => r.json()),
            fetch('/api/admins').then(r => r.json()),
        ]).then(([tokenData, adminsData]) => {
            if (!tokenData.success) {
                setTokenError(tokenData.error);
            } else {
                const app = tokenData.application;
                // DBのフラットなデータをフォームの形に変換
                // メールアドレスのパース
                let emailLocal = app.leader_email || '';
                let emailDomain = '@hokuyo2.kansai-u.ac.jp';
                let customDomain = '';

                const domains = ['@hokuyo2.kansai-u.ac.jp', '@gmail.com', '@yahoo.co.jp', '@icloud.com'];
                const matchedDomain = domains.find(d => emailLocal.endsWith(d));
                if (matchedDomain) {
                    emailDomain = matchedDomain;
                    emailLocal = emailLocal.replace(matchedDomain, '');
                } else if (emailLocal.includes('@')) {
                    emailDomain = 'other';
                    const parts = emailLocal.split('@');
                    emailLocal = parts[0];
                    customDomain = '@' + parts[1];
                }

                setFormData({
                    groupNumber: app.group_number || '',
                    groupLeader: {
                        class: app.leader_class || '',
                        number: app.leader_number || '',
                        name: app.leader_name || '',
                        furigana: '',
                        emailLocal,
                        emailDomain,
                        customDomain,
                    },
                    emergencyContact: app.emergency_contact || '',
                    members: JSON.parse(app.members || '[]'),
                    purpose: app.purpose || '',
                    schedules: app.schedules ? JSON.parse(app.schedules) : [{ date: app.date || '', departureTime: app.departure_time || '', location: app.location || '' }],
                    target: app.target || '',
                    method: app.method || '',
                    surveyContent: app.survey_content || '',
                    hypothesis: app.hypothesis || '',
                    isAlmaMater: app.is_alma_mater === 1,
                    hasRequestLetter: app.has_request_letter === 1,
                    hasConfirmedWithTeacher: app.has_confirmed_teacher === 1,
                });
            }

            if (adminsData.success) {
                setAdmins(adminsData.admins);
                if (adminsData.admins.length > 0) {
                    setSelectedAdminId(adminsData.admins[0].id);
                }
            }
        }).catch(() => {
            setTokenError('データの読み込みに失敗しました。');
        }).finally(() => {
            setLoading(false);
        });
    }, [token]);

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleLeaderChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            groupLeader: { ...prev.groupLeader, [field]: value }
        }));
    };

    const isSchoolLocation = formData?.schedules?.some(s => s.location.includes('小学校') || s.location.includes('中学校') || s.location.includes('義務教育学校'));
    const isKandaiLocation = formData?.schedules?.some(s => s.location.includes('関西'));

    const handleAddSchedule = () => {
        setFormData(prev => ({
            ...prev,
            schedules: [...prev.schedules, { date: '', departureTime: '', location: '' }]
        }));
    };

    const handleRemoveSchedule = (index) => {
        setFormData(prev => ({
            ...prev,
            schedules: prev.schedules.filter((_, i) => i !== index)
        }));
    };

    const handleScheduleChange = (index, field, value) => {
        setFormData(prev => {
            const newSchedules = [...prev.schedules];
            newSchedules[index] = { ...newSchedules[index], [field]: value };
            return { ...prev, schedules: newSchedules };
        });
    };

    const isMondayNot6or7 = (date, departureTime) => {
        if (!date || !departureTime) return false;
        const targetDate = new Date(date);
        if (isNaN(targetDate.getTime())) return false;
        const isMonday = targetDate.getDay() === 1;
        const is6or7 = departureTime === '6' || departureTime === '7';
        return isMonday && !is6or7;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!selectedAdminId) {
            setErrorMsg('エラー：提出先の管理者が選択されていません。');
            return;
        }

        // 電話番号形式チェック
        const telRegex = /^\d{2,4}-\d{2,4}-\d{3,4}$/;
        if (!telRegex.test(formData.emergencyContact)) {
            setErrorMsg('エラー：連絡先は xxx-xxxx-xxxx の形式で入力してください。');
            return;
        }

        setSubmitting(true);
        // メールアドレスの結合
        const email = formData.groupLeader.emailDomain === 'other'
            ? formData.groupLeader.emailLocal + formData.groupLeader.customDomain
            : formData.groupLeader.emailLocal + formData.groupLeader.emailDomain;

        try {
            const res = await fetch('/api/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ formData: { ...formData, email }, adminId: selectedAdminId, resubmitToken: token })
            });
            const data = await res.json();
            if (data.success) {
                setSubmitted(true);
            } else {
                setErrorMsg(data.error || '送信に失敗しました。');
            }
        } catch {
            setErrorMsg('通信エラーが発生しました。');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className={styles.container}><main className={styles.main}><p>読み込み中...</p></main></div>;

    if (tokenError) {
        return (
            <div className={styles.container}>
                <main className={styles.main}>
                    <h1 className={styles.title}>リンクエラー</h1>
                    <div style={{ backgroundColor: '#fff5f5', padding: '1.5rem', borderRadius: '8px', border: '1px solid #fc8181', color: '#c53030', marginBottom: '1rem' }}>
                        {tokenError}
                    </div>
                    <Link href="/" style={{ color: '#3182ce' }}>→ 新規申請フォームへ</Link>
                </main>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className={styles.container}>
                <main className={styles.main}>
                    <div style={{ backgroundColor: '#f0fff4', padding: '2rem', borderRadius: '8px', border: '1px solid #9ae6b4', color: '#276749', textAlign: 'center' }}>
                        <h2 style={{ marginTop: 0 }}>再申請が完了しました</h2>
                        <p>管理者と申請者（あなた）にメールを送信しました。</p>
                        <Link href="/" style={{ color: '#3182ce' }}>トップに戻る</Link>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <main className={styles.main}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h1 className={styles.title} style={{ marginBottom: 0 }}>フィールドワーク計画書 — 修正・再申請</h1>
                    <Link href="/admin" style={{ fontSize: '0.9rem', color: '#4a5568', textDecoration: 'underline' }}>管理者ページ</Link>
                </div>
                <p className={styles.description} style={{ color: '#e53e3e' }}>
                    元の申請データが読み込まれています。内容を修正して再申請してください。
                </p>

                {errorMsg && <div style={{ backgroundColor: '#fff5f5', padding: '1rem', borderRadius: '8px', border: '1px solid #fc8181', color: '#c53030', width: '100%', marginBottom: '2rem' }}>{errorMsg}</div>}

                <form className={styles.form} onSubmit={handleSubmit}>
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>1. グループ情報</h2>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>グループ番号 (必須)</label>
                            <input type="number" className={styles.input} required placeholder="例: 1"
                                value={formData.groupNumber} onChange={e => handleInputChange('groupNumber', e.target.value)} />
                        </div>
                        <div className={styles.memberCard}>
                            <h3 className={styles.memberTitle}>グループリーダー (必須)</h3>
                            <div className={styles.flexRow}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>クラス</label>
                                    <input type="text" className={styles.input} required placeholder="例: A組"
                                        value={formData.groupLeader.class} onChange={e => handleLeaderChange('class', e.target.value)} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>出席番号</label>
                                    <input type="number" className={styles.input} required placeholder="例: 15"
                                        value={formData.groupLeader.number} onChange={e => handleLeaderChange('number', e.target.value)} />
                                </div>
                            </div>
                            <div className={styles.flexRow}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>氏名</label>
                                    <input type="text" className={styles.input} required placeholder="山田 太郎"
                                        value={formData.groupLeader.name} onChange={e => handleLeaderChange('name', e.target.value)} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>フリガナ</label>
                                    <input type="text" className={styles.input} placeholder="ヤマダ タロウ"
                                        value={formData.groupLeader.furigana} onChange={e => handleLeaderChange('furigana', e.target.value)} />
                                </div>
                            </div>
                            <div className={styles.flexRow}>
                                <div className={styles.formGroup} style={{ flex: 2 }}>
                                    <label className={styles.label}>メールアドレス (必須・再申請用)</label>
                                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                        <input type="text" className={styles.input} required placeholder="yamada"
                                            value={formData.groupLeader.emailLocal} onChange={e => handleLeaderChange('emailLocal', e.target.value)} />
                                        <select className={styles.select} style={{ width: 'auto' }}
                                            value={formData.groupLeader.emailDomain} onChange={e => handleLeaderChange('emailDomain', e.target.value)}>
                                            <option value="@hokuyo2.kansai-u.ac.jp">@hokuyo2.kansai-u.ac.jp</option>
                                            <option value="@gmail.com">@gmail.com</option>
                                            <option value="@yahoo.co.jp">@yahoo.co.jp</option>
                                            <option value="@icloud.com">@icloud.com</option>
                                            <option value="other">直接入力</option>
                                        </select>
                                        {formData.groupLeader.emailDomain === 'other' && (
                                            <input type="text" className={styles.input} required placeholder="@example.com"
                                                value={formData.groupLeader.customDomain} onChange={e => handleLeaderChange('customDomain', e.target.value)} />
                                        )}
                                    </div>
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>緊急連絡先 (xxx-xxxx-xxxx)</label>
                                    <input type="text" className={styles.input} required placeholder="例: 090-1234-5678"
                                        value={formData.emergencyContact} onChange={e => handleInputChange('emergencyContact', e.target.value)} />
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>2. フィールドワーク情報</h2>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>実施目的 (必須)</label>
                            <textarea className={styles.textarea} required value={formData.purpose}
                                onChange={e => handleInputChange('purpose', e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 className={styles.memberTitle} style={{ margin: 0 }}>実施スケジュール</h3>
                            <button type="button" onClick={handleAddSchedule}
                                style={{ padding: '0.3rem 0.8rem', backgroundColor: '#3182ce', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                            >
                                + 日程追加
                            </button>
                        </div>

                        {formData.schedules.map((schedule, index) => (
                            <div key={index} className={styles.memberCard} style={{ marginBottom: '1.5rem', borderLeft: '4px solid #3182ce' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <span style={{ fontWeight: 'bold' }}>日程 {index + 1}</span>
                                    {formData.schedules.length > 1 && (
                                        <button type="button" onClick={() => handleRemoveSchedule(index)}
                                            style={{ padding: '0.2rem 0.6rem', backgroundColor: '#e53e3e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                        >削除</button>
                                    )}
                                </div>
                                <div className={styles.flexRow}>
                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>実施日 (必須)</label>
                                        <input type="date" className={styles.input} required
                                            value={schedule.date} onChange={e => handleScheduleChange(index, 'date', e.target.value)} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.label}>出発時間 (必須)</label>
                                        <select className={styles.select} required value={schedule.departureTime} onChange={e => handleScheduleChange(index, 'departureTime', e.target.value)}>
                                            <option value="">選択してください</option>
                                            {[1, 2, 3, 4, 5, 6, 7].map(num => (
                                                <option key={num} value={num.toString()}>{num}時間目</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                {isMondayNot6or7(schedule.date, schedule.departureTime) && (
                                    <div style={{ backgroundColor: '#fffaf0', padding: '0.8rem', borderRadius: '6px', border: '1px solid #ed8936', marginBottom: '1rem', fontSize: '0.9rem', color: '#9c4221' }}>
                                        ⚠️ 月曜日の実施は6・7時間目以外は注意が必要です。
                                    </div>
                                )}
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>実施場所 (必須)</label>
                                    <input type="text" className={styles.input} required placeholder="例: 大阪市役所、関西大学 など"
                                        value={schedule.location} onChange={e => handleInputChange('location', e.target.value)} />
                                </div>
                            </div>
                        ))}
                        {isSchoolLocation && (
                            <div style={{ backgroundColor: '#fff5f5', padding: '1rem', borderRadius: '8px', border: '1px solid #fc8181', marginBottom: '1.5rem' }}>
                                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', color: '#c53030' }}>◆ 小中学校・義務教育学校へのフィールドワークに関する確認事項</p>
                                <label className={styles.checkboxLabel} style={{ background: 'white', border: '1px solid #e2e8f0' }}>
                                    <input type="checkbox" className={styles.checkbox} required
                                        checked={formData.isAlmaMater} onChange={e => handleInputChange('isAlmaMater', e.target.checked)} />
                                    自分もしくはグループメンバーの出身校（母校）である。（自己申告制）
                                </label>
                                <label className={styles.checkboxLabel} style={{ background: 'white', border: '1px solid #e2e8f0' }}>
                                    <input type="checkbox" className={styles.checkbox} required
                                        checked={formData.hasRequestLetter} onChange={e => handleInputChange('hasRequestLetter', e.target.checked)} />
                                    後日、アポイントを取る際、関西大学北陽高等学校からの「依頼書」が必要であることを確認した。
                                </label>
                            </div>
                        )}
                        {isKandaiLocation && (
                            <div style={{ backgroundColor: '#ebf8ff', padding: '1rem', borderRadius: '8px', border: '1px solid #90cdf4', marginBottom: '1.5rem' }}>
                                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', color: '#2b6cb0' }}>◆ 関西大学へのフィールドワークに関する確認事項</p>
                                <label className={styles.checkboxLabel} style={{ background: 'white', border: '1px solid #e2e8f0', marginTop: 0 }}>
                                    <input type="checkbox" className={styles.checkbox} required
                                        checked={formData.hasConfirmedWithTeacher} onChange={e => handleInputChange('hasConfirmedWithTeacher', e.target.checked)} />
                                    必ず担当教員（引率・受け入れ先）に事前確認を行いました。
                                </label>
                            </div>
                        )}
                        <div className={styles.formGroup}>
                            <label className={styles.label}>対象者 (必須)</label>
                            <input type="text" className={styles.input} required placeholder="例: 一般の通行人、大学生 など"
                                value={formData.target} onChange={e => handleInputChange('target', e.target.value)} />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>実施方法 (必須)</label>
                            <select className={styles.select} required value={formData.method} onChange={e => handleInputChange('method', e.target.value)}>
                                <option value="">選択してください</option>
                                <option value="インタビュー">インタビュー・聞き取り</option>
                                <option value="アンケート">アンケート調査</option>
                                <option value="観察">現地観察・見学</option>
                                <option value="その他">その他</option>
                            </select>
                        </div>
                        {formData.method === 'アンケート' && (
                            <div className={styles.formGroup}>
                                <label className={styles.label}>アンケート内容 (必須: 質問項目など具体的に)</label>
                                <textarea className={styles.textarea} required
                                    value={formData.surveyContent} onChange={e => handleInputChange('surveyContent', e.target.value)} />
                            </div>
                        )}
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>3. 事前仮説</h2>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>フィールドワーク実施前の仮説 (必須)</label>
                            <textarea className={styles.textarea} required placeholder="調査を行う前に、どのような結果が出ると予想しているかを記述してください。"
                                value={formData.hypothesis} onChange={e => handleInputChange('hypothesis', e.target.value)} />
                        </div>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>4. 提出先の選択</h2>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>提出先（管理者を選択）</label>
                            <select className={styles.select} value={selectedAdminId} onChange={e => setSelectedAdminId(e.target.value)} required>
                                {admins.length === 0 && <option value="">管理者が登録されていません</option>}
                                {admins.map(admin => (
                                    <option key={admin.id} value={admin.id}>{admin.name}</option>
                                ))}
                            </select>
                        </div>
                    </section>

                    <div className={styles.buttonContainer}>
                        <button type="submit" className={styles.submitButton} disabled={submitting || admins.length === 0}>
                            {submitting ? '送信中...' : '修正内容を再申請する'}
                        </button>
                    </div>
                </form>
            </main>
        </div>
    );
}

export default function ResubmitPage() {
    return (
        <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>読み込み中...</div>}>
            <ResubmitForm />
        </Suspense>
    );
}
