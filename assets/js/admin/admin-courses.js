import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, collection, getDocs, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initAdminUI } from './admin-ui.js';

let allCourses = [];
let assignedTeachers = new Set(); // For Scoping

document.addEventListener('DOMContentLoaded', () => {
    initAdminUI('قائمة الكورسات');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const adminDoc = await getDoc(doc(db, "admins", user.uid));
            if (!adminDoc.exists()) {
                window.location.href = 'login.html';
                return;
            }

            // Load Assigned Teachers (Scope)
            const adminData = adminDoc.data();
            if (adminData.assignedTeachers && Array.isArray(adminData.assignedTeachers) && adminData.assignedTeachers.length > 0) {
                assignedTeachers = new Set(adminData.assignedTeachers);
                console.log("Restricted to teachers:", assignedTeachers);
            }

            loadCourses();
        } else {
            window.location.href = 'login.html';
        }
    });

    document.getElementById('search-input').addEventListener('keyup', renderCourses);
    document.getElementById('status-filter').addEventListener('change', renderCourses);
    document.getElementById('teacher-filter').addEventListener('change', renderCourses);
});

async function loadCourses() {
    try {
        // 1. Fetch Teachers for Dropdown
        const teacherSelect = document.getElementById('teacher-filter');
        const teacherMap = {};

        // Fetch ALL teachers first (to map names), but filter DDL
        const teacherSnap = await getDocs(collection(db, "teachers"));

        // Clear previous options (except 'All')
        teacherSelect.innerHTML = '<option value="all">كل المعلمين</option>';

        // Get Teacher ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const preSelectedTeacher = urlParams.get('teacherId');

        teacherSnap.forEach(t => {
            const data = t.data();
            teacherMap[t.id] = data.name;

            // SCOPE CHECK: Only add to dropdown if allowed
            if (assignedTeachers.size > 0 && !assignedTeachers.has(t.id)) {
                return; // Skip unauthorized teachers in dropdown
            }

            const option = document.createElement('option');
            option.value = t.id;
            option.innerText = data.name;
            if (t.id === preSelectedTeacher) option.selected = true;
            teacherSelect.appendChild(option);
        });

        // 2. Fetch Courses
        // Optimization: In a real app we should query only relevant courses if scoped.
        // For now, client-side filtering is okay given assumed low volume, 
        // BUT better to use 'in' query if possible. 
        // Firestore 'in' matches up to 10 items.
        // Set fallback to client side.

        let q = collection(db, "courses");

        /* 
         * Note: If assignedTeachers is large, we can't use 'in'.
         * We will fetch all and filter in JS for now.
         */

        const snap = await getDocs(q);
        allCourses = [];

        snap.forEach(d => {
            const c = d.data();

            // SCOPE CHECK: Filter courses from unauthorized teachers
            if (assignedTeachers.size > 0 && c.teacherId && !assignedTeachers.has(c.teacherId)) {
                return; // Skip
            }

            c.id = d.id;
            c.teacherName = teacherMap[c.teacherId] || 'غير معروف';
            allCourses.push(c);
        });

        renderCourses();

    } catch (e) {
        console.error(e);
        document.getElementById('courses-list').innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">خطأ في التحميل</td></tr>';
        if (window.UIManager) UIManager.showToast('حدث خطأ أثناء تحميل البيانات', 'error');
    }
}

function renderCourses() {
    const tbody = document.getElementById('courses-list');
    const statusFilter = document.getElementById('status-filter').value;
    const teacherFilter = document.getElementById('teacher-filter').value;
    const search = document.getElementById('search-input').value.toLowerCase();

    tbody.innerHTML = '';

    const filtered = allCourses.filter(c => {
        const matchStatus = statusFilter === 'all' || c.status === statusFilter || (!c.status && statusFilter === 'all');
        const matchTeacher = teacherFilter === 'all' || c.teacherId === teacherFilter;
        const matchSearch = c.title.toLowerCase().includes(search);
        return matchStatus && matchTeacher && matchSearch;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">لا توجد نتائج</td></tr>';
        return;
    }

    filtered.forEach(c => {
        const status = c.status || 'draft';
        let badgeClass = 'badge-success';
        let statusText = 'نشط';

        if (status === 'pending') { badgeClass = 'badge-warning'; statusText = 'قيد المراجعة'; }
        else if (status === 'rejected') { badgeClass = 'badge-danger'; statusText = 'مرفوض'; }
        else if (status === 'draft') { badgeClass = 'badge-secondary'; statusText = 'مسودة'; }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="font-weight:bold;">${c.title}</td>
            <td>${c.teacherName}</td>
            <td>${c.price ? c.price + ' ج.م' : 'مجاني'}</td>
            <td><span class="badge ${badgeClass}">${statusText}</span></td>
            <td>
                <div style="display:flex; gap:10px;">
                    ${status !== 'active' ? `<button class="btn-icon-action approve-btn" data-id="${c.id}" style="color:#10b981;" title="موافقة"><i class="fas fa-check"></i></button>` : ''}
                    ${status !== 'rejected' ? `<button class="btn-icon-action reject-btn" data-id="${c.id}" style="color:#f59e0b;" title="رفض"><i class="fas fa-times"></i></button>` : ''}
                    <button class="btn-icon-action delete-btn" data-id="${c.id}" style="color:#ef4444;" title="حذف"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    attachListeners();
}

function attachListeners() {
    document.querySelectorAll('.approve-btn').forEach(b => b.onclick = (e) => updateStatus(e.currentTarget.dataset.id, 'active'));
    document.querySelectorAll('.reject-btn').forEach(b => b.onclick = (e) => updateStatus(e.currentTarget.dataset.id, 'rejected'));
    document.querySelectorAll('.delete-btn').forEach(b => b.onclick = (e) => deleteCourse(e.currentTarget.dataset.id));
}

async function updateStatus(id, status) {
    const confirmed = await UIManager.showConfirm(
        'تأكيد الإجراء',
        `هل أنت متأكد من تغيير الحالة إلى ${status === 'active' ? 'نشط' : 'مرفوض'}؟`,
        'نعم، نفذ',
        'إلغاء'
    );

    if (!confirmed) return;

    try {
        await updateDoc(doc(db, "courses", id), { status: status });
        const idx = allCourses.findIndex(c => c.id === id);
        if (idx > -1) allCourses[idx].status = status;
        renderCourses();
        if (window.UIManager) UIManager.showToast('تم تحديث حالة الكورس بنجاح');
    } catch (e) {
        console.error(e);
        if (window.UIManager) UIManager.showToast('حدث خطأ أثناء التحديث', 'error');
    }
}

async function deleteCourse(id) {
    const confirmed = await UIManager.showConfirm(
        'حذف الكورس',
        'هل أنت متأكد من حذف هذا الكورس نهائياً؟ لا يمكن التراجع عن هذا الإجراء.',
        'نعم، احذف',
        'إلغاء'
    );

    if (!confirmed) return;

    try {
        await deleteDoc(doc(db, "courses", id));
        allCourses = allCourses.filter(c => c.id !== id);
        renderCourses();
        if (window.UIManager) UIManager.showToast('تم حذف الكورس بنجاح');
    } catch (e) {
        console.error(e);
        if (window.UIManager) UIManager.showToast('حدث خطأ أثناء الحذف', 'error');
    }
}
