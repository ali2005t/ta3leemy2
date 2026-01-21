import { auth, db } from '../../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initHeader } from '../../header-manager.js';

let myLink = "";

// Ensure UIManager is available or provide fallback
const showToast = (msg, type = 'info') => {
    if (window.UIManager && window.UIManager.showToast) {
        window.UIManager.showToast(msg, type);
    } else {
        alert(msg);
    }
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        initHeader(user);
        await loadReferralData(user.uid);
    } else {
        window.location.href = '../auth/login.html';
    }
});

async function loadReferralData(uid) {
    try {
        // 1. Check Teacher Profile for "referralEnabled"
        const teacherDoc = await getDoc(doc(db, "teachers", uid));
        if (!teacherDoc.exists()) return;

        const teacherData = teacherDoc.data();
        if (!teacherData.referralEnabled) {
            document.getElementById('referral-disabled-view').style.display = 'block';
            return;
        }

        document.getElementById('referral-enabled-view').style.display = 'block';

        // 2. Generate Link
        const absLink = new URL('../auth/register.html', window.location.href);
        absLink.searchParams.set('role', 'teacher');
        absLink.searchParams.set('ref', uid);
        myLink = absLink.href;

        // 3. Load Referrals from DB
        const qRef = query(collection(db, "teachers"), where("referredBy", "==", uid), orderBy("createdAt", "desc"));
        const snapRef = await getDocs(qRef);

        let total = 0;
        let active = 0;
        const tbody = document.getElementById('referrals-table-body');
        tbody.innerHTML = '';

        if (snapRef.empty) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#94a3b8;">لم تقم بدعوة أحد بعد.</td></tr>';
        }

        snapRef.forEach(docSnap => {
            total++;
            const row = docSnap.data();
            if (row.isVerified) active++;
            const date = row.createdAt ? row.createdAt.toDate().toLocaleDateString('ar-EG') : '-';
            const status = row.isVerified
                ? '<span class="status-badge" style="background:#dcfce7; color:#166534;">نشط</span>'
                : '<span class="status-badge" style="background:#f1f5f9; color:#64748b;">معلق</span>';

            tbody.innerHTML += `<tr><td>${row.name}</td><td>${date}</td><td>${status}</td></tr>`;
        });

        document.getElementById('stats-total').innerText = total;
        document.getElementById('stats-active').innerText = active;

        // 4. Load Active Goals
        const goalsContainer = document.getElementById('active-goals-container');
        goalsContainer.innerHTML = '<p style="color:white; text-align:center;">جاري تحميل العروض...</p>';

        const qGoals = query(collection(db, "referral_goals"), where("isActive", "==", true), orderBy("targetCount", "asc"));
        const snapGoals = await getDocs(qGoals);

        if (snapGoals.empty) {
            goalsContainer.innerHTML = `
                <div class="referral-card">
                    <h2 style="color:white;">لا توجد عروض نشطة حالياً</h2>
                    <p style="color:#cbd5e1;">تابعنا لاحقاً لمعرفة العروض الجديدة!</p>
                        <div class="copy-link-box">
                        <i class="fas fa-link" style="color: #94a3b8;"></i>
                        <span class="link-text">${myLink}</span>
                        <button class="btn btn-primary" id="copy-link-btn-empty">نسخ الرابط</button>
                    </div>
                </div>`;

            // Attach event listener for the button in empty state
            setTimeout(() => {
                const btn = document.getElementById('copy-link-btn-empty');
                if (btn) btn.onclick = copyLink;
            }, 0);

        } else {
            goalsContainer.innerHTML = ''; // Clear loading

            snapGoals.forEach(gSnap => {
                const goal = gSnap.data();

                // 1. Check Date Validity
                const now = new Date();
                if (goal.startDate && new Date(goal.startDate.toDate()) > now) return; // Not started yet
                if (goal.endDate && new Date(goal.endDate.toDate()) < now) return; // Expired

                // 2. Check Target
                if (goal.targetType === 'specific' && goal.targetId !== uid) return; // Not for me

                const target = goal.targetCount;
                const currentCount = active; // Assuming active referrals count towards goals
                const progress = Math.min(100, (currentCount / target) * 100);
                const isCompleted = currentCount >= target;
                const rewardText = goal.reward || 'مكافأة';

                // Use unique IDs or classes for event delegation if possible, but internal onclick in string is tricky with modules.
                // Better approach: Create element and append.
                // For simplicity in this refactor, we'll keep HTML string but bind events after via delegation or global if needed.
                // But wait, "onclick=alert()" was used. Modules don't expose globals easily.
                // We should expose copyLink to window or attach events.

                const cardHtml = `
                <div class="referral-card" style="margin-bottom: 2rem;">
                    <div style="position:absolute; top:10px; left:10px; background:rgba(255,255,255,0.1); padding:5px 10px; border-radius:20px; font-size:0.8rem; color:#cbd5e1;">
                        <i class="fas fa-gift" style="color:#f59e0b;"></i> ${rewardText}
                    </div>
                    
                    <h2 style="color: white; margin-top:1rem; margin-bottom: 0.5rem;">${goal.description}</h2>
                    <p style="color: #cbd5e1; margin-bottom: 1.5rem;">
                        ادعُ ${target} معلمين نشطين واحصل على الجائزة!
                    </p>

                    <div style="max-width: 600px; margin: 0 auto;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px; color:#94a3b8; font-size:0.9rem;">
                            <span>الحالي (${currentCount})</span>
                            <span>الهدف (${target})</span>
                        </div>
                        <div class="progress-container" style="margin:0 0 1rem 0;">
                            <div class="progress-bar" style="width: ${progress}%; background: ${isCompleted ? '#10b981' : '#f59e0b'};"></div>
                        </div>
                        ${isCompleted
                        ? `<button class="btn btn-primary claim-btn" style="background:#10b981; border:none;">🎉 استلام المكافأة</button>`
                        : `<p style="color:#60a5fa; font-size:0.9rem;">باقي ${target - currentCount} دعوات نشطة</p>`
                    }
                    </div>
                </div>`;
                goalsContainer.insertAdjacentHTML('beforeend', cardHtml);
            });

            // Add Link Box at the bottom
            goalsContainer.insertAdjacentHTML('beforeend', `
                <div class="referral-card" style="padding:1.5rem;">
                    <h4 style="color:white; margin:0 0 1rem 0;">رابط الدعوة الخاص بك</h4>
                    <div class="copy-link-box" style="margin:0; max-width:100%;">
                        <i class="fas fa-link" style="color: #94a3b8;"></i>
                        <span class="link-text">${myLink}</span>
                        <button class="btn btn-primary" id="copy-link-btn">نسخ</button>
                    </div>
                </div>
            `);

            // Attach Events
            const copyBtn = document.getElementById('copy-link-btn');
            if (copyBtn) copyBtn.addEventListener('click', copyLink);

            document.querySelectorAll('.claim-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    showToast('مبروك! سيتم التواصل معك قريباً لاستلام المكافأة.', 'success');
                });
            });
        }

        // 5. Load Leaderboard
        loadLeaderboard();

    } catch (e) {
        console.error(e);
        showToast("خطأ في تحميل البيانات", "error");
    }
}

async function loadLeaderboard() {
    const container = document.getElementById('leaderboard-list');
    if (!container) return;

    try {
        const q = query(collection(db, "teachers"), orderBy("referralCount", "desc"), limit(5));
        const snap = await getDocs(q);

        container.innerHTML = '';
        if (snap.empty) {
            container.innerHTML = '<div style="text-align:center; color:#64748b; padding:10px;">لا يوجد بيانات</div>';
            return;
        }

        let rank = 1;
        snap.forEach(docSnap => {
            const t = docSnap.data();
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            item.style.cssText = `
                display: flex; align-items: center; justify-content: space-between;
                padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05);
            `;
            let rankIcon = `<span style="font-weight:bold; width:20px;">#${rank}</span>`;
            if (rank === 1) rankIcon = '🥇';
            if (rank === 2) rankIcon = '🥈';
            if (rank === 3) rankIcon = '🥉';

            item.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="font-size:1.2rem;">${rankIcon}</div>
                    <div style="font-weight:bold; color:white;">${t.name}</div>
                </div>
                <div style="color:#10b981; font-weight:bold;">${t.referralCount || 0} دعوة</div>
            `;
            container.appendChild(item);

            // Check if this is me to update rank card
            if (docSnap.id === auth.currentUser.uid) {
                const rankEl = document.getElementById('stats-rank');
                if (rankEl) rankEl.innerText = `#${rank}`;
            }

            rank++;
        });

    } catch (e) { console.error("Leaderboard Error", e); }
}

window.copyLink = () => {
    if (!myLink) return;
    navigator.clipboard.writeText(myLink).then(() => {
        showToast("تم نسخ الرابط بنجاح! 📋", "success");
    }).catch(err => {
        console.error('Copy failed', err);
        // Fallback
        const textArea = document.createElement("textarea");
        textArea.value = myLink;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("Copy");
        textArea.remove();
        showToast("تم نسخ الرابط! 📋", "success");
    });
}
