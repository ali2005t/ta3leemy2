import { db, auth } from '../firebase-config.js';
import { collection, query, where, getDocs, orderBy, Timestamp, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Tab Switching Logic
function switchTab(tabName) {
    const walletTab = document.getElementById('wallet-tab');
    const analysisTab = document.getElementById('analysis-tab');
    const btnWallet = document.getElementById('tab-wallet');
    const btnAnalysis = document.getElementById('tab-analysis');

    if (tabName === 'wallet') {
        walletTab.style.display = 'block';
        analysisTab.style.display = 'none';
        btnWallet.style.borderBottomColor = '#6366f1';
        btnWallet.style.color = 'white';
        btnAnalysis.style.borderBottomColor = 'transparent';
        btnAnalysis.style.color = '#94a3b8';
    } else {
        walletTab.style.display = 'none';
        analysisTab.style.display = 'block';
        btnAnalysis.style.borderBottomColor = '#6366f1';
        btnAnalysis.style.color = 'white';
        btnWallet.style.borderBottomColor = 'transparent';
        btnWallet.style.color = '#94a3b8';
    }
}

// Attach Event Listeners
document.getElementById('tab-wallet')?.addEventListener('click', () => switchTab('wallet'));
document.getElementById('tab-analysis')?.addEventListener('click', () => switchTab('analysis'));

document.getElementById('run-report-btn')?.addEventListener('click', generateTeacherReport);

async function generateTeacherReport() {
    const tbody = document.getElementById('teacher-report-body');
    const dateInput = document.getElementById('report-date').value;

    if (!dateInput) {
        alert("الرجاء اختيار تاريخ");
        return;
    }

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">جاري الحساب... قد يستغرق لحظات</td></tr>';

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

        // 1. Get Teachers (Filtered)
        const teachersSnap = await getDocs(collection(db, "teachers"));
        const teachers = [];
        teachersSnap.forEach(t => {
            if (allowedTeachers.size > 0 && !allowedTeachers.has(t.id)) return;
            teachers.push({ id: t.id, ...t.data() });
        });

        // 2. Define Time Range for the selected Date
        const startDate = new Date(dateInput);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateInput);
        endDate.setHours(23, 59, 59, 999);

        const startTs = Timestamp.fromDate(startDate);
        const endTs = Timestamp.fromDate(endDate);

        // 3. Query Codes generated in this range (Type=invoice usually means charged to student, but here we check 'access_codes' generally or 'invoices')
        // The user asked "How many codes generated".
        // We query 'access_codes' collection.
        // Needs Index: createdBy + createdAt

        // Optimization: Fetch ALL codes for this day, then group by Creator (Teacher) in JS to avoid N queries.
        // Assuming 'createdBy' field exists on codes.

        const codesQuery = query(
            collection(db, "access_codes"),
            where("createdAt", ">=", startTs),
            where("createdAt", "<=", endTs)
        );

        const codesSnap = await getDocs(codesQuery);
        const codesByTeacher = {};

        codesSnap.forEach(doc => {
            const d = doc.data();
            const teacherId = d.createdBy; // Assuming teacher ID is here

            // Optimization: Skip codes not in our allowed list (optional, but good for performance if filtering)
            if (allowedTeachers.size > 0 && !allowedTeachers.has(teacherId)) return;

            if (!codesByTeacher[teacherId]) {
                codesByTeacher[teacherId] = { count: 0, value: 0 };
            }
            codesByTeacher[teacherId].count++;
            codesByTeacher[teacherId].value += Number(d.value || 0);
        });

        // 4. Render
        tbody.innerHTML = '';
        let totalPlatformProfit = 0;
        let overdueCount = 0;

        teachers.forEach(t => {
            const stats = codesByTeacher[t.id] || { count: 0, value: 0 };

            // Subscription Status Logic
            let subStatus = 'unknown'; // active, overdue, trial, free
            let dueDate = 'غير محدد';
            let planName = t.planLabel || t.planTier || 'مجاني';

            if (t.subscriptionEndsAt) {
                const endDate = t.subscriptionEndsAt.toDate();
                dueDate = endDate.toLocaleDateString('ar-EG');

                const today = new Date();
                // Reset time for fair comparison
                today.setHours(0, 0, 0, 0);

                const diffTime = endDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays < 0) {
                    subStatus = 'overdue'; // Expired
                    overdueCount++;
                } else if (diffDays <= 5) {
                    subStatus = 'due_soon'; // Warning
                } else {
                    subStatus = 'paid';
                }
            } else {
                if (t.planTier === 'trial') {
                    subStatus = 'trial';
                    dueDate = 'فترة تجريبية';
                } else {
                    subStatus = 'free';
                }
            }

            // Only show if we have data OR if they are a paid teacher (subscription exists)
            // If just a free teacher with no sales, maybe skip? 
            // Better to show all for "Financial Report" context.

            const tr = document.createElement('tr');

            let statusBadge = '';
            let actionBtn = '-';

            if (subStatus == 'paid') {
                statusBadge = '<span class="badge badge-success" style="background:#10b981; color:white;">مدفوع (نشط)</span>';
            } else if (subStatus == 'overdue') {
                statusBadge = '<span class="badge badge-danger" style="background:#ef4444; color:white;">متأخر (منتهي)</span>';
                actionBtn = `<button class="btn-sm btn-outline-danger" style="font-size:0.7rem; padding:2px 8px;" onclick="alert('تم إرسال إشعار تجديد للمعلم: ${t.name}')"><i class="fas fa-bell"></i> تنبيه</button>`;
            } else if (subStatus == 'due_soon') {
                statusBadge = '<span class="badge badge-warning" style="background:#f59e0b; color:black;">يستحق قريباً</span>';
            } else if (subStatus == 'trial') {
                statusBadge = '<span class="badge badge-info" style="background:#3b82f6; color:white;">تجريبي</span>';
            } else {
                statusBadge = '<span class="badge badge-secondary" style="background:#64748b; color:white;">مجاني</span>';
            }

            tr.innerHTML = `
                <td>
                    <div style="font-weight:bold;">${t.name}</div>
                    <div style="font-size:0.8rem; color:#64748b;">${t.email}</div>
                </td>
                <td>
                    <div style="font-weight:600; color:#e2e8f0;">${planName}</div>
                    <div style="font-size:0.75rem; color:#94a3b8; margin-top:2px;">ينتهي: ${dueDate}</div>
                </td>
                <td style="text-align:center;">
                    ${statusBadge}
                </td>
                <td style="text-align:center;">${stats.value} ج.م</td>
                <td style="text-align:center;">
                     ${actionBtn}
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Admin Alert for Overdues
        if (overdueCount > 0) {
            // Prepend a warning row
            const alertRow = document.createElement('tr');
            alertRow.innerHTML = `
                <td colspan="5" style="background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; border-radius:8px; padding:10px; text-align:center; color:#fca5a5;">
                    <i class="fas fa-exclamation-triangle"></i> تنبيه: يوجد <strong>${overdueCount}</strong> معلمين لديهم اشتراكات منتهية مستحقة الدفع.
                </td>
            `;
            tbody.prepend(alertRow);
        }

        if (tbody.children.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">لا توجد بيانات لهذا اليوم</td></tr>';
        }

    } catch (error) {
        console.error("Report Error:", error);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">خطأ: ${error.message} <br> تأكد من وجود Index (createdAt)</td></tr>`;
    }
}
