import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initHeader } from './header-manager.js';
import { getEffectiveUserUid } from './impersonation-manager.js';
import {
    collection,
    query,
    where,
    getDocs,
    getDoc,
    doc,
    deleteDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { UIManager } from './ui-manager.js';

document.addEventListener('DOMContentLoaded', () => {

    const tableBody = document.getElementById('lectures-table-body');
    const loading = document.getElementById('loading-indicator');
    const empty = document.getElementById('empty-state');
    const pageTitle = document.querySelector('h3');
    const addBtn = document.querySelector('.top-bar .btn-primary');
    const searchInput = document.getElementById('search-lectures');

    const params = new URLSearchParams(window.location.search);
    const filterUnitId = params.get('unitId');
    const filterTrainingId = params.get('trainingId');

    // Maps for resolving IDs to Names
    let trainingMap = {};
    let unitMap = {};
    let allLectures = []; // Local cache for filtering

    // Dropdown close logic
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.action-dropdown')) {
            document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('show'));
        }
    });

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            initHeader(user);
            const uid = await getEffectiveUserUid(user);

            // 1. Pre-load Metadata (Trainings & Units)
            await loadMetadata(uid);

            // 2. Start Realtime Listener
            subscribeLectures(uid);

            setupAddButton();
        } else {
            window.location.href = '../auth/login.html';
        }
    });

    function setupAddButton() {
        if (addBtn && filterUnitId && filterTrainingId) {
            addBtn.onclick = () => {
                window.location.href = `create-lecture.html?trainingId=${filterTrainingId}&unitId=${filterUnitId}`;
            };
        }
    }

    async function loadMetadata(uid) {
        try {
            const tQ = query(collection(db, "training_programs"), where("teacherId", "==", uid));
            const tSnap = await getDocs(tQ);
            tSnap.forEach(d => trainingMap[d.id] = d.data().title);

            const uQ = query(collection(db, "units"), where("teacherId", "==", uid));
            const uSnap = await getDocs(uQ);
            uSnap.forEach(d => unitMap[d.id] = d.data().title);
        } catch (e) { console.error("Metadata Error:", e); }
    }

    function subscribeLectures(uid) {
        // Build Query
        let constraints = [
            where("teacherId", "==", uid)
        ];

        if (filterUnitId) {
            constraints.push(where("unitId", "==", filterUnitId));
            // Set Title based on pre-loaded map if possible, or fetch
            if (unitMap[filterUnitId] && pageTitle) {
                pageTitle.innerText = `محاضرات: ${unitMap[filterUnitId]}`;
            }
        }

        const q = query(collection(db, "course_content"), ...constraints);

        // Realtime Listener
        onSnapshot(q, (snapshot) => {
            allLectures = [];

            if (snapshot.empty) {
                renderList([]);
                return;
            }

            snapshot.forEach(doc => {
                allLectures.push({ id: doc.id, ...doc.data() });
            });

            // Apply Search Filtering (Client Side)
            applyFilter();

        }, (error) => {
            console.error("Realtime Error:", error);
            loading.innerText = "خطأ في الاتصال بالسيرفر";
        });
    }

    // Search Logic
    if (searchInput) {
        searchInput.addEventListener('input', applyFilter);
    }

    function applyFilter() {
        const term = searchInput ? searchInput.value.toLowerCase() : '';
        const filtered = allLectures.filter(l => l.title.toLowerCase().includes(term));
        renderList(filtered);
    }

    function renderList(list) {
        loading.style.display = 'none';
        tableBody.innerHTML = '';

        if (list.length === 0) {
            empty.style.display = 'block';
            return;
        } else {
            empty.style.display = 'none';
        }

        list.forEach((lect, index) => {
            renderRow(lect, index + 1);
        });
    }

    function renderRow(data, index) {
        const template = document.getElementById('lecture-row-template');
        const row = template.content.cloneNode(true);

        row.querySelector('.row-index').innerText = index;
        row.querySelector('.row-title').innerText = data.title;

        let typeText = "";
        if (data.hasVideo) typeText += '<i class="fas fa-video" title="فيديو"></i> ';
        if (data.hasDrive) typeText += '<i class="fas fa-file-pdf" title="ملف"></i> ';
        if (data.isLive) typeText += '<span class="badge-live">LIVE</span> '; // Ensure .badge-live style exists or generic style

        row.querySelector('.row-type').innerHTML = typeText || "محاضرة";

        row.querySelector('.row-training').innerText = trainingMap[data.trainingId] || '---';
        row.querySelector('.row-unit').innerText = unitMap[data.unitId] || '---';

        const price = data.price > 0 ? `${data.price} ج.م` : 'مجاني';
        row.querySelector('.row-price').innerText = price;

        row.querySelector('.row-limits').innerText = `${data.viewsLimit || '∞'} / ${data.daysLimit || '∞'} يوم`;

        const dropdownBtn = row.querySelector('.btn-icon-menu');
        const dropdownMenu = row.querySelector('.dropdown-menu'); // Should be scoped? Yes, cloneNode scopes it.

        dropdownBtn.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.dropdown-menu').forEach(m => m !== dropdownMenu ? m.classList.remove('show') : null);
            dropdownMenu.classList.toggle('show'); // Logic relies on CSS .show
            // Note: Standard logic often uses `parentElement.classList.toggle` if menu is sibling.
            // But here template structure is `action-dropdown > button + menu`.
            // Let's ensure CSS matches. Assuming .dropdown-menu.show { display: block }
        };

        const editBtn = row.querySelector('.edit-btn');
        editBtn.onclick = () => {
            window.location.href = `create-lecture.html?id=${data.id}`;
        };

        const deleteBtn = row.querySelector('.delete-btn');
        deleteBtn.onclick = async () => {
            // No reload needed!
            if (await UIManager.showConfirm("حذف محاضرة", `هل أنت متأكد من حذف ${data.title}؟`)) {
                try {
                    await deleteDoc(doc(db, "course_content", data.id));
                    if (window.showToast) window.showToast("تم الحذف بنجاح", "success");
                    // Listener will update UI
                } catch (e) {
                    alert("خطأ في الحذف");
                }
            }
        };

        tableBody.appendChild(row);
    }

});
