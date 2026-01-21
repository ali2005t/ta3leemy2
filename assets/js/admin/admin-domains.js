import { db, auth } from '../firebase-config.js';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    updateDoc,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

onAuthStateChanged(auth, async (user) => {
    if (user) {
        loadDomains();
        window.loadDomains = loadDomains; // Expose for refresh button
    } else {
        window.location.href = 'login.html';
    }
});

async function loadDomains() {
    const tbody = document.getElementById('domains-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">جاري التحميل...</td></tr>';

    try {
        // Query Teachers with Custom Domain (Order By Updates if possible, or create valid index)
        // Note: 'customDomain' != null query requires an index usually or just filter manually if dataset is small.
        // Better to query where 'customDomain' > '' to filter existing ones.

        const q = query(
            collection(db, "teachers"),
            where("customDomain", "!=", "")
            // orderBy("customDomain") // Required by Firestore for inequality filter
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#94a3b8;">لا توجد طلبات دومين حالياً</td></tr>';
            return;
        }

        tbody.innerHTML = '';

        let requests = [];

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.customDomain) {
                requests.push({
                    id: docSnap.id,
                    ...data
                });
            }
        });

        // Manual Sort by Status (Pending First) then Date
        requests.sort((a, b) => {
            if (a.domainStatus === 'pending' && b.domainStatus !== 'pending') return -1;
            if (a.domainStatus !== 'pending' && b.domainStatus === 'pending') return 1;
            return 0;
        });

        requests.forEach(req => {
            const tr = document.createElement('tr');

            // Status Badge
            let statusBadge = '<span class="status-badge" style="background:#f1f5f9; color:#64748b;">غير معروف</span>';
            if (req.domainStatus === 'active') statusBadge = '<span class="status-badge status-active">نشط (Active)</span>';
            else if (req.domainStatus === 'pending') statusBadge = '<span class="status-badge status-draft" style="background:#fff7ed; color:#ea580c;">تحت المراجعة</span>';
            else if (req.domainStatus === 'failed' || req.domainStatus === 'rejected') statusBadge = '<span class="status-badge" style="background:#fef2f2; color:#ef4444;">مرفوض/فشل</span>';

            // Date
            let dateStr = '-';
            if (req.domainUpdatedAt) {
                dateStr = req.domainUpdatedAt.toDate().toLocaleDateString('ar-EG');
            } else if (req.updatedAt) {
                dateStr = req.updatedAt.toDate().toLocaleDateString('ar-EG');
            }

            // Actions
            // Contact
            const phone = req.phone ? req.phone.replace(/\D/g, '') : '';
            const waLink = phone ? `https://wa.me/${phone}` : '#';

            let actions = `
            <div style="display:flex; gap:5px;">
                <a href="${waLink}" target="_blank" class="btn-icon" title="تواصل واتساب" style="background:#dcfce7; color:#166534; text-decoration:none; display:flex; align-items:center; justify-content:center;">
                    <i class="fab fa-whatsapp"></i>
                </a>
                <button onclick="copyDomain('${req.customDomain}')" class="btn-icon" title="نسخ الدومين" style="background:#e2e8f0; color:#475569;">
                    <i class="fas fa-copy"></i>
                </button>
            `;

            if (req.domainStatus === 'pending') {
                actions += `
                    <button onclick="approveDomain('${req.id}', '${req.customDomain}')" class="btn-icon" title="تفعيل (Active)" style="background:#dcfce7; color:#166534;">
                        <i class="fas fa-check"></i>
                    </button>
                    <button onclick="rejectDomain('${req.id}')" class="btn-icon" title="رفض (Reject)" style="background:#fee2e2; color:#991b1b;">
                        <i class="fas fa-times"></i>
                    </button>
                `;
            } else if (req.domainStatus === 'active') {
                actions += `
                    <button onclick="rejectDomain('${req.id}')" class="btn-icon" title="إيقاف (Suspend)" style="background:#fee2e2; color:#991b1b;">
                        <i class="fas fa-ban"></i>
                    </button>
                `;
            } else {
                actions += `
                    <button onclick="approveDomain('${req.id}', '${req.customDomain}')" class="btn-icon" title="إعادة تفعيل" style="background:#dcfce7; color:#166534;">
                        <i class="fas fa-redo"></i>
                    </button>
                `;
            }

            actions += `</div>`;

            tr.innerHTML = `
                <td>
                    <div style="font-weight:bold;">${req.name}</div>
                    <div style="font-size:0.8rem; color:#64748b;">${req.email}</div>
                    <div style="font-size:0.75rem; color:#94a3b8;">${req.phone || '-'}</div>
                </td>
                <td style="font-family:monospace; color:#3b82f6; direction:ltr;">${req.customDomain}</td>
                <td>${dateStr}</td>
                <td>${statusBadge}</td>
                <td>${actions}</td>
            `;

            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error("Error loading domains:", e);
        if (e.code === 'failed-precondition') {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#f59e0b;">يجب إنشاء Index في فايربيس (راجع الكونسول)</td></tr>';
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">خطأ في التحميل: ' + e.message + '</td></tr>';
        }
    }
}

// Global Actions
window.copyDomain = (text) => {
    navigator.clipboard.writeText(text);
    UIManager.showToast('تم نسخ الدومين');
};

window.approveDomain = async (tid, domain) => {
    const confirm = await UIManager.showConfirm(
        'تفعيل الدومين',
        `هل قمت بإضافة الدومين ${domain} في Firebase Console والتأكد من سجلات DNS؟`,
        'نعم، قمت بذلك'
    );

    if (confirm) {
        try {
            await updateDoc(doc(db, "teachers", tid), {
                domainStatus: 'active',
                domainUpdatedAt: new Date()
            });
            UIManager.showToast('تم تفعيل الدومين بنجاح', 'success');
            loadDomains();
        } catch (e) {
            UIManager.showToast('فشل التفعيل: ' + e.message, 'error');
        }
    }
};

window.rejectDomain = async (tid) => {
    // Improve Prompt to Ask for Reason
    const { value: reason } = await Swal.fire({
        title: 'رفض طلب الدومين',
        input: 'text',
        inputLabel: 'سبب الرفض (سيظهر للمعلم)',
        inputPlaceholder: 'مثال: يرجى إضافة A/TXT Record بشكل صحيح',
        showCancelButton: true,
        confirmButtonText: 'رفض الطلب',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#ef4444',
        inputValidator: (value) => {
            if (!value) {
                return 'يرجى كتابة سبب الرفض!';
            }
        }
    });

    if (reason) {
        try {
            await updateDoc(doc(db, "teachers", tid), {
                domainStatus: 'failed',
                domainRejectionReason: reason,
                domainUpdatedAt: new Date()
            });
            UIManager.showToast('تم رفض الدومين وإرسال السبب للمعلم', 'success');
            loadDomains();
        } catch (e) {
            UIManager.showToast('فشل العملية: ' + e.message, 'error');
        }
    }
};
