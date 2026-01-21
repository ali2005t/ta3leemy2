import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getEffectiveUserUid } from './impersonation-manager.js';
// UIManager assumed global
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Re-use logic from subscriptions.js or replicate minimally
let pricingConfig = null;
let currentUser = null;
let currentTeacherDoc = null;

// Support Number (for Payment Action)
const SUPPORT_PHONE = "201000000000";

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadPricingConfig();
            const uid = await getEffectiveUserUid(user);
            await loadInvoices(uid);
        } else {
            window.location.href = '../auth/login.html';
        }
    });
});

async function loadPricingConfig() {
    try {
        const docRef = doc(db, "config", "pricing_v2");
        const snap = await getDoc(docRef);
        if (snap.exists()) pricingConfig = snap.data();
    } catch (e) { console.error(e); }
}

async function loadInvoices(uid) {
    const tbody = document.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">جاري التحميل...</td></tr>';

    try {
        // Fetch Teacher & Sub Data
        const teacherDocRef = doc(db, "teachers", uid);
        const teacherSnap = await getDoc(teacherDocRef);
        if (!teacherSnap.exists()) return;
        currentTeacherDoc = teacherSnap.data();

        // Check Subscription
        const subDocRef = doc(db, "subscriptions", uid);
        const subSnap = await getDoc(subDocRef);
        let subData = subSnap.exists() ? subSnap.data() : {
            plan: currentTeacherDoc.planTier || 'trial',
            endDate: currentTeacherDoc.subscriptionEndsAt,
            startDate: currentTeacherDoc.subscriptionStartedAt,
            isActive: currentTeacherDoc.subscriptionStatus === 'active'
        };

        tbody.innerHTML = '';

        if (!subData.isActive || subData.plan === 'trial') {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:#94a3b8;">لا توجد فواتير نشطة (حساب تجريبي)</td></tr>';
            return;
        }

        // Generate Rows (Logic from Subscriptions)
        const rows = [];
        let startDate = subData.startDate ? (subData.startDate.toDate ? subData.startDate.toDate() : new Date(subData.startDate)) : new Date();
        let endDate = subData.endDate ? (subData.endDate.toDate ? subData.endDate.toDate() : new Date(subData.endDate)) : new Date();

        let amount = pricingConfig?.[subData.plan]?.priceMonthly || '---';
        if (amount === '---') {
            if (subData.plan === 'pro') amount = 500;
            else if (subData.plan === 'elite') amount = 1200;
            else amount = 200;
        }

        // Current Paid Invoice
        const monthName = startDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
        rows.push({
            id: `INV-${startDate.getMonth() + 1}${startDate.getFullYear()}`,
            status: 'paid',
            total: amount,
            date: startDate.toLocaleDateString('ar-EG'),
            discount: 0,
            add: 0
        });

        // Next Info
        const today = new Date();
        const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 5) {
            rows.push({
                id: `INV-NEXT`,
                status: daysLeft < 0 ? 'overdue' : 'upcoming',
                total: amount,
                date: endDate.toLocaleDateString('ar-EG'),
                discount: 0,
                add: 0
            });
        }

        // Render Row
        rows.forEach(r => {
            const tr = document.createElement('tr');
            let statusBadge = '';
            let actionBtn = `<button class="btn-icon" title="التفاصيل"><i class="fas fa-eye"></i></button>`;

            if (r.status === 'paid') {
                statusBadge = '<span class="status-badge" style="background:#e0e7ff; color:#4338ca;">محصلة</span>';
            } else if (r.status === 'overdue') {
                statusBadge = '<span class="status-badge" style="background:#fee2e2; color:#b91c1c;">مستحقة الدفع</span>';
                actionBtn = `<button onclick="payInvoice('${subData.plan}', '${amount}')" class="btn-sm btn-primary" style="font-size:0.8rem;">ادفع الآن</button>`;
            } else {
                statusBadge = '<span class="status-badge" style="background:#fef3c7; color:#b45309;">قريباً</span>';
            }

            tr.innerHTML = `
                <td>#${r.id}</td>
                <td>${statusBadge}</td>
                <td style="font-weight:bold;">${r.total} ج.م</td>
                <td>${r.total} ج.م</td>
                <td>0.00</td>
                <td>${r.date}</td>
                <td>${actionBtn}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error("Invoices Error", e);
        UIManager.showToast("خطأ في تحميل الفواتير", "error");
    }
}

// Payment Action
window.payInvoice = async (plan, price) => {
    const confirmed = await UIManager.showConfirm(
        "دفع الفاتورة المستحقة",
        `سيتم تحويلك للواتساب لإتمام عملية الدفع (${price} ج.م).\nهل تريد المتابعة؟`,
        "نعم، ادفع الآن",
        "إلغاء"
    );

    if (confirmed) {
        const teacherName = currentTeacherDoc?.name || "معلم";
        const message = `مرحباً، أريد دفع الفاتورة المستحقة لباقة *${plan}* بقيمة ${price} ج.م.\nاسم المعلم: ${teacherName}`;
        window.open(`https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent(message)}`, '_blank');
    }
};
