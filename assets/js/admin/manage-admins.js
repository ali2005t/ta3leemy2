import { auth, db, app } from '../firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- Secondary Auth for creating users without logging out ---
// We re-use the config from the main app but create a new instance
import { firebaseConfig } from '../firebase-config.js';

let secondaryApp;
let secondaryAuth;

try {
    secondaryApp = initializeApp(firebaseConfig, "Secondary");
    secondaryAuth = getAuth(secondaryApp);
} catch (e) {
    // If already exists
    console.log("Secondary app already initialized");
}

document.addEventListener('DOMContentLoaded', async () => {
    loadAdmins();

    // Form Submit
    document.getElementById('admin-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = 'جاري الحفظ...';

        try {
            const id = document.getElementById('edit-admin-id').value;
            const name = document.getElementById('admin-name').value;
            const email = document.getElementById('admin-email').value;
            const password = document.getElementById('admin-password').value;

            // Collect Permissions
            const permissions = [];
            document.querySelectorAll('.permission-item input[type="checkbox"]').forEach(cb => {
                if (cb.checked) permissions.push(cb.value);
            });

            // Collect Assigned Teachers (Custom Dropdown)
            const assignedTeachers = [];
            document.querySelectorAll('.custom-option.selected').forEach(opt => {
                assignedTeachers.push(opt.dataset.value);
            });


            if (id) {
                // Edit Mode
                await updateDoc(doc(db, "admins", id), {
                    name,
                    // email: email, // Email change requires Auth update, complex for MVP, skip or warn
                    permissions,
                    assignedTeachers,
                    updatedAt: serverTimestamp()
                });
                alert("تم تحديث بيانات المساعد بنجاح");
            } else {
                // Create Mode
                if (!password) throw new Error("كلمة المرور مطلوبة للحساب الجديد");

                // 1. Create Auth User (Secondary App)
                const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
                const uid = userCredential.user.uid;

                // Sign out the secondary user immediately
                await signOut(secondaryAuth);

                // 2. Create Firestore Doc
                await setDoc(doc(db, "admins", uid), {
                    name,
                    email,
                    role: 'support_agent', // Default role
                    permissions,
                    assignedTeachers, // Save assigned teachers
                    createdAt: serverTimestamp(),
                    createdBy: auth.currentUser.uid
                });

                alert("تم إنشاء حساب المساعد بنجاح! 🚀");
            }

            document.getElementById('admin-modal').style.display = 'none';
            loadAdmins();

        } catch (error) {
            console.error(error);
            let msg = error.message;
            if (error.code === 'auth/email-already-in-use') msg = "البريد الإلكتروني مستخدم بالفعل";
            alert("خطأ: " + msg);
        } finally {
            btn.disabled = false;
            btn.innerText = originalText;
        }
    });

    loadTeachersDropdown();
});

// --- Custom Dropdown Logic ---
let teacherOptionsLoaded = false;

async function loadTeachersDropdown() {
    const container = document.getElementById('custom-teacher-options');
    const trigger = document.getElementById('teachers-dropdown-trigger');

    // Toggle
    trigger.onclick = (e) => {
        e.stopPropagation();
        container.classList.toggle('open');
    };

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!trigger.contains(e.target) && !container.contains(e.target)) {
            container.classList.remove('open');
        }
    });

    try {
        const snap = await getDocs(collection(db, "teachers"));
        container.innerHTML = '';

        if (snap.empty) {
            container.innerHTML = '<div style="padding:10px;">لا يوجد معلمين</div>';
            return;
        }

        snap.forEach(docSnap => {
            const t = docSnap.data();
            const div = document.createElement('div');
            div.className = 'custom-option';
            div.dataset.value = docSnap.id;
            div.dataset.name = t.name || t.platformName;

            div.innerHTML = `
                <div style="width:16px; height:16px; border:1px solid #cbd5e1; border-radius:4px; margin-left:10px; display:flex; align-items:center; justify-content:center;">
                    <i class="fas fa-check" style="font-size:0.7rem; display:none;"></i>
                </div>
                <span>${t.name || t.platformName}</span>
            `;

            div.onclick = (e) => {
                e.stopPropagation();
                div.classList.toggle('selected');
                // Toggle Check Icon
                const check = div.querySelector('.fa-check');
                check.style.display = div.classList.contains('selected') ? 'block' : 'none';

                updateTriggerDisplay();
            };

            container.appendChild(div);
        });

        teacherOptionsLoaded = true;

    } catch (e) {
        console.error("Error loading teachers", e);
        container.innerHTML = '<div style="padding:10px; color:red">فشل التحميل</div>';
    }
}

function updateTriggerDisplay() {
    const trigger = document.getElementById('teachers-dropdown-trigger');
    const selected = document.querySelectorAll('.custom-option.selected');

    if (selected.length === 0) {
        trigger.innerHTML = `
            <span class="placeholder" style="color:#94a3b8;">اختر المعلمين...</span>
            <i class="fas fa-chevron-down" style="font-size:0.8rem; color:#94a3b8; margin-right:auto;"></i>
        `;
        return;
    }

    trigger.innerHTML = ''; // Clear
    selected.forEach(opt => {
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.innerHTML = `
            ${opt.dataset.name} 
            <i class="fas fa-times" onclick="removeTag(event, '${opt.dataset.value}')"></i>
        `;
        trigger.appendChild(tag);
    });
    trigger.innerHTML += `<i class="fas fa-chevron-down" style="font-size:0.8rem; color:#94a3b8; margin-right:auto;"></i>`;
}

// Global helper for tag removal
window.removeTag = (e, val) => {
    e.stopPropagation();
    const opt = document.querySelector(`.custom-option[data-value="${val}"]`);
    if (opt) {
        opt.classList.remove('selected');
        opt.querySelector('.fa-check').style.display = 'none';
        updateTriggerDisplay();
    }
};

async function loadAdmins() {
    const tbody = document.getElementById('admins-table-body');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">جاري التحميل...</td></tr>';

    try {
        const q = query(collection(db, "admins"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);

        tbody.innerHTML = '';
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">لا يوجد مساعدين حالياً</td></tr>';
            return;
        }

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const isMe = auth.currentUser && auth.currentUser.uid === docSnap.id;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:bold;">${data.name} ${isMe ? '(أنت)' : ''}</td>
                <td>${data.email}</td>
                <td><span class="badge" style="background:${data.role === 'super_admin' ? '#f59e0b' : '#6366f1'}; color:white; padding:2px 8px; border-radius:4px;">${data.role === 'super_admin' ? 'مشرف عام' : 'مساعد'}</span></td>
                <td>${data.assignedTeachers ? data.assignedTeachers.length : 'الكل'}</td>
                <td><span class="status-badge" style="background:#dcfce7; color:#166534;">نشط</span></td>
                <td>
                    ${!isMe ? `
                    <button class="btn-icon edit-btn" style="color:#3b82f6;"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon delete-btn" style="color:#ef4444;"><i class="fas fa-trash"></i></button>
                    ` : '<span style="color:#94a3b8; font-size:0.8rem;">لا يمكن تعديل نفسك من هنا</span>'}
                </td>
            `;

            if (!isMe) {
                const editBtn = tr.querySelector('.edit-btn');
                editBtn.onclick = () => openEditModal(docSnap.id, data);

                const deleteBtn = tr.querySelector('.delete-btn');
                deleteBtn.onclick = () => deleteAdmin(docSnap.id, data.name);
            }

            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">خطأ: ${e.message}</td></tr>`;
    }
}

function openEditModal(id, data) {
    document.getElementById('modal-title').innerText = 'تعديل بيانات المساعد';
    document.getElementById('edit-admin-id').value = id;
    document.getElementById('admin-name').value = data.name;
    document.getElementById('admin-email').value = data.email;
    document.getElementById('admin-password').value = ''; // Don't show password

    // Check Permissions
    document.querySelectorAll('.permission-item input[type="checkbox"]').forEach(cb => {
        cb.checked = data.permissions && data.permissions.includes(cb.value);
    });

    // Check Assigned Teachers (Custom Dropdown)
    const assigned = data.assignedTeachers || [];
    document.querySelectorAll('.custom-option').forEach(opt => {
        const isSelected = assigned.includes(opt.dataset.value);
        if (isSelected) {
            opt.classList.add('selected');
            const check = opt.querySelector('.fa-check');
            if (check) check.style.display = 'block';
        } else {
            opt.classList.remove('selected');
            const check = opt.querySelector('.fa-check');
            if (check) check.style.display = 'none';
        }
    });
    updateTriggerDisplay();

    document.getElementById('admin-modal').style.display = 'flex';
}

async function deleteAdmin(id, name) {
    if (confirm(`هل أنت متأكد من حذف المساعد "${name}"؟\nلا يمكن التراجع عن هذا الإجراء.`)) {
        try {
            await deleteDoc(doc(db, "admins", id));
            // Note: Auth user deletion usually requires backend admin SDK. 
            // We only delete the Doc mostly. Disabling functionality relies on the doc check.
            alert("تم حذف الحساب بنجاح");
            loadAdmins();
        } catch (e) {
            alert("خطأ: " + e.message);
        }
    }
}
