import { auth, db } from '../firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, onSnapshot, orderBy, limit, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const SIDEBAR_STRUCTURE = [
    { type: 'item', page: 'dashboard.html', icon: 'fa-home', label: 'الرئيسية' },
    { type: 'item', page: 'teachers.html', icon: 'fa-chalkboard-teacher', label: 'المعلمون' },
    { type: 'item', page: 'students.html', icon: 'fa-user-graduate', label: 'الطلاب' },
    { type: 'item', page: 'courses.html', icon: 'fa-book', label: 'الكورسات' },
    { type: 'item', page: 'packages.html', icon: 'fa-box-open', label: 'الباقات' },
    { type: 'item', page: 'subscriptions.html', icon: 'fa-file-invoice-dollar', label: 'الاشتراكات' },

    // Security Group
    {
        type: 'group',
        id: 'security-group',
        label: 'أمان المنصة',
        icon: 'fa-shield-alt',
        children: [
            { page: 'domains.html', icon: 'fa-globe', label: 'الدومينات' },
            { page: 'manage-admins.html', icon: 'fa-users-cog', label: 'المساعدين والأدوار' },
            { page: 'security.html', icon: 'fa-lock', label: 'إعدادات الأمان' }
        ]
    },

    // Finance & Reports Group
    {
        type: 'group',
        id: 'finance-group',
        label: 'المالية والتقارير',
        icon: 'fa-chart-pie',
        children: [
            { page: 'financials.html', icon: 'fa-dollar-sign', label: 'المالية' },
            { page: 'reports.html', icon: 'fa-chart-line', label: 'التقارير' }
        ]
    },

    // Marketing & Content Group
    {
        type: 'group',
        id: 'marketing-group',
        label: 'التسويق والمحتوى',
        icon: 'fa-bullhorn',
        children: [
            { page: 'referral-settings.html', icon: 'fa-users-cog', label: 'إعدادات الإحالة' },
            { page: 'banners.html', icon: 'fa-images', label: 'البانرات الإعلانية' },
            { page: 'faq-manager.html', icon: 'fa-question-circle', label: 'الأسئلة الشائعة' }
        ]
    },

    { type: 'item', page: 'notifications.html', icon: 'fa-bell', label: 'الإشعارات', hasBadge: true },
    { type: 'item', page: 'support.html', icon: 'fa-headset', label: 'الدعم الفني' },

    // System Settings Group
    {
        type: 'group',
        id: 'settings-group',
        label: 'النظام والتطبيقات',
        icon: 'fa-cogs',
        children: [
            { page: 'app-requests.html', icon: 'fa-mobile-screen', label: 'تجهيز التطبيقات' },
            { page: 'settings.html', icon: 'fa-sliders-h', label: 'إعدادات المنصة' }
        ]
    }
];

function generateSidebarHTML() {
    let html = `
    <div class="sidebar-header" style="display:flex; justify-content:center; padding: 20px 0;">
        <img src="../assets/images/logo.png" alt="Ta3leemy" style="max-height: 50px; max-width: 90%; object-fit:contain;">
    </div>
    <div class="sidebar-menu">
    `;

    SIDEBAR_STRUCTURE.forEach(item => {
        if (item.type === 'item') {
            let badge = item.hasBadge ? `<span class="sidebar-badge badge-count" style="background:#ef4444; color:white; font-size:0.7rem; padding:2px 6px; border-radius:10px; margin-right:auto; display:none;">0</span>` : '';
            html += `<div class="menu-item" data-page="${item.page}" onclick="window.location.href='${item.page}'"><i class="fas ${item.icon}"></i> ${item.label} ${badge}</div>`;
        }
        else if (item.type === 'group') {
            // Group Header
            html += `
            <div class="menu-group-header" onclick="toggleSidebarGroup('${item.id}')">
                <div style="display:flex; align-items:center; gap:10px;">
                    <i class="fas ${item.icon}" style="width:20px;"></i> ${item.label}
                </div>
                <i class="fas fa-chevron-down group-arrow" id="arrow-${item.id}" style="font-size:0.8rem; transition:transform 0.3s;"></i>
            </div>
            <div class="menu-group-content" id="${item.id}" style="background:rgba(0,0,0,0.2); display:none; overflow:hidden;">
            `;

            // Children
            item.children.forEach(child => {
                html += `<div class="menu-item" data-page="${child.page}" onclick="window.location.href='${child.page}'" style="padding-right:50px; font-size:0.95rem;">
                    <i class="fas ${child.icon}" style="font-size:0.9rem;"></i> ${child.label}
                </div>`;
            });
            html += `</div>`;
        }
    });

    html += `
    </div>
    <div class="sidebar-footer">
        <div class="menu-item" id="global-logout-btn" style="color:#ef4444;"><i class="fas fa-sign-out-alt"></i> خروج</div>
    </div>`;

    return html;
}

// Global Toggle Function
window.toggleSidebarGroup = (id) => {
    const content = document.getElementById(id);
    const arrow = document.getElementById(`arrow-${id}`);
    if (content.style.display === 'none') {
        content.style.display = 'block';
        if (arrow) arrow.style.transform = 'rotate(180deg)';
        // Save state
        sessionStorage.setItem(`group_${id}_open`, 'true');
    } else {
        content.style.display = 'none';
        if (arrow) arrow.style.transform = 'rotate(0deg)';
        sessionStorage.removeItem(`group_${id}_open`);
    }
};

const SIDEBAR_HTML = generateSidebarHTML();

const HEADER_HTML = (title) => `
<div style="display:flex; align-items:center; gap:1rem;">
    <button class="btn-icon mobile-only" id="ui-open-sidebar"><i class="fas fa-bars"></i></button>
    <h3>${title}</h3>
</div>
<div class="top-actions" style="display:flex; align-items:center;">
    <div class="admin-header-bell" onclick="window.location.href='notifications.html'" style="cursor:pointer; margin-left:15px; color:white; font-size:1.2rem; position:relative;">
        <i class="fas fa-bell"></i>
        <span class="header-badge badge-count" style="position:absolute; top:-5px; right:-5px; background:#ef4444; color:white; font-size:0.6rem; padding:2px 5px; border-radius:10px; display:none;">0</span>
    </div>
    <div class="profile-widget">
        <span class="avatar" style="background:#6366f1; width:35px; height:35px; display:flex; align-items:center; justify-content:center; border-radius:50%;">A</span>
    </div>
</div>
`;

export function initAdminUI(pageTitle) {
    // 1. Inject Sidebar
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.innerHTML = SIDEBAR_HTML;
        // Set Active Class
        // Set Active Class & Expand Group
        const currentDataPage = window.location.pathname.split('/').pop() || 'dashboard.html';
        const activeItem = sidebar.querySelector(`.menu-item[data-page="${currentDataPage}"]`);

        if (activeItem) {
            activeItem.classList.add('active');

            // If inside a group, open it
            const parentGroup = activeItem.closest('.menu-group-content');
            if (parentGroup) {
                parentGroup.style.display = 'block';
                const groupId = parentGroup.id;
                const arrow = document.getElementById(`arrow-${groupId}`);
                if (arrow) arrow.style.transform = 'rotate(180deg)';
            }
        }

        // Restore saved groups (Persist open state)
        document.querySelectorAll('.menu-group-content').forEach(grp => {
            if (sessionStorage.getItem(`group_${grp.id}_open`) === 'true') {
                grp.style.display = 'block';
                const arrow = document.getElementById(`arrow-${grp.id}`);
                if (arrow) arrow.style.transform = 'rotate(180deg)';
            }
        });

        // --- PERMISSION CHECK START ---
        const user = auth.currentUser;
        if (user) {
            getDoc(doc(db, "admins", user.uid)).then(snap => {
                if (snap.exists()) {
                    const data = snap.data();
                    const permissions = data.permissions || [];
                    const role = data.role;

                    // Debugging
                    console.log(`[AdminUI] User: ${user.email}, Role: ${role}, Page: ${currentDataPage}`);
                    console.log(`[AdminUI] Permissions:`, permissions);

                    // If Super Admin, allow everything
                    // Also allowing 'admin' if that was used historically
                    if (role === 'super_admin' || role === 'admin' || role === 'owner') return;

                    // If not super admin, check permissions
                    const items = sidebar.querySelectorAll('.menu-item[data-page]');
                    items.forEach(item => {
                        const page = item.dataset.page;
                        // Always allow Dashboard & Notifications & Profile/Settings(maybe?)
                        if (page === 'dashboard.html' || page === 'notifications.html' || page === 'security.html') return;

                        // Check if page allowed
                        // Handle "faq-manager.html" vs "settings.html"
                        if (!permissions.includes(page)) {
                            item.style.display = 'none'; // Hide from Sidebar

                            // Security Redirect if on this page
                            if (currentDataPage === page) {
                                document.body.innerHTML = '<div style="color:white;text-align:center;padding:50px;">⛔ ليس لديك صلاحية لعرض هذه الصفحة</div>';
                                setTimeout(() => window.location.href = 'dashboard.html', 2000);
                            }
                        }
                    });
                }
            });
        }
        // --- PERMISSION CHECK END ---

        // Logout Logic
        document.getElementById('global-logout-btn').onclick = () => {
            signOut(auth).then(() => window.location.href = '../auth/login.html');
        };
    }

    // 2. Inject Header
    const header = document.querySelector('header.top-bar');
    if (header) {
        header.innerHTML = HEADER_HTML(pageTitle || document.title.split('-')[0].trim());

        // Mobile Toggle
        const toggle = document.getElementById('ui-open-sidebar');
        if (toggle && sidebar) {
            toggle.onclick = (e) => {
                e.stopPropagation();
                sidebar.classList.toggle('open');
            };
            document.addEventListener('click', (e) => {
                if (window.innerWidth < 768 && sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== toggle) {
                    sidebar.classList.remove('open');
                }
            });
        }
    }

    // 3. Init Notifications (Sound Debounced)
    initNotifications();
}

// Global Sound Context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound() {
    // Debounce: Check localstorage for last sound time (across tabs)
    const now = Date.now();
    const lastSound = localStorage.getItem('last_notif_sound');
    if (lastSound && (now - Number(lastSound) < 2000)) {
        return; // Skip if played < 2s ago
    }

    // Play
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(500, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.5);

    localStorage.setItem('last_notif_sound', now);
}

document.addEventListener('click', () => { if (audioCtx.state === 'suspended') audioCtx.resume(); }, { once: true });

let unsubNotif = null;
function initNotifications() {
    if (unsubNotif) return; // run once

    const user = auth.currentUser;
    if (!user) return;

    const q = query(
        collection(db, "notifications"),
        where("target", "in", ["admin", user.uid]),
        orderBy("createdAt", "desc"),
        limit(20)
    );

    unsubNotif = onSnapshot(q, (snap) => {
        let unread = 0;
        let newArrival = false;

        snap.docChanges().forEach(c => {
            if (c.type === "added") {
                const data = c.doc.data();
                const notifTime = data.createdAt ? data.createdAt.toDate() : new Date();
                // Check latency < 10s for sound
                if (Date.now() - notifTime.getTime() < 10000 && data.read === false) {
                    newArrival = true;
                }
            }
        });

        if (newArrival) playSound();

        // Count Unread
        unread = snap.docs.filter(d => d.data().read === false).length;
        updateBadges(unread);
    }, err => console.log(err));
}

function updateBadges(count) {
    const badges = document.querySelectorAll('.badge-count');
    badges.forEach(b => {
        if (count > 0) {
            b.innerText = count;
            b.style.display = 'inline-block'; // or block for sidebar? CSS handles it? 
            // Inline override needed because I set display:none in HTML string
            b.style.display = b.classList.contains('sidebar-badge') ? 'inline-block' : 'inline-block';
        } else {
            b.style.display = 'none';
        }
    });
}
