import { db, auth } from './firebase-config.js';
import {
    collection,
    query,
    where,
    getDocs,
    orderBy,
    getDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getEffectiveUserUid } from './impersonation-manager.js';
import { initHeader } from './header-manager.js';

onAuthStateChanged(auth, async (user) => {
    if (user) {
        initHeader(user);
        const uid = await getEffectiveUserUid(user);
        loadFinancials(uid);
    } else {
        window.location.href = '../auth/login.html';
    }
});

async function loadFinancials(uid) {
    try {
        const tbody = document.getElementById('transactions-body');

        // Fetch USER'S sold codes (teacherId == uid AND status == 'used')
        // Using 'isUsed' might be better if we migrated, but 'status' == 'used' is also set.
        const q = query(
            collection(db, "access_codes"),
            where("teacherId", "==", uid),
            where("status", "==", "used")
        );

        const snap = await getDocs(q);
        const data = [];

        snap.forEach(d => {
            const item = d.data();
            data.push({
                id: d.id,
                ...item
            });
        });

        // Sort by Used Date desc (client side since we didn't index everything perfectly)
        data.sort((a, b) => (b.usedAt?.seconds || 0) - (a.usedAt?.seconds || 0));

        // Calculate Totals
        const totalRev = data.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
        document.getElementById('total-revenue').innerText = totalRev.toLocaleString('en-US') + " ج.م";
        document.getElementById('codes-sold').innerText = data.length;

        // Render Table
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:30px;">لا توجد معاملات مالية حتى الأن</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        data.forEach((tx, idx) => {
            const tr = document.createElement('tr');
            const date = tx.usedAt ? new Date(tx.usedAt.seconds * 1000).toLocaleDateString('ar-EG') : '-';

            // Try to find student name if stored? Usually we store ID.
            // For performance, we'll just show ID or "Student"

            tr.innerHTML = `
                <td>${idx + 1}</td>
                <td><span class="badge" style="background:#e0e7ff; color:#4338ca;">بيع كود</span></td>
                <td style="font-weight:bold; color:#10b981;">+${tx.price || 0} ج.م</td>
                <td style="font-size:0.85rem; color:#64748b;">${tx.usedBy ? 'ID: ' + tx.usedBy.slice(0, 5) : '-'}</td>
                <td>${date}</td>
                <td><span class="status-badge success">مكتمل</span></td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error("Financials Error", e);
        document.getElementById('transactions-body').innerHTML = '<tr><td colspan="6" class="text-center" style="color:red;">خطأ في تحميل البيانات</td></tr>';
    }
}
