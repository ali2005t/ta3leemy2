import { db, auth } from '../firebase-config.js';
import {
    collection,
    query,
    getDocs,
    addDoc,
    doc,
    updateDoc,
    deleteDoc,
    orderBy,
    serverTimestamp,
    limit,
    where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
    if (user) {
        loadGoals();
    } else {
        window.location.href = 'login.html';
    }
});

let allGoals = [];

async function loadGoals() {
    const tbody = document.getElementById('goals-table-body');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">جاري التحميل...</td></tr>';

    try {
        const q = query(collection(db, "referral_goals"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);

        allGoals = [];
        tbody.innerHTML = '';

        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">لا توجد أهداف مضافة حالياً</td></tr>';
            return;
        }

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const id = docSnap.id;
            allGoals.push({ id, ...data });

            const rewardText = data.rewardType === 'subscription_period'
                ? `${data.rewardValue} يوم اشتراك`
                : `${data.rewardValue} ج.م رصيد`;

            const statusBadge = data.isActive
                ? '<span class="status-badge status-active">نشط</span>'
                : '<span class="status-badge status-draft">غير نشط</span>';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${data.description}</strong></td>
                <td>${data.targetCount} معلم</td>
                <td>${rewardText}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn-icon" onclick="editGoal('${id}')" style="color:#3b82f6;"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon" onclick="deleteGoal('${id}')" style="color:#ef4444;"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">خطأ في التحميل</td></tr>';
    }
}

// Modal Logic
window.openGoalModal = (id = null) => {
    const modal = document.getElementById('goal-modal');
    const form = document.getElementById('goal-form');

    if (id) {
        const goal = allGoals.find(g => g.id === id);
        if (!goal) return;

        document.getElementById('modal-title').innerText = 'تعديل الهدف';
        document.getElementById('goal-id').value = id;
        document.getElementById('goal-description').value = goal.description;
        document.getElementById('goal-target').value = goal.targetCount;
        document.getElementById('goal-reward-type').value = goal.rewardType;
        document.getElementById('goal-reward-value').value = goal.rewardValue;
        document.getElementById('goal-active').checked = goal.isActive;
        document.getElementById('goal-start-date').value = goal.startDate || '';
        document.getElementById('goal-end-date').value = goal.endDate || '';
        document.getElementById('goal-target-type').value = goal.targetType || 'all';

        // Handle Target Display
        const targetId = goal.targetId;
        document.getElementById('goal-target-id').value = targetId || '';
        if (goal.targetType === 'specific' && targetId) {
            // Retrieve Name ideally, but for now show ID or "Specific Teacher"
            // In a real app we'd fetch the teacher name here.
            // Let's just set the hidden ID and show a placeholder or try to fetch name if cached?
            // Simple: Show "Selected ID: ..."
            document.getElementById('selected-teacher-name').innerText = "المعلم المحدد (ID loaded)";
            document.getElementById('selected-teacher-display').style.display = 'flex';
        } else {
            clearSelectedTeacher();
        }
        toggleTargetSearch();
    } else {
        document.getElementById('modal-title').innerText = 'إضافة هدف جديد';
        form.reset();
        document.getElementById('goal-id').value = '';
        document.getElementById('goal-active').checked = true;
    }

    modal.style.display = 'flex';
};

// UI Helpers
window.toggleTargetSearch = () => {
    const type = document.getElementById('goal-target-type').value;
    const group = document.getElementById('target-search-group');
    group.style.display = type === 'specific' ? 'block' : 'none';
};

window.clearSelectedTeacher = () => {
    document.getElementById('goal-target-id').value = '';
    document.getElementById('selected-teacher-display').style.display = 'none';
    document.getElementById('teacher-search-input').value = '';
};

// Search Logic
const searchInput = document.getElementById('teacher-search-input');
const resultsDiv = document.getElementById('teacher-search-results');
let searchTimeout;

if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const term = e.target.value.trim();
        if (term.length < 2) {
            resultsDiv.style.display = 'none';
            return;
        }

        searchTimeout = setTimeout(async () => {
            resultsDiv.innerHTML = '<div style="padding:10px; color:#94a3b8;">جاري البحث...</div>';
            resultsDiv.style.display = 'block';

            try {
                // Determine if searching by email or name (basic check)
                // Firestore exact match or range query. Let's do simple name search.
                const q = query(collection(db, "teachers"),
                    where("name", ">=", term),
                    where("name", "<=", term + "\uf8ff"),
                    limit(5)
                );
                const snap = await getDocs(q);

                resultsDiv.innerHTML = '';
                if (snap.empty) {
                    resultsDiv.innerHTML = '<div style="padding:10px; color:#ef4444;">لم يتم العثور على نتائج</div>';
                    return;
                }

                snap.forEach(doc => {
                    const t = doc.data();
                    const div = document.createElement('div');
                    div.style.padding = '10px';
                    div.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                    div.style.cursor = 'pointer';
                    div.innerHTML = `<div>${t.name}</div><div style="font-size:0.8rem; color:#64748b;">${t.email}</div>`;
                    div.onmouseover = () => div.style.background = 'rgba(255,255,255,0.05)';
                    div.onmouseout = () => div.style.background = 'transparent';
                    div.onclick = () => {
                        document.getElementById('goal-target-id').value = doc.id;
                        document.getElementById('selected-teacher-name').innerText = t.name;
                        document.getElementById('selected-teacher-display').style.display = 'flex';
                        resultsDiv.style.display = 'none';
                        searchInput.value = '';
                    };
                    resultsDiv.appendChild(div);
                });

            } catch (e) { console.error(e); }
        }, 500);
    });
}

window.editGoal = (id) => openGoalModal(id);

window.deleteGoal = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا العرض؟')) return;
    try {
        await deleteDoc(doc(db, "referral_goals", id));
        loadGoals();
        UIManager.showToast('تم الحذف بنجاح');
    } catch (e) {
        console.error(e);
        alert('خطأ أثناء الحذف');
    }
};

// Form Submit
document.getElementById('goal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('save-goal-btn');
    btn.disabled = true;
    btn.innerText = 'جاري الحفظ...';

    const id = document.getElementById('goal-id').value;
    const data = {
        description: document.getElementById('goal-description').value,
        targetCount: parseInt(document.getElementById('goal-target').value),
        rewardType: document.getElementById('goal-reward-type').value,
        rewardValue: parseInt(document.getElementById('goal-reward-value').value),
        isActive: document.getElementById('goal-active').checked,
        startDate: document.getElementById('goal-start-date').value || null,
        endDate: document.getElementById('goal-end-date').value || null,
        targetType: document.getElementById('goal-target-type').value,
        targetId: document.getElementById('goal-target-id').value || null,
        updatedAt: serverTimestamp()
    };

    if (data.targetType === 'specific' && !data.targetId) {
        alert("يرجى اختيار المعلم المستهدف");
        document.getElementById('save-goal-btn').disabled = false;
        document.getElementById('save-goal-btn').innerText = 'حفظ';
        return;
    }

    try {
        if (id) {
            await updateDoc(doc(db, "referral_goals", id), data);
        } else {
            data.createdAt = serverTimestamp();
            await addDoc(collection(db, "referral_goals"), data);
        }

        document.getElementById('goal-modal').style.display = 'none';
        loadGoals();
        UIManager.showToast('تم الحفظ بنجاح');
    } catch (e) {
        console.error(e);
        alert('حدث خطأ: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = 'حفظ';
    }
});
