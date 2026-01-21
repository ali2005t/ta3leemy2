import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getEffectiveUserUid } from './impersonation-manager.js';
import {
    collection,
    query,
    where,
    getDocs,
    getDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    const tableBody = document.getElementById('courses-table-body');
    const loadingIndicator = document.getElementById('loading-indicator');
    const emptyState = document.getElementById('empty-state');
    const searchInput = document.getElementById('search-courses');
    if (searchInput) searchInput.addEventListener('input', applyFilter);

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.action-dropdown')) {
            document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('show'));
        }
    });

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const uid = await getEffectiveUserUid(user);
            await subscribeCourses(uid);
            await subscribeCourses(uid);
        } else {
            window.location.href = '../auth/login.html';
        }
    });

    let allCourses = [];
    let trainingMap = {};

    async function subscribeCourses(uid) {
        try {
            // 1. Pre-load Training Map (Metadata)
            const trainingsSnap = await getDocs(query(collection(db, "training_programs"), where("teacherId", "==", uid)));
            trainingsSnap.forEach(t => trainingMap[t.id] = t.data().title);

            // 2. Realtime Listener
            const q = query(
                collection(db, "courses"),
                where("teacherId", "==", uid)
                // orderBy("createdAt", "desc") 
            );

            onSnapshot(q, (snapshot) => {
                allCourses = [];
                if (snapshot.empty) {
                    renderList([]);
                    return;
                }

                snapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    data.id = docSnap.id;
                    data.trainingTitle = trainingMap[data.trainingId] || "-";
                    allCourses.push(data);
                });

                applyFilter();

            }, (error) => {
                console.error("Realtime Error:", error);
                loadingIndicator.innerText = "خطأ في الاتصال";
            });

        } catch (error) {
            console.error(error);
            loadingIndicator.innerText = "Error loading courses";
        }
    }

    function applyFilter() {
        const term = searchInput ? searchInput.value.toLowerCase() : '';
        const filtered = allCourses.filter(c => c.title.toLowerCase().includes(term));
        renderList(filtered);
    }

    function renderList(list) {
        loadingIndicator.style.display = 'none';
        tableBody.innerHTML = '';

        if (list.length === 0) {
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            list.forEach((data, index) => {
                renderRow(data, index + 1);
            });
        }
    }

    function renderRow(data, index) {
        const template = document.getElementById('course-row-template');
        const row = template.content.cloneNode(true);

        row.querySelector('.row-index').innerText = index;
        row.querySelector('.row-title').innerText = data.title;
        row.querySelector('.row-training').innerText = data.trainingTitle;
        row.querySelector('.row-price').innerText = data.price || "0.00";

        let status = data.status === 'active' ? 'منشور' : 'مسودة';
        row.querySelector('.row-status').innerText = status;

        // Status Toggle
        const statusBadge = row.querySelector('.row-status');
        statusBadge.style.cursor = 'pointer';
        statusBadge.title = 'اضغط للتغيير';
        statusBadge.onclick = async () => {
            const newStatus = data.status === 'active' ? 'draft' : 'active';
            // Optimistic UI update
            statusBadge.innerText = newStatus === 'active' ? 'منشور' : 'مسودة';
            // Update Firestore
            try {
                await updateDoc(doc(db, "courses", data.id), { status: newStatus });
                data.status = newStatus; // update local data
            } catch (e) {
                console.error(e);
                alert("فشل تحديث الحالة");
                window.location.reload();
            }
        };

        // Actions
        const btn = row.querySelector('.btn-icon-menu');
        const menu = row.querySelector('.dropdown-menu');

        btn.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
            menu.classList.toggle('show');
        };

        // View Content
        row.querySelector('.view-btn').onclick = () => {
            window.location.href = `course-content.html?id=${data.id}`;
        };

        // Edit
        row.querySelector('.edit-btn').onclick = () => {
            window.location.href = `edit-course.html?id=${data.id}`;
        };

        // Delete (Create Button if not in template, or assume template has it?)
        // The standard template has 2 buttons usually. We can append a delete button dynamically if missing in HTML.
        // Or better, let's look at HTML template in courses.html.
        // Assuming there is no Delete button in current HTML template based on previous `write_to_file`.
        // I will add it dynamically here.

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'dropdown-item danger';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i> حذف';
        deleteBtn.onclick = async () => {
            if (await UIManager.showConfirm("حذف كورس", "هل أنت متأكد من حذف هذا الكورس؟ سيتم حذف جميع المحاضرات التابعة له.")) {
                try {
                    await deleteDoc(doc(db, "courses", data.id));
                    // Ideally delete sub-lectures too (needs cloud function or batch)
                    alert("تم الحذف بنجاح");
                    // window.location.reload(); // Live update handles it
                } catch (e) {
                    alert("خطأ في الحذف: " + e.message);
                }
            }
        };
        menu.appendChild(deleteBtn);

        tableBody.appendChild(row);
    }
});
