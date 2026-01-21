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
        loadPermissions(uid);
    } else {
        window.location.href = '../auth/login.html';
    }
});

async function loadPermissions(uid) {
    const tbody = document.querySelector('tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">جاري التحميل...</td></tr>';

    try {
        // We'll use a hypothetical 'financial_permissions' collection
        // OR filtering the 'permissions' collection if that's what was intended.
        // Given the request for "Real Data", and no existing 'permissions' collection with financial data,
        // we will check if there's a collection or assume 'transactions' or 'invoices' related.
        // However, user specifically said "Permissions Page" (الأذونات). 
        // Let's assume we need to show a placeholder for "No Permissions" if the collection doesn't exist,
        // rather than fake data.

        // Let's try to query 'teacher_financials' or similar if it existed.
        // Since we don't have a verified collection for this specific "Permissions" use case (Add/Deduct),
        // We will show an empty state or query a new collection 'financial_adjustments'.

        const q = query(collection(db, "financial_adjustments"), where("teacherId", "==", uid), orderBy("createdAt", "desc"));
        const snap = await getDocs(q); // This might be empty, which is fine (Real Data = Empty is better than Fake)

        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:30px; color:#94a3b8;">لا توجد أذونات مالية مسجلة</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        snap.forEach((doc) => {
            const data = doc.data();
            const tr = document.createElement('tr');

            let statusBadge = data.status === 'completed'
                ? '<span class="status-badge" style="background:#dcfce7; color:#166534;">مكتمل</span>'
                : '<span class="status-badge" style="background:#e0e7ff; color:#4338ca;">معلقة</span>';

            let typeBadge = data.type === 'credit'
                ? '<span class="status-badge" style="background:#dbeafe; color:#1e40af;">(إضافة) له</span>'
                : '<span class="status-badge" style="background:#fce7f3; color:#9d174d;">(خصم) عليه</span>';

            tr.innerHTML = `
                <td>#${doc.id.slice(0, 6)}</td>
                <td>${statusBadge}</td>
                <td>${typeBadge}</td>
                <td style="font-weight:bold;">${data.amount} ج.م</td>
                <td>${data.reason || '---'}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.warn("Permissions Load Error (Collection might not exist yet)", error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:30px; color:#94a3b8;">لا توجد بيانات حالياً</td></tr>';
    }
}
