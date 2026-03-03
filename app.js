document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements - Navigation
    const navList = document.getElementById('nav-list');
    const navPast = document.getElementById('nav-past');
    const navPost = document.getElementById('nav-post');
    const navAdmin = document.getElementById('nav-admin');

    // DOM Elements - Views
    const viewList = document.getElementById('view-list');
    const viewPast = document.getElementById('view-past');
    const viewPost = document.getElementById('view-post');
    const viewDetail = document.getElementById('view-detail');
    const viewAdmin = document.getElementById('view-admin');

    // DOM Elements - Forms & Containers
    const postForm = document.getElementById('post-form');
    const btnCancelPost = document.getElementById('btn-cancel-post');
    const questionsContainer = document.getElementById('questions-container');
    const pastQuestionsContainer = document.getElementById('past-questions-container');
    const emptyState = document.getElementById('empty-state');
    const pastEmptyState = document.getElementById('past-empty-state');
    const detailCard = document.getElementById('detail-card');
    const btnBack = document.getElementById('btn-back');
    const toast = document.getElementById('toast');

    // Admin Modal & View Elements
    const adminModal = document.getElementById('admin-modal');
    const adminLoginForm = document.getElementById('admin-login-form');
    const adminPasswordInput = document.getElementById('admin-password');
    const adminError = document.getElementById('admin-error');
    const btnAdminCancel = document.getElementById('btn-admin-cancel');
    const btnAdminLogout = document.getElementById('btn-admin-logout');
    const adminPostForm = document.getElementById('admin-post-form');
    const adminQuestionsList = document.getElementById('admin-questions-list');

    // Data Store (LocalStorage)
    let questions = JSON.parse(localStorage.getItem('qb_questions')) || [];
    let myTokens = JSON.parse(localStorage.getItem('qb_my_tokens')) || [];
    let isAdminAuthenticated = sessionStorage.getItem('qb_admin_auth') === 'true';

    // Admin Password Setting
    const ADMIN_PASS = 'hokuyoJ1326';

    // Automatic Deletion logic (6 months = ~180 days)
    const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
    const now = new Date();

    // Clean up expired (older than 6 months after deadline)
    questions = questions.filter(q => {
        if (!q.reqDeadline) return true; // Keep old data without deadline for fallback
        const deadlineDate = new Date(q.reqDeadline);
        // If deadline is passed AND 6 months have passed since the deadline
        if (now > deadlineDate && (now.getTime() - deadlineDate.getTime()) > SIX_MONTHS_MS) {
            return false; // delete this question automatically
        }
        return true;
    });
    saveQuestions(); // Save cleaned up list immediately

    // Navigation logic
    let lastViewList = 'view-list'; // track if we came from list or past-list

    function switchView(viewId) {
        if (viewId === 'view-admin') {
            if (!isAdminAuthenticated) {
                adminModal.classList.remove('hidden');
                adminPasswordInput.value = '';
                adminError.classList.add('hidden');
                adminPasswordInput.focus();
                return; // Prevent navigating yet
            }
            renderAdminList();
        }

        // Hide all views
        [viewList, viewPast, viewPost, viewDetail, viewAdmin].forEach(el => el.classList.remove('active'));
        // Show target
        document.getElementById(viewId).classList.add('active');

        // Update nav buttons
        [navList, navPast, navPost, navAdmin].forEach(btn => btn.classList.remove('active'));

        if (viewId === 'view-list') {
            navList.classList.add('active');
            lastViewList = 'view-list';
            renderQuestions();
        } else if (viewId === 'view-past') {
            navPast.classList.add('active');
            lastViewList = 'view-past';
            renderQuestions();
        } else if (viewId === 'view-post') {
            navPost.classList.add('active');
            postForm.reset();
        } else if (viewId === 'view-admin') {
            navAdmin.classList.add('active');
        }
    }

    navList.addEventListener('click', () => switchView('view-list'));
    navPast.addEventListener('click', () => switchView('view-past'));
    navPost.addEventListener('click', () => switchView('view-post'));
    navAdmin.addEventListener('click', () => switchView('view-admin'));
    btnCancelPost.addEventListener('click', () => switchView(lastViewList));
    btnBack.addEventListener('click', () => switchView(lastViewList));

    // Create New Question Logic
    function createQuestionData(qClass, num, name, url, qText, deadline) {
        const token = Math.random().toString(36).substring(2, 15);
        const newQuestion = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
            reqClass: qClass,
            reqNumber: num,
            reqName: name,
            reqUrl: url,
            reqQuestion: qText,
            reqDeadline: deadline,
            date: new Date().toISOString(),
            deleteToken: token
        };

        questions.unshift(newQuestion);
        saveQuestions();

        // Save token so author can delete their own post
        myTokens.push(token);
        localStorage.setItem('qb_my_tokens', JSON.stringify(myTokens));
    }

    // Normal Post Form Submit
    postForm.addEventListener('submit', (e) => {
        e.preventDefault();
        createQuestionData(
            document.getElementById('req-class').value.trim(),
            document.getElementById('req-number').value.trim(),
            document.getElementById('req-name').value.trim(),
            document.getElementById('req-url').value.trim(),
            document.getElementById('req-question').value.trim(),
            document.getElementById('req-deadline').value
        );
        showToast('投稿が完了しました！');
        switchView('view-list');
    });

    // Delete Question Logic
    window.deleteQuestion = function (id) {
        if (confirm('本当にこの質問を削除しますか？\n(※削除すると元に戻せません)')) {
            questions = questions.filter(q => q.id !== id);
            saveQuestions();
            showToast('削除しました');

            // re-render depending on view
            if (viewAdmin.classList.contains('active')) {
                renderAdminList();
                renderQuestions(); // Keep list updated in background
            } else {
                switchView(lastViewList);
            }
        }
    };

    function saveQuestions() {
        localStorage.setItem('qb_questions', JSON.stringify(questions));
    }

    function formatDate(isoString) {
        const d = new Date(isoString);
        return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    // Helpers to split Active vs Past
    function isExpired(q) {
        if (!q.reqDeadline) return false;
        // set deadline to end of day
        const deadline = new Date(q.reqDeadline);
        deadline.setHours(23, 59, 59, 999);
        return new Date() > deadline;
    }

    // Render List
    function renderQuestions() {
        const activeQuestions = [];
        const pastQuestions = [];

        questions.forEach(q => {
            if (isExpired(q)) pastQuestions.push(q);
            else activeQuestions.push(q);
        });

        // 1. Render Active
        questionsContainer.innerHTML = '';
        if (activeQuestions.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
            activeQuestions.forEach(q => renderCard(q, questionsContainer, false));
        }

        // 2. Render Past
        pastQuestionsContainer.innerHTML = '';
        if (pastQuestions.length === 0) {
            pastEmptyState.classList.remove('hidden');
        } else {
            pastEmptyState.classList.add('hidden');
            // Sort past questions: newest deadline first
            pastQuestions.sort((a, b) => new Date(b.reqDeadline) - new Date(a.reqDeadline));
            pastQuestions.forEach(q => renderCard(q, pastQuestionsContainer, true));
        }
    }

    // Generic render card logic
    function renderCard(q, container, isPast) {
        const card = document.createElement('div');
        card.className = 'question-card';
        card.onclick = () => showDetail(q.id);

        const deadlineBadge = q.reqDeadline
            ? `<span class="deadline-badge ${isPast ? 'expired' : ''}">期限: ${q.reqDeadline}</span>`
            : '';

        card.innerHTML = `
            <div>
                <div class="card-header">
                    <div class="card-author">
                        <span class="author-badge">${escapeHTML(q.reqClass)} - ${escapeHTML(q.reqNumber)}</span>
                        <span>${escapeHTML(q.reqName)}</span>
                        ${deadlineBadge}
                    </div>
                </div>
                <div class="card-title">${escapeHTML(q.reqQuestion)}</div>
            </div>
            <div class="card-footer">
                <span class="date">${formatDate(q.date)}</span>
                ${q.reqUrl ? '<span class="url-indicator">🔗 リンクあり</span>' : ''}
            </div>
        `;
        container.appendChild(card);
    }

    // Show Detail View
    function showDetail(id) {
        const q = questions.find(item => item.id === id);
        if (!q) return;

        const isAuthor = myTokens.includes(q.deleteToken);
        const isPast = isExpired(q);
        const deadlineText = q.reqDeadline ? q.reqDeadline : '設定なし';

        detailCard.innerHTML = `
            <div class="detail-header">
                <div class="detail-meta">
                    <div class="meta-item">
                        <span class="meta-label">クラス</span>
                        <span class="meta-val">${escapeHTML(q.reqClass)}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">番号</span>
                        <span class="meta-val">${escapeHTML(q.reqNumber)}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">氏名</span>
                        <span class="meta-val">${escapeHTML(q.reqName)}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">回答期限</span>
                        <span class="meta-val" style="${isPast ? 'color:#ef4444;' : ''}">${deadlineText}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">投稿日時</span>
                        <span class="meta-val">${formatDate(q.date)}</span>
                    </div>
                </div>
                ${isAuthor ? `<button class="btn danger-btn" onclick="deleteQuestion('${q.id}')">この質問を削除</button>` : ''}
            </div>
            
            <div class="detail-content">
                ${escapeHTML(q.reqQuestion).replace(/\n/g, '<br>')}
            </div>

            <div class="detail-url-box">
                <span class="url-box-label">参考URL</span>
                <a href="${escapeHTML(q.reqUrl)}" target="_blank" rel="noopener noreferrer" class="external-link">
                    ${escapeHTML(q.reqUrl)} ↗
                </a>
            </div>
        `;

        switchView('view-detail');
    }

    // --- Admin Logic --- //

    // Login Form
    adminLoginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const pwd = adminPasswordInput.value;
        if (pwd === ADMIN_PASS) {
            isAdminAuthenticated = true;
            sessionStorage.setItem('qb_admin_auth', 'true');
            adminModal.classList.add('hidden');
            switchView('view-admin');
            showToast('管理者モードでログインしました');
        } else {
            adminError.classList.remove('hidden');
        }
    });

    // Cancel Login
    btnAdminCancel.addEventListener('click', () => {
        adminModal.classList.add('hidden');
    });

    // Logout
    btnAdminLogout.addEventListener('click', () => {
        isAdminAuthenticated = false;
        sessionStorage.removeItem('qb_admin_auth');
        showToast('ログアウトしました');
        switchView('view-list');
    });

    // Admin Add Form
    adminPostForm.addEventListener('submit', (e) => {
        e.preventDefault();
        createQuestionData(
            document.getElementById('admin-req-class').value.trim(),
            document.getElementById('admin-req-number').value.trim(),
            document.getElementById('admin-req-name').value.trim(),
            document.getElementById('admin-req-url').value.trim(),
            document.getElementById('admin-req-question').value.trim(),
            document.getElementById('admin-req-deadline').value
        );
        showToast('管理ルートで追加しました');
        adminPostForm.reset();
        renderAdminList();
    });

    // Render Admin List
    function renderAdminList() {
        adminQuestionsList.innerHTML = '';
        if (questions.length === 0) {
            adminQuestionsList.innerHTML = '<p style="color:var(--text-muted); padding:10px;">投稿がありません</p>';
            return;
        }

        // Sort by newest post
        const sorted = [...questions].sort((a, b) => new Date(b.date) - new Date(a.date));

        sorted.forEach(q => {
            const expired = isExpired(q);
            const statusLabel = expired ? '<span style="color:#ef4444; font-size: 0.75rem;">[期限切]</span>' : '<span style="color:#10b981; font-size: 0.75rem;">[回答中]</span>';

            const item = document.createElement('div');
            item.className = 'admin-list-item';
            item.innerHTML = `
                <div class="admin-list-item-info">
                    <div class="admin-list-item-title">
                        ${statusLabel} ${escapeHTML(q.reqQuestion).substring(0, 30)}${q.reqQuestion.length > 30 ? '...' : ''}
                    </div>
                    <div class="admin-list-item-meta">
                        ${escapeHTML(q.reqClass)} - ${escapeHTML(q.reqNumber)} ${escapeHTML(q.reqName)} | 期限: ${q.reqDeadline || "なし"}
                    </div>
                </div>
                <button class="btn danger-btn" onclick="deleteQuestion('${q.id}')">削除</button>
            `;
            adminQuestionsList.appendChild(item);
        });
    }

    // Utility: Prevent XSS
    function escapeHTML(str) {
        return str ? str.replace(/[&<>'"]/g,
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        ) : "";
    }

    // Show Toast
    let toastTimeout;
    function showToast(msg) {
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Init
    renderQuestions();
});
