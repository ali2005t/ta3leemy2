import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import './global-ui.js'; // Ensure global UI (Theme & Branding) is loaded
import './check-maintenance.js'; // Global Maintenance Check

const TEACHER_SIDEBAR = [
    // Group: Dashboard (Standalone)
    {
        type: 'item',
        page: 'dashboard.html',
        icon: 'fa-home',
        label: 'الرئيسية'
    },

    // Group: Analytics (Combined)
    {
        type: 'group',
        id: 'analytics-group',
        label: 'التحليلات والتقارير',
        icon: 'fa-chart-pie',
        children: [
            { page: 'analytics.html', icon: 'fa-chart-line', label: 'التحليلات العامة' },
            { page: 'financial-reports.html', icon: 'fa-coins', label: 'التقارير المالية' }
        ]
    },

    // Group: Courses
    {
        type: 'group',
        id: 'courses-group',
        label: 'الدورات والمحتوى',
        icon: 'fa-layer-group',
        children: [
            { page: 'trainings.html', icon: 'fa-chalkboard', label: 'الدورات التدريبية' },
            { page: 'lectures.html', icon: 'fa-video', label: 'المحاضرات' }
        ]
    },

    // Group: Students
    {
        type: 'group',
        id: 'students-group',
        label: 'الطلاب والأكواد',
        icon: 'fa-users',
        children: [
            { page: 'students.html', icon: 'fa-user-graduate', label: 'سجل الطلاب' },
            { page: 'generate-codes.html', icon: 'fa-barcode', label: 'إنشاء الأكواد' },
            { page: 'manual-access.html', icon: 'fa-lock-open', label: 'فتح المحتوى يدوياً' }
        ]
    },

    // Group: Team & Users
    {
        type: 'group',
        id: 'users-group',
        label: 'المستخدمين والمساعدين',
        icon: 'fa-user-shield',
        children: [
            { page: 'users.html', icon: 'fa-users-cog', label: 'إدارة الموظفين' },
            { page: 'add-user.html', icon: 'fa-user-plus', label: 'إضافة موظف' }
        ]
    },

    // Group: Exams
    {
        type: 'group',
        id: 'exams-group',
        label: 'الامتحانات والنتائج',
        icon: 'fa-clipboard-check',
        children: [
            { page: 'exams.html', icon: 'fa-file-alt', label: 'بنك الامتحانات' },
            { page: 'exam-results.html', icon: 'fa-poll', label: 'النتائج والتصحيح' }
        ]
    },

    // Group: Accounts
    {
        type: 'group',
        id: 'accounts-group',
        label: 'الحسابات والفواتير',
        icon: 'fa-wallet',
        children: [
            { page: 'permissions.html', icon: 'fa-file-invoice-dollar', label: 'الأذونات' },
            { page: 'invoices.html', icon: 'fa-file-invoice', label: 'الفواتير' },
            { page: 'subscriptions.html', icon: 'fa-box-open', label: 'إدارة الاشتراك' }
        ]
    },

    // Group: Apps & Settings
    {
        type: 'group',
        id: 'settings-group',
        label: 'الإعدادات والتطبيق',
        icon: 'fa-cogs',
        children: [
            { page: 'app-settings.html', icon: 'fa-mobile-alt', label: 'تجهيز التطبيق' },
            { page: 'settings.html', icon: 'fa-sliders-h', label: 'إعدادات المنصة' },
            { page: 'notifications.html', icon: 'fa-bell', label: 'الإشعارات' },
            { page: 'profile.html', icon: 'fa-user-circle', label: 'الملف الشخصي' }
        ]
    },

    // Group: Support
    {
        type: 'group',
        id: 'support-group',
        label: 'الدعم الفني',
        icon: 'fa-headset',
        children: [
            { page: 'support.html', icon: 'fa-user-shield', label: 'دعم المنصة' },
            { page: 'support-students.html', icon: 'fa-users', label: 'دعم الطلاب' }
        ]
    }
];

function generateSidebarHTML(platformName = 'Ta3leemy') {
    let html = `
    <div class="sidebar-header" style="text-align:center; padding:20px 0;">
        <a href="#" class="logo" style="font-size:1.5rem; font-weight:bold; color:white; text-decoration:none;">${platformName}</a>
    </div>
    <div class="sidebar-menu">
    `;

    // Flatten logic for active state detection could go here, but I'll do it in post-process
    TEACHER_SIDEBAR.forEach(item => {
        if (item.type === 'group') {
            html += `
            <div class="menu-group-header" onclick="toggleSidebarGroup('${item.id}')">
                <div style="display:flex; align-items:center; gap:10px;">
                    <i class="fas ${item.icon}" style="width:20px; text-align:center;"></i> ${item.label}
                </div>
                <i class="fas fa-chevron-down group-arrow" id="arrow-${item.id}" style="font-size:0.8rem; transition:transform 0.3s;"></i>
            </div>
            <div class="menu-group-content" id="${item.id}" style="background:rgba(0,0,0,0.2); display:none; overflow:hidden;">
            `;

            item.children.forEach(child => {
                html += `
                <div class="menu-item" data-page="${child.page}" onclick="window.location.href='${child.page}'" style="padding-right:45px; font-size:0.9rem;">
                   <i class="fas ${child.icon}" style="margin-left:8px; width:15px;"></i> ${child.label}
                </div>`;
            });

            html += `</div>`;
        } else {
            html += `<div class="menu-item" data-page="${item.page}" onclick="window.location.href='${item.page}'"><i class="fas ${item.icon}"></i> ${item.label}</div>`;
        }
    });

    html += `
    </div>
    <div class="sidebar-footer" style="padding:15px; border-top:1px solid rgba(255,255,255,0.05); margin-top:auto;">
                  
                </div>`;

    return html;
}

// Global Toggle
window.toggleSidebarGroup = (id) => {
    const content = document.getElementById(id);
    const arrow = document.getElementById(`arrow - ${id} `);
    if (content.style.display === 'none') {
        content.style.display = 'block';
        if (arrow) arrow.style.transform = 'rotate(180deg)';
        sessionStorage.setItem(`teacher_group_${id} _open`, 'true');
    } else {
        content.style.display = 'none';
        if (arrow) arrow.style.transform = 'rotate(0deg)';
        sessionStorage.removeItem(`teacher_group_${id} _open`);
    }
};

export async function initTeacherUI() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    // 1. Fetch Platform Name (Optional UX enhancement)
    // We can rely on what's in dashboard.js or fetch basic user data here. 
    // For speed, we will generate structure then update title if needed.

    // Inject HTML
    sidebar.innerHTML = generateSidebarHTML(document.title.split('-')[0].trim());

    // 2. Set Active State
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    const activeItem = sidebar.querySelector(`.menu-item[data-page="${currentPage}"]`);

    if (activeItem) {
        activeItem.classList.add('active');
        // Open Parent Group
        const parentGroup = activeItem.closest('.menu-group-content');
        if (parentGroup) {
            parentGroup.style.display = 'block';
            const arrow = document.getElementById(`arrow - ${parentGroup.id} `);
            if (arrow) arrow.style.transform = 'rotate(180deg)';
        }
    }

    // Restore Saved Groups
    document.querySelectorAll('.menu-group-content').forEach(grp => {
        if (sessionStorage.getItem(`teacher_group_${grp.id} _open`) === 'true') {
            grp.style.display = 'block';
            const arrow = document.getElementById(`arrow - ${grp.id} `);
            if (arrow) arrow.style.transform = 'rotate(180deg)';
        }
    });

    // 3. Bind Logout
    const logoutBtn = document.getElementById('teacher-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            signOut(auth).then(() => window.location.href = '../auth/login.html');
        });
    }

    // 4. Mobile Toggle
    const toggle = document.getElementById('open-sidebar'); // Check header ID
    if (toggle) {
        toggle.onclick = (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('active');
        };
        document.addEventListener('click', (e) => {
            if (window.innerWidth < 1024 && sidebar.classList.contains('active') && !sidebar.contains(e.target) && e.target !== toggle) {
                sidebar.classList.remove('active');
            }
        });
    }
}
