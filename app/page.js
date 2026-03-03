'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
    const [formData, setFormData] = useState({
        groupNumber: '',
        groupLeader: { class: '', number: '', name: '', furigana: '', emailLocal: '', emailDomain: '@hokuyo2.kansai-u.ac.jp', customDomain: '' },
        emergencyContact: '',
        members: [],
        purpose: '',
        schedules: [{ date: '', departureTime: '', location: '' }], // 複数日程対応
        target: '',
        method: '',
        surveyContent: '',
        hypothesis: '',
        // 特別チェック項目
        isAlmaMater: false,
        hasRequestLetter: false,
        hasConfirmedWithTeacher: false,
    });

    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // 管理者リストと選択状態
    const [admins, setAdmins] = useState([]);
    const [selectedAdminId, setSelectedAdminId] = useState('');

    // ページ読み込み時に管理者をフェッチ
    useEffect(() => {
        fetch('/api/admins')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setAdmins(data.admins);
                    if (data.admins.length > 0) {
                        setSelectedAdminId(data.admins[0].id);
                    }
                }
            })
            .catch(err => console.error("Failed to fetch admins", err));
    }, []);

    const handleInputChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleLeaderChange = (field, value) => {
        setFormData((prev) => ({
            ...prev,
            groupLeader: { ...prev.groupLeader, [field]: value }
        }));
    };

    // メンバー操作
    const handleAddMember = () => {
        setFormData(prev => ({
            ...prev,
            members: [...prev.members, { class: '', number: '', name: '', furigana: '' }]
        }));
    };

    const handleRemoveMember = (index) => {
        setFormData(prev => ({
            ...prev,
            members: prev.members.filter((_, i) => i !== index)
        }));
    };

    const handleMemberChange = (index, field, value) => {
        setFormData(prev => {
            const newMembers = [...prev.members];
            newMembers[index] = { ...newMembers[index], [field]: value };
            return { ...prev, members: newMembers };
        });
    };

    const isSchoolLocation = formData.schedules.some(s => s.location.includes('小学校') || s.location.includes('中学校') || s.location.includes('義務教育学校'));
    const isKandaiLocation = formData.schedules.some(s => s.location.includes('関西'));

    // 日程操作
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

    // 月曜日の6,7限以外の警告判定
    const isMondayNot6or7 = (date, departureTime) => {
        if (!date || !departureTime) return false;
        const targetDate = new Date(date);
        if (isNaN(targetDate.getTime())) return false;
        const isMonday = targetDate.getDay() === 1; // 1は月曜日
        const is6or7 = departureTime === '6' || departureTime === '7';
        return isMonday && !is6or7;
    };

    // 日付チェックユーティリティ：実施日の前の週の木曜日か
    const isValidDeadline = (inputDateStr) => {
        // 簡易的な日付パース (例: 2026-10-15 または カレンダー入力想定で yyyy-mm-dd)
        // カレンダー入力を強制するため、type="date"に変更します
        const targetDate = new Date(inputDateStr);
        if (isNaN(targetDate.getTime())) return true; // 解析不能な場合はスキップ

        const today = new Date();
        // 実施週の前の週の木曜日という制約
        // わかりやすいロジックとして、今日が「ターゲット日付の前の週の木曜日」以前であるかをチェックする
        // ここでは簡便のため「ターゲット日付の7日以上前であること」と条件を近似するか、
        // より厳密にはカレンダー計算をする必要がありますが、まずは簡易的に7日前（1週間前）以降はエラーとする
        const diffTime = targetDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // 目安として10日以上の猶予が必要（前の週の木曜なので、月・火実施だと約11日前、金曜実施だと約8日前）
        // ここではわかりやすく、猶予が7日未満の場合は警告を出します
        return diffDays >= 7;
    }

    const [submitLoading, setSubmitLoading] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        // バリデーション
        for (const schedule of formData.schedules) {
            if (schedule.date && !isValidDeadline(schedule.date)) {
                setErrorMsg(`エラー：実施日 ${schedule.date} は申請期限を過ぎている可能性があります。`);
                window.scrollTo(0, 0);
                return;
            }
        }

        // 電話番号形式チェック
        const telRegex = /^\d{2,4}-\d{2,4}-\d{3,4}$/;
        if (!telRegex.test(formData.emergencyContact)) {
            setErrorMsg('エラー：連絡先は xxx-xxxx-xxxx の形式で入力してください。');
            window.scrollTo(0, 0);
            return;
        }

        if (!selectedAdminId) {
            setErrorMsg('エラー：提出先の管理者が選択されていません。');
            window.scrollTo(0, 0);
            return;
        }

        setLoading(true);

        // メールアドレスの結合
        const email = formData.groupLeader.emailDomain === 'other'
            ? formData.groupLeader.emailLocal + formData.groupLeader.customDomain
            : formData.groupLeader.emailLocal + formData.groupLeader.emailDomain;

        try {
            const res = await fetch('/api/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    formData: { ...formData, email },
                    adminId: selectedAdminId
                })
            });
            const data = await res.json();
            if (data.success) {
                setSubmitSuccess(true);
            } else {
                setErrorMsg(data.error);
                window.scrollTo(0, 0);
            }
        } catch (err) {
            setErrorMsg('通信エラーが発生しました。');
            window.scrollTo(0, 0);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <main className={styles.main}>
                <div className={styles.headerFlex}>
                    <h1 className={styles.title}>フィールドワーク計画書作成システム</h1>
                    <Link href="/admin" className={styles.adminLink}>管理者ページ</Link>
                </div>
                <p className={styles.description}>関西大学北陽高等学校 企×学協働プロジェクト「刀」</p>

                {errorMsg && <div style={{ backgroundColor: '#fff5f5', padding: '1rem', borderRadius: '8px', border: '1px solid #fc8181', color: '#c53030', width: '100%', marginBottom: '2rem' }}>{errorMsg}</div>}

                {submitSuccess && (
                    <div style={{ backgroundColor: '#f0fff4', padding: '2rem', borderRadius: '8px', border: '1px solid #9ae6b4', color: '#276749', width: '100%', marginBottom: '2rem', textAlign: 'center' }}>
                        <h2 style={{ marginTop: 0 }}>送信完了しました</h2>
                        <p>管理者にフィールドワーク計画書が提出されました。</p>
                        <button onClick={() => window.location.reload()} className={styles.submitButton} style={{ marginTop: '1rem', width: 'auto', padding: '0.5rem 2rem' }}>最初からやり直す</button>
                    </div>
                )}

                {!submitSuccess && (
                    <form className={styles.form} onSubmit={handleSubmit}>
                        {/* 1. グループ情報 */}
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
                                        <input type="text" className={styles.input} required placeholder="ヤマダ タロウ"
                                            value={formData.groupLeader.furigana} onChange={e => handleLeaderChange('furigana', e.target.value)} />
                                    </div>
                                </div>
                                <div className={styles.flexRow}>
                                    <div className={styles.formGroup} style={{ flex: 2 }}>
                                        <label className={styles.label}>メールアドレス (必須・再申請用)</label>
                                        <div className={styles.emailInputGroup}>
                                            <input type="text" className={styles.input} required placeholder="yamada"
                                                value={formData.groupLeader.emailLocal} onChange={e => handleLeaderChange('emailLocal', e.target.value)} />
                                            <select className={styles.select}
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
                                        <label className={styles.label}>連絡先 (xxx-xxxx-xxxx)</label>
                                        <input type="text" className={styles.input} required placeholder="例: 090-1234-5678"
                                            value={formData.emergencyContact} onChange={e => handleInputChange('emergencyContact', e.target.value)} />
                                    </div>
                                </div>
                            </div>

                            {/* グループメンバー */}
                            <div style={{ marginTop: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <h3 className={styles.memberTitle} style={{ margin: 0 }}>グループメンバー（リーダー以外）</h3>
                                    <button type="button" onClick={handleAddMember}
                                        style={{ padding: '0.3rem 0.8rem', backgroundColor: '#4a5568', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                                        disabled={formData.members.length >= 10}
                                    >
                                        + メンバー追加
                                    </button>
                                </div>

                                {formData.members.length === 0 && (
                                    <p style={{ color: '#718096', fontSize: '0.875rem', margin: '0 0 0.5rem 0' }}>「メンバー追加」ボタンでメンバーを追加できます。</p>
                                )}

                                {formData.members.map((member, index) => (
                                    <div key={index} className={styles.memberCard} style={{ position: 'relative', marginBottom: '0.75rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#4a5568' }}>メンバー {index + 1}</span>
                                            <button type="button" onClick={() => handleRemoveMember(index)}
                                                style={{ padding: '0.2rem 0.6rem', backgroundColor: '#e53e3e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                            >削除</button>
                                        </div>
                                        <div className={styles.flexRow}>
                                            <div className={styles.formGroup}>
                                                <label className={styles.label}>クラス</label>
                                                <input type="text" className={styles.input} placeholder="例: A組"
                                                    value={member.class} onChange={e => handleMemberChange(index, 'class', e.target.value)} />
                                            </div>
                                            <div className={styles.formGroup}>
                                                <label className={styles.label}>出席番号</label>
                                                <input type="number" className={styles.input} placeholder="例: 8"
                                                    value={member.number} onChange={e => handleMemberChange(index, 'number', e.target.value)} />
                                            </div>
                                        </div>
                                        <div className={styles.flexRow}>
                                            <div className={styles.formGroup}>
                                                <label className={styles.label}>氏名</label>
                                                <input type="text" className={styles.input} placeholder="山田 次郎"
                                                    value={member.name} onChange={e => handleMemberChange(index, 'name', e.target.value)} />
                                            </div>
                                            <div className={styles.formGroup}>
                                                <label className={styles.label}>フリガナ</label>
                                                <input type="text" className={styles.input} placeholder="ヤマダ ジロウ"
                                                    value={member.furigana} onChange={e => handleMemberChange(index, 'furigana', e.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* 2. フィールドワーク情報 */}
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>2. フィールドワーク情報</h2>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>実施目的 (必須)</label>
                                <textarea className={styles.textarea} required placeholder="フィールドワークを通して何を明らかにしたいか記述してください。"
                                    value={formData.purpose} onChange={e => handleInputChange('purpose', e.target.value)} />
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
                                            <select className={styles.select} required
                                                value={schedule.departureTime} onChange={e => handleScheduleChange(index, 'departureTime', e.target.value)}>
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
                                            value={schedule.location} onChange={e => handleScheduleChange(index, 'location', e.target.value)} />
                                    </div>
                                </div>
                            ))}

                            {/* 小中学校チェック */}
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

                            {/* 関西大学チェック */}
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
                                <select className={styles.select} required
                                    value={formData.method} onChange={e => handleInputChange('method', e.target.value)}>
                                    <option value="">選択してください</option>
                                    <option value="インタビュー">インタビュー・聞き取り</option>
                                    <option value="アンケート">アンケート調査</option>
                                    <option value="観察">現地観察・見学</option>
                                    <option value="その他">その他</option>
                                </select>
                            </div>

                            {/* アンケート内容 (実施方法がアンケートの場合のみ) */}
                            {formData.method === 'アンケート' && (
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>アンケート内容 (必須: 質問項目など具体的に)</label>
                                    <textarea className={styles.textarea} required placeholder="1. 〇〇についてどう思いますか？&#13;&#10;2. ... (目的を達成できる内容かAIがチェックします)"
                                        value={formData.surveyContent} onChange={e => handleInputChange('surveyContent', e.target.value)} />
                                </div>
                            )}
                        </section>

                        {/* 3. 事前仮説 */}
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>3. 事前仮説</h2>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>フィールドワーク実施前の仮説 (必須)</label>
                                <textarea className={styles.textarea} required placeholder="調査を行う前に、どのような結果が出ると予想しているかを記述してください。"
                                    value={formData.hypothesis} onChange={e => handleInputChange('hypothesis', e.target.value)} />
                            </div>
                        </section>

                        {/* 4. 提出先選択・送信ボタン */}
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>4. 提出先の選択</h2>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>提出先（管理者を選択）</label>
                                <select className={styles.select} value={selectedAdminId} onChange={e => setSelectedAdminId(e.target.value)} required>
                                    {admins.length === 0 && <option value="">管理者が登録されていません</option>}
                                    {admins.map(admin => (
                                        <option key={admin.id} value={admin.id}>{admin.name}</option>
                                    ))}</select>
                            </div>
                        </section>

                        <div className={styles.buttonContainer}>
                            <button type="submit" className={styles.submitButton} disabled={loading || admins.length === 0}>
                                {loading ? '送信中...' : '計画書を提出する'}
                            </button>
                        </div>
                    </form>
                )}
            </main>
        </div>
    );
}
