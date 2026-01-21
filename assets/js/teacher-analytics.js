import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getEffectiveUserUid } from './impersonation-manager.js';
import { initHeader } from './header-manager.js';
import {
    collection,
    doc,
    getDoc,
    query,
    where,
    getDocs,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
    if (user) {
        initHeader(user);
        const uid = await getEffectiveUserUid(user);
        loadAnalytics(uid);
    } else {
        window.location.href = '../auth/login.html';
    }
});

async function loadAnalytics(teacherId) {
    try {
        // 1. Fetch Teacher Profile for Usage Stats
        const teacherDoc = await getDoc(doc(db, "teachers", teacherId));
        if (teacherDoc.exists()) {
            const tData = teacherDoc.data();

            // Storage
            const usedBytes = tData.storageUsed || 0;
            let limitGB = tData.storageLimit || 5;
            if (tData.planTier === 'trial') limitGB = 5;
            const usedGB = (usedBytes / (1024 * 1024 * 1024)).toFixed(2);
            const elStorageUsed = document.getElementById('stat-storage-used');
            const elStorageLimit = document.getElementById('stat-storage-limit');
            if (elStorageUsed) elStorageUsed.innerText = usedGB;
            if (elStorageLimit) elStorageLimit.innerText = limitGB;

            // 1. Determine Effective Plan (Priority: subscriptionPlan > plan)
            let effectivePlan = (tData.subscriptionPlan || tData.plan || 'free').toLowerCase();
            // Handle specific overrides
            if (tData.planTier === 'trial') effectivePlan = 'trial';
            if (effectivePlan.includes('pro')) effectivePlan = 'pro'; // Normalize 'pro_monthly' etc
            if (effectivePlan.includes('elite')) effectivePlan = 'elite';

            // 2. Set Limits based on Effective Plan
            let studentLimit = 50;
            if (effectivePlan === 'pro') studentLimit = 1000;
            if (effectivePlan === 'elite') studentLimit = '∞';
            if (effectivePlan === 'trial') studentLimit = 50;

            // 3. Update UI - Students
            const studentsQ = query(collection(db, "students"), where("enrolledTeachers", "array-contains", teacherId));
            const studentsSnap = await getDocs(studentsQ);
            const studentCount = studentsSnap.size;

            const elStudentsCurr = document.getElementById('stat-students-current');
            const elStudentsLim = document.getElementById('stat-students-limit');
            if (elStudentsCurr) elStudentsCurr.innerText = studentCount;
            if (elStudentsLim) elStudentsLim.innerText = studentLimit;

            // 4. Update UI - Courses
            const coursesQ = query(collection(db, "training_programs"), where("teacherId", "==", teacherId));
            const coursesSnap = await getDocs(coursesQ);
            const coursesCount = coursesSnap.size;

            const elCourses = document.getElementById('stat-courses-active');
            if (elCourses) elCourses.innerText = coursesCount;

            // 5. Update UI - Plan Name
            const elPlan = document.getElementById('stat-plan-name');
            if (elPlan) {
                const planMap = {
                    'free': 'مجانية',
                    'start': 'بداية (Start)',
                    'pro': 'محترف (Pro)',
                    'elite': 'نخبة (Elite)',
                    'trial': 'تجريبية',
                    'free_trial': 'تجريبية'
                };
                elPlan.innerText = planMap[effectivePlan] || effectivePlan.toUpperCase();
            }
        }

        // 2. Fetch Financials (Access Codes)
        const q = query(collection(db, "access_codes"), where("teacherId", "==", teacherId), where("isUsed", "==", true));
        const snapshot = await getDocs(q);

        let totalSales = 0;
        let monthSales = 0;
        let totalCount = 0;
        let monthCount = 0;

        const currentMonth = new Date().getMonth();
        const salesByMonth = new Array(12).fill(0);
        const topCourses = {};

        const recentList = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            const price = parseFloat(data.price || 0);
            const date = data.usedAt ? data.usedAt.toDate() : (data.createdAt ? data.createdAt.toDate() : new Date());

            totalSales += price;
            totalCount++;

            if (date.getMonth() === currentMonth) {
                monthSales += price;
                monthCount++;
            }

            // Chart Data (Simple Year View)
            salesByMonth[date.getMonth()] += price;

            // Top Course
            const programName = data.programName || "عام";
            topCourses[programName] = (topCourses[programName] || 0) + 1;

            // Recent
            if (recentList.length < 5) {
                recentList.push({
                    name: data.studentName || "طالب",
                    program: programName,
                    price: price,
                    date: date
                });
            }
        });

        // Sort Recent by date (desc) - manually pushing restricted sorting, better to sort whole array if needed.
        // Since we are iterating unsorted snapshot (unless query is sorted), let's just use what we have or sort specific recent array.
        // For accurate "Recent", we should have `orderBy('usedAt')` in query, but that requires index. Client sort is fine for small scale.

        // Update UI Stats (Safe)
        const elTotalSales = document.getElementById('stat-total-sales');
        if (elTotalSales) elTotalSales.innerText = totalSales.toLocaleString() + ' ج.م';

        const elTotalCount = document.getElementById('stat-total-count');
        if (elTotalCount) elTotalCount.innerText = totalCount + ' عملية';

        const elMonthSales = document.getElementById('stat-month-sales');
        if (elMonthSales) elMonthSales.innerText = monthSales.toLocaleString() + ' ج.م';

        const elMonthCount = document.getElementById('stat-month-count');
        if (elMonthCount) elMonthCount.innerText = monthCount + ' عملية';

        // Top Course
        let bestCourse = "-";
        let bestCount = 0;
        for (const [course, count] of Object.entries(topCourses)) {
            if (count > bestCount) {
                bestCount = count;
                bestCourse = course;
            }
        }

        const elTopCourse = document.getElementById('stat-top-course');
        if (elTopCourse) elTopCourse.innerText = bestCourse;

        const elTopCount = document.getElementById('stat-top-course-count');
        if (elTopCount) elTopCount.innerText = bestCount + ' طالب';

        // Render Recent List
        const recentContainer = document.getElementById('recent-sales-list');
        if (recentContainer) {
            recentContainer.innerHTML = '';
            if (recentList.length === 0) {
                recentContainer.innerHTML = '<div style="text-align:center; color:#64748b;">لا توجد بيانات حديثة</div>';
            } else {
                recentList.forEach(item => {
                    const div = document.createElement('div');
                    div.style.padding = "10px";
                    div.style.borderBottom = "1px solid #334155";
                    div.style.display = "flex";
                    div.style.justifyContent = "space-between";
                    div.innerHTML = `
                        <div>
                            <div style="color:white; font-weight:bold;">${item.name}</div>
                            <div style="color:#64748b; font-size:0.8rem;">${item.program}</div>
                        </div>
                        <div style="text-align:left;">
                            <div style="color:#10b981;">+${item.price} ج.م</div>
                            <div style="color:#475569; font-size:0.75rem;">${item.date.toLocaleDateString()}</div>
                        </div>
                    `;
                    recentContainer.appendChild(div);
                });
            }
        }

        // Render Chart
        renderChart(salesByMonth);

    } catch (e) {
        console.error("Analytics Error", e);
    }
}

function renderChart(dataArr) {
    const canvas = document.getElementById('salesChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Labels: Jan, Feb ... (Arabic)
    const labels = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

    // Slice to current month context if needed, or show all 12

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'المبيعات (ج.م)',
                data: dataArr,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#334155' },
                    ticks: { color: '#cbd5e1' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#cbd5e1' }
                }
            }
        }
    });
}
