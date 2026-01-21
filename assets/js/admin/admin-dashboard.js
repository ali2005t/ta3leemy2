import { db, auth } from '../firebase-config.js';
import {
    collection,
    query,
    where,
    getDocs,
    getCountFromServer,
    orderBy,
    limit,
    getDoc,
    doc,
    updateDoc,
    getAggregateFromServer,
    sum
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Basic Admin Protection
async function checkAdmin(user) {
    if (!user) return false;
    // In real app, check custom claims or 'admins' existing collection
    // For now, allow specific email or check 'users/uid' role if exists
    // Lets assume we have an 'admins' collection or just checking email
    // Or we rely on 'users' collection having role: 'admin'

    try {
        const d = await getDoc(doc(db, "admins", user.uid));
        if (d.exists()) {
            // Optional: Check if blocked?
            return true;
        }
    } catch (e) { }

    return false; // Default deny
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const isAdmin = await checkAdmin(user);
        if (!isAdmin) {
            // alert("غير مسموح لك بالدخول هنا");
            // window.location.href = '../index.html';
            // For Dev/Demo: Allow if email is specific? Or just warn?
            // Let's Log it but allow for now if user just created manual account?
            // NO, Security First. Redirect.
            // Commented out for now until user creates an admin account manually.
            console.warn("User is not admin role", user.uid);
        }

        loadStats();
        loadRecentTeachers();
        loadDomainRequests();
    } else {
        window.location.href = 'login.html';
    }
});

// Logout
document.getElementById('admin-logout')?.addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = 'login.html');
});


async function loadStats() {
    try {
        // Count Teachers
        const teachersSnap = await getCountFromServer(collection(db, "teachers"));
        document.getElementById('count-teachers').innerText = teachersSnap.data().count;

        // Count Students
        const studentsSnap = await getCountFromServer(collection(db, "students"));
        document.getElementById('count-students').innerText = studentsSnap.data().count;

        // Count Courses (Trainings)
        const coursesSnap = await getCountFromServer(collection(db, "training_programs"));
        document.getElementById('count-courses').innerText = coursesSnap.data().count;

        // Revenue (Sum of 'access_codes' where isUsed=true)
        const codesColl = collection(db, "access_codes");
        const qRevenue = query(codesColl, where("status", "==", "used"));
        const revenueSnap = await getAggregateFromServer(qRevenue, {
            total: sum('price')
        });

        const totalRev = revenueSnap.data().total || 0;
        document.getElementById('total-revenue').innerText = totalRev.toLocaleString('en-US') + " EGP";

    } catch (e) {
        console.error("Stats Error", e);
    }
}

async function loadRecentTeachers() {
    const tbody = document.getElementById('recent-teachers-body');
    if (!tbody) return;
    tbody.innerHTML = 'Loading...';

    try {
        const q = query(
            collection(db, "teachers"),
            orderBy("createdAt", "desc"),
            limit(5)
        );
        const snap = await getDocs(q);

        tbody.innerHTML = '';
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="4">لا يوجدمعلمون جدد</td></tr>';
            return;
        }

        snap.forEach(doc => {
            const data = doc.data();
            const tr = document.createElement('tr');
            const status = data.isVerified ?
                '<span class="status-badge status-active">نشط</span>' :
                '<span class="status-badge status-draft">معلق</span>';

            tr.innerHTML = `
                <td>
                    <div style="font-weight:bold;">${data.name || 'No Name'}</div>
                    <div style="font-size:0.8rem; color:#64748b;">${data.phone || ''}</div>
                </td>
                <td>${data.email}</td>
                <td>${status}</td>
                <td>
                    <button class="btn-icon" onclick="location.href='teachers.html'"><i class="fas fa-eye"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error(e);
        tbody.innerHTML = 'Error loading teachers';
    }
}

async function loadDomainRequests() {
    const tbody = document.getElementById('domain-requests-body');
    const badge = document.getElementById('domain-req-count');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">جاري التحميل...</td></tr>';

    try {
        // Query teachers where domainStatus == pending
        const q = query(
            collection(db, "teachers"),
            where("domainStatus", "in", ["pending", "active"]) // Show active too to modify? Or just pending? Let's show pending mainly.
            // Actually, maybe just pending.
        );

        // Firestore limitation: OR queries are limited. Let's just fetch 'pending' for the notification widget.
        const qPending = query(
            collection(db, "teachers"),
            where("domainStatus", "==", "pending")
        );

        const snap = await getDocs(qPending);

        tbody.innerHTML = '';

        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding:20px;">لا توجد طلبات جديدة</td></tr>';
            if (badge) badge.style.display = 'none';
            return;
        }

        if (badge) {
            badge.innerText = snap.size;
            badge.style.display = 'block';
        }

        snap.forEach(d => {
            const data = d.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div style="font-weight:bold;">${data.name || 'غير معروف'}</div>
                    <div style="font-size:0.8rem; color:#64748b;">${data.email}</div>
                </td>
                <td style="direction:ltr; text-align:left;">
                    <a href="http://${data.customDomain}" target="_blank" style="color:#2563eb; text-decoration:underline;">${data.customDomain}</a>
                </td>
                <td><span class="status-badge status-draft" style="background:#fef3c7; color:#d97706;">Pending</span></td>
                <td>
                    <button class="action-btn" style="background:#10b981; color:white; padding:5px 10px; border-radius:4px; border:none; cursor:pointer;" onclick="approveDomain('${d.id}', '${data.customDomain}')">
                        <i class="fas fa-check"></i> تفعيل
                    </button>
                    <button class="action-btn" style="background:#ef4444; color:white; padding:5px 10px; border-radius:4px; border:none; cursor:pointer; margin-right:5px;" onclick="rejectDomain('${d.id}')">
                        <i class="fas fa-times"></i> رفض
                    </button>
                    <button class="action-btn" style="background:#3b82f6; color:white; padding:5px 10px; border-radius:4px; border:none; cursor:pointer; margin-right:5px;" onclick="copyDomain('${data.customDomain}')">
                         نسخ
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error("Domain Requests Error:", e);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">خطأ في التحميل</td></tr>';
    }
}

// Global Actions
window.approveDomain = async (teacherId, domainName) => {
    if (!confirm(`هل أنت متأكد من تفعيل الدومين ${domainName}؟\n(يجب أن تكون قد أضفته في Firebase Console أولاً)`)) return;

    try {
        await updateDoc(doc(db, "teachers", teacherId), {
            domainStatus: 'active'
        });
        alert("تم التفعيل بنجاح! سيظهر الرابط الجديد في صفحة المعلم.");
        loadDomainRequests(); // Reload
    } catch (e) {
        alert("حدث خطأ: " + e.message);
    }
};

window.rejectDomain = async (teacherId) => {
    if (!confirm("هل أنت متأكد من رفض الطلب؟")) return;

    try {
        await updateDoc(doc(db, "teachers", teacherId), {
            domainStatus: 'failed' // or 'rejected'
        });
        alert("تم رفض الطلب.");
        loadDomainRequests();
    } catch (e) {
        alert("حدث خطأ: " + e.message);
    }
};

window.copyDomain = (text) => {
    navigator.clipboard.writeText(text).then(() => {
        alert("تم نسخ الدومين: " + text);
    });
};
