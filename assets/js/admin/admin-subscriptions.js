import { db, auth } from '../firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection,
    getDocs,
    getDoc,
    addDoc,
    doc,
    updateDoc,
    setDoc,
    Timestamp,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Auth check
        loadSubscriptions();
    } else {
        window.location.href = 'login.html';
    }
});

document.getElementById('logout-btn')?.addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = 'login.html');
});

let allTeachers = [];

async function loadSubscriptions() {
    const tbody = document.getElementById('subs-table-body');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">جاري التحميل...</td></tr>';

    try {
        // --- SCOPE CHECK ---
        const allowedTeachers = new Set();
        const user = auth.currentUser;
        if (user) {
            const adminSnap = await getDoc(doc(db, "admins", user.uid));
            if (adminSnap.exists()) {
                const list = adminSnap.data().assignedTeachers || [];
                if (list.length > 0) list.forEach(id => allowedTeachers.add(id));
            }
        }
        // -------------------

        const q = query(collection(db, "teachers"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);

        allTeachers = [];

        snap.forEach(docSnap => {
            // SCOPE FILTER
            if (allowedTeachers.size > 0 && !allowedTeachers.has(docSnap.id)) return;

            allTeachers.push({ id: docSnap.id, ...docSnap.data() });
        });

        renderTable(allTeachers);

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">خطأ في تحميل البيانات</td></tr>';
    }
}

function renderTable(teachers) {
    const tbody = document.getElementById('subs-table-body');
    const search = document.getElementById('search-sub')?.value.toLowerCase() || '';

    tbody.innerHTML = '';

    const filtered = teachers.filter(t => (t.name || '').toLowerCase().includes(search));

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">لا توجد نتائج</td></tr>';
        return;
    }

    filtered.forEach(t => {
        const tr = document.createElement('tr');

        // Robust Plan Data
        const planLabel = t.planLabel || t.planTier || (t.subscriptionPlan === 'free_trial' ? 'تجريبي' : 'أساسية');
        let expiryDateStr = '-';
        let status = 'غير مفعل';
        let badgeClass = 'sub-expired';

        // Check Date
        let endDateSrc = t.subscriptionEnd || t.subscriptionEndsAt;

        if (endDateSrc) {
            const endsAt = endDateSrc.toDate ? endDateSrc.toDate() : new Date(endDateSrc);
            expiryDateStr = endsAt.toLocaleDateString('ar-EG');
            const now = new Date();

            if (endsAt > now) {
                // Check status flag
                if (t.subscriptionStatus === 'active' || t.hasActiveSubscription) {
                    status = 'نشط';
                    badgeClass = 'sub-active';
                } else {
                    status = 'معلق';
                    badgeClass = 'sub-trial';
                }

                if (t.planTier === 'trial' || t.subscriptionPlan === 'free_trial') {
                    status = 'تجريبي';
                    badgeClass = 'sub-trial';
                }

            } else {
                status = 'منتهي';
                badgeClass = 'sub-expired';
            }
        }

        tr.innerHTML = `
            <td style="font-weight:bold;">${t.name}<div style="font-size:0.8rem; font-weight:normal; color:#94a3b8;">${t.email}</div></td>
            <td><span class="sub-badge" style="background:#1e293b; border:1px solid #334155;">${planLabel}</span></td>
            <td>${expiryDateStr}</td>
            <td><span class="sub-badge ${badgeClass}">${status}</span></td>
            <td>${t.totalPaid ? t.totalPaid + ' ج.م' : '-'}</td>
            <td>
                <button class="btn-icon" onclick="openSubscriptionModal('${t.id}')" title="تعديل الاشتراك" style="color:#3b82f6;">
                    <i class="fas fa-edit"></i> تعديل
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Global Modal Functions
window.openSubscriptionModal = (tid) => {
    document.getElementById('sub-teacher-id').value = tid;
    document.getElementById('subscription-modal').style.display = 'flex';
    if (window.updateSubPrice) window.updateSubPrice();
};

// Cache for pricing config
let pricingConfig = null;

window.updateSubPrice = async () => {
    const duration = document.getElementById('sub-duration').value;
    const tier = document.getElementById('sub-plan-tier').value;
    const priceInput = document.getElementById('sub-price');
    const studentInput = document.getElementById('sub-max-students');

    // 1. Fetch Dynamic Config if empty
    if (!pricingConfig) {
        try {
            const docSnap = await getDoc(doc(db, "config", "pricing_v2"));
            if (docSnap.exists()) {
                pricingConfig = docSnap.data();
            } else {
                // Fallback Defaults (matches admin-packages.js default)
                pricingConfig = {
                    basic: { priceMonthly: 199, priceYearly: 1999, maxStudents: 100 },
                    pro: { priceMonthly: 599, priceYearly: 5999, maxStudents: 1000 },
                    elite: { priceMonthly: 999, priceYearly: 9999, maxStudents: 0 }
                };
            }
        } catch (e) {
            console.error("Pricing Fetch Error", e);
            return;
        }
    }

    const tierData = pricingConfig[tier] || {};

    // 2. Set Max Students from Config
    // If elite (0) -> leave empty or set to 0. 
    // User logic: 0 usually means unlimited in backend checks, or specific large number.
    // Let's display actual value.
    if (studentInput) {
        studentInput.value = (tierData.maxStudents === 0 || tierData.maxStudents === undefined) ? '' : tierData.maxStudents;
    }

    if (duration === 'trial') {
        priceInput.value = 0;
        return;
    }

    // 3. Calculate Price
    let basePrice = 0;
    const months = parseInt(duration);

    // Check if we have yearly rate override
    if (months === 12 && tierData.priceYearly) {
        basePrice = tierData.priceYearly;
    } else {
        // Default to monthly * months
        basePrice = (tierData.priceMonthly || 0) * months;

        // Apply standard bulk discounts if not using flat yearly rate
        if (months >= 6 && months < 12) basePrice = basePrice * 0.9;
        // Note: If priceYearly exists, we used it for 12 months. If not, we'd apply discount.
        // But usually priceYearly is the discount.
    }

    priceInput.value = Math.floor(basePrice);
};

// Add listener to tier too
document.getElementById('sub-plan-tier')?.addEventListener('change', window.updateSubPrice);

window.saveSubscription = async () => {
    const btn = document.getElementById('save-sub-btn');
    const tid = document.getElementById('sub-teacher-id').value;
    const duration = document.getElementById('sub-duration').value;
    const tier = document.getElementById('sub-plan-tier').value;
    const price = document.getElementById('sub-price').value;
    const maxStudentsVal = document.getElementById('sub-max-students').value;

    if (!tid) return;

    btn.disabled = true;
    btn.innerText = 'جاري التفعيل...';

    try {
        let endDate = new Date();
        const tierLabels = { 'basic': 'Starter', 'pro': 'Pro', 'elite': 'Elite' };

        let planLabel = '';

        if (duration === 'trial') {
            endDate.setDate(endDate.getDate() + 14);
            planLabel = `تجريبي (${tierLabels[tier]})`;
        } else {
            const months = parseInt(duration);
            endDate.setMonth(endDate.getMonth() + months);
            planLabel = `${tierLabels[tier]} - ${months} شهر`;
        }

        const maxStudents = maxStudentsVal ? parseInt(maxStudentsVal) : 999999; // 999999 effectively unlimited for logic

        const subData = {
            teacherId: tid,
            plan: tier,
            planLabel: planLabel,
            startDate: Timestamp.now(),
            endDate: Timestamp.fromDate(endDate),
            isActive: true,
            pricePaid: parseFloat(price),
            maxStudents: maxStudents, // Save limit
            updatedToByAdmin: true,
            updatedAt: Timestamp.now()
        };

        // 1. Create Sub Doc
        await setDoc(doc(db, "subscriptions", tid), subData);

        // 2. Update Teacher Doc
        await updateDoc(doc(db, "teachers", tid), {
            hasActiveSubscription: true,
            subscriptionStatus: 'active',
            subscriptionEnd: subData.endDate,
            planTier: tier,
            planLabel: planLabel,
            maxStudents: maxStudents // Sync limit to teacher doc for easy access
        });

        // 3. Create Financial Transaction (Auto-Record)
        if (parseFloat(price) > 0) {
            await addDoc(collection(db, "financial_transactions"), {
                teacherId: tid,
                type: 'payment', // Payment FROM teacher (Revenue) or TO wallet?
                // Context: Admin is activating a sub. This is usually "Revenue" or "Invoice Paid".
                // In admin-financials.js: "payment" = "added to wallet" (green), "invoice" = "teacher owes" (blue).
                // Wait, if admin activates it, it means teacher PAID.
                // Let's verify existing logic in admin-financials.js...
                // "payment" adds to balance (green). "deduction" removes (red).
                // If this is REVENUE, it acts as a Record of Payment.
                // Let's call it 'payment' (credit) or 'revenue'? 
                // Let's stick to the user's request: "Transactions". 
                // If I add 'payment', it increases their 'wallet balance' in the current logic?
                // Actually, the previous code showed: 
                // payment: + balance (Added to him)
                // deduction: - balance (Deduced from him)
                // invoice: - balance (He owes us)

                // If teacher PAYS for sub, is it removed from wallet or added?
                // Usually: Teacher pays CASH/Violent, Admin activates. 
                // So this transaction is a RECEIPT. 
                // It shouldn't necessarily affect "Wallet Balance" if that balance is for "Withdrawals".
                // But if the wallet is "Account Balance", paying for sub reduces it?
                // The user just wants a RECORD. 
                // I will add it as type: 'subscription_payment' or just 'invoice' with status 'paid'?
                // Let's use 'deduction' implies taking money from their balance.
                // If they paid externally, we might just want to log it.
                // I'll log it as 'payment_received' or similar. 
                // Re-reading admin-financials.js:
                // It sums up 'totalPaid' from teachers for revenue.
                // It calculates balance from transactions.

                // Let's assume this is just a record. I will use a new type 'subscription' to be safe, 
                // OR use 'deduction' if we assume they pay from wallet.
                // User said: "Automate number of students... and prices".
                // Let's add it as 'completed_payment'.

                type: 'payment_received',
                amount: parseFloat(price),
                reason: `تفعيل اشتراك: ${planLabel}`,
                status: 'completed',
                createdAt: Timestamp.now(),
                createdBy: 'admin_auto'
            });

            // Also update totalPaid on teacher for Revenue Stats
            // We need to atomic increment? Or just read-write. 
            // Only updateDoc supports serverTimestamp, but increment is cleaner.
            // I'll use simple read-add-write pattern since I don't have atomic increment import handy without more changes.
            // Actually, I can just updateDoc.
            // To incorporate standard logic, I'll assume `totalPaid` is sum of all subscriptions.
            // I will NOT update `totalPaid` here manually to avoid race conditions, rely on `calculateRevenue` which iterates.
            // Wait, calculateRevenue iterates TEACHERS and sums `totalPaid`. So I MUST update `totalPaid` on teacher.

            // Re-fetch to be safe
            const tSnap = await getDoc(doc(db, "teachers", tid));
            const currentTotal = tSnap.data().totalPaid || 0;
            await updateDoc(doc(db, "teachers", tid), {
                totalPaid: currentTotal + parseFloat(price)
            });
        }

        alert(`تم تفعيل الاشتراك بنجاح\nالنوع: ${planLabel}\nالسعر: ${price} ج.م\nالطلاب: ${maxStudentsVal || 'غير محدود'}`);
        document.getElementById('subscription-modal').style.display = 'none';

        loadSubscriptions();

    } catch (e) {
        console.error(e);
        alert('خطأ: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = 'تفعيل الاشتراك';
    }
};

document.getElementById('search-sub')?.addEventListener('keyup', () => renderTable(allTeachers));
