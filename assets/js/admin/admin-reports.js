import { db, auth } from '../firebase-config.js';
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

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // verify admin role if needed
        loadReports();
    } else {
        window.location.href = 'login.html';
    }
});

async function loadReports() {
    try {
        console.log("Loading reports...");

        // 1. Fetch ALL used codes (status == 'used' or isUsed == true)
        // This might be heavy for a huge app, but fine for MVP.
        const q = query(collection(db, "access_codes"), where("status", "==", "used"));
        const snap = await getDocs(q);

        if (snap.empty) {
            console.log("No sales data found.");
            document.getElementById('top-teachers-body').innerHTML = '<tr><td colspan="3" class="text-center">لا توجد مبيعات حتى الآن</td></tr>';
            document.getElementById('top-courses-body').innerHTML = '<tr><td colspan="3" class="text-center">لا توجد مبيعات حتى الآن</td></tr>';
            return;
        }

        const codes = [];
        snap.forEach(d => codes.push(d.data()));

        console.log(`Analyzing ${codes.length} sales records...`);

        // --- Process Data ---

        let totalRevenue = 0;
        let monthlyRevenue = 0;
        const currentMonth = new Date().getMonth();
        const activeStudents = new Set();

        // Groupings
        const salesByDate = {}; // 'YYYY-MM-DD': revenue
        const salesByTeacher = {}; // 'uid': {name, revenue, count}
        const salesByCourse = {}; // 'name': count
        const salesByType = { 'training': 0, 'unit': 0, 'lecture': 0, 'other': 0 };

        for (const c of codes) {
            const price = Number(c.price) || 0;
            const date = c.usedAt ? new Date(c.usedAt.seconds * 1000) : new Date();
            const dateStr = date.toISOString().split('T')[0];

            // 1. Revenue
            totalRevenue += price;
            if (date.getMonth() === currentMonth) monthlyRevenue += price;

            // 2. Active Users
            if (c.usedBy) activeStudents.add(c.usedBy);

            // 3. Sales By Date (Timeline)
            if (!salesByDate[dateStr]) salesByDate[dateStr] = 0;
            salesByDate[dateStr] += price;

            // 4. Sales By Teacher
            const tId = c.teacherId || 'unknown';
            if (!salesByTeacher[tId]) salesByTeacher[tId] = { id: tId, revenue: 0, count: 0 };
            salesByTeacher[tId].revenue += price;
            salesByTeacher[tId].count += 1;

            // 5. Sales By Course/Content
            const cName = c.targetName || 'Unknown Content';
            if (!salesByCourse[cName]) salesByCourse[cName] = { name: cName, teacherId: tId, count: 0 };
            salesByCourse[cName].count += 1;

            // 6. Type
            const type = c.type || 'other';
            if (salesByType[type] !== undefined) salesByType[type]++;
            else salesByType['other']++;
        }

        // --- Update UI Counters ---
        animateValue("total-lifetime-revenue", 0, totalRevenue, 1000, " EGP");
        animateValue("total-month-revenue", 0, monthlyRevenue, 1000, " EGP");
        document.getElementById("active-students-count").innerText = activeStudents.size;

        // --- Render Charts ---
        renderRevenueChart(salesByDate);
        renderTypeChart(salesByType);

        // --- Render Tables ---
        await renderTopTeachers(salesByTeacher);
        renderTopCourses(salesByCourse);

    } catch (e) {
        console.error("Error loading reports", e);
    }
}

// Chart 1: Line Chart
function renderRevenueChart(dataObj) {
    const ctx = document.getElementById('revenueChart').getContext('2d');

    // Sort dates
    const sortedDates = Object.keys(dataObj).sort();
    const values = sortedDates.map(d => dataObj[d]);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [{
                label: 'الإيرادات (EGP)',
                data: values,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });
}

// Chart 2: Doughnut
function renderTypeChart(typeObj) {
    const ctx = document.getElementById('salesTypeChart').getContext('2d');

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['دورات', 'كورسات', 'محاضرات', 'أخرى'],
            datasets: [{
                data: [typeObj['training'], typeObj['unit'], typeObj['lecture'], typeObj['other']],
                backgroundColor: ['#f59e0b', '#3b82f6', '#ec4899', '#94a3b8'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#cbd5e1' } }
            }
        }
    });
}

// Table 1: Top Teachers (Needs Name Fetching)
async function renderTopTeachers(teacherObj) {
    const tbody = document.getElementById('top-teachers-body');
    const list = Object.values(teacherObj).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">لا توجد بيانات</td></tr>';
        return;
    }

    tbody.innerHTML = '';

    for (const t of list) {
        let name = "Unknown Teacher";
        if (t.id !== 'unknown') {
            // Try to fetch name (could be cached or optimized)
            try {
                const docSnap = await getDoc(doc(db, "teachers", t.id));
                if (docSnap.exists()) name = docSnap.data().name;
            } catch (e) { }
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div style="font-weight:bold; color:white;">${name}</div>
                <div style="font-size:0.8rem; color:#64748b;">ID: ${t.id.substr(0, 5)}</div>
            </td>
            <td>${t.count} كود</td>
            <td style="color:#10b981; font-weight:bold;">${t.revenue.toLocaleString()} EGP</td>
        `;
        tbody.appendChild(tr);
    }
}

// Table 2: Top Courses
function renderTopCourses(courseObj) {
    const tbody = document.getElementById('top-courses-body');
    const list = Object.values(courseObj).sort((a, b) => b.count - a.count).slice(0, 5);

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">لا توجد بيانات</td></tr>';
        return;
    }

    tbody.innerHTML = '';

    list.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color:white;">${c.name}</td>
            <td style="color:#94a3b8;">${c.teacherId.substr(0, 5)}...</td>
            <td><span class="badge" style="background:rgba(59, 130, 246, 0.1); color:#3b82f6;">${c.count} مرة</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// Utility: Counter Animation
function animateValue(id, start, end, duration, suffix = "") {
    if (start === end) return;
    const range = end - start;
    let current = start;
    const increment = end > start ? Math.ceil(range / (duration / 20)) : 1;
    const stepTime = Math.abs(Math.floor(duration / range));

    const obj = document.getElementById(id);
    if (!obj) return;

    const timer = setInterval(() => {
        current += increment;
        if (current >= end) {
            current = end;
            clearInterval(timer);
        }
        obj.innerHTML = current.toLocaleString() + suffix;
    }, 20); // 50fps

    // Fallback to instantly show if number is large
    setTimeout(() => {
        obj.innerHTML = end.toLocaleString() + suffix;
        clearInterval(timer);
    }, duration + 100);
}
