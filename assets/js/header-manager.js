import { auth, db } from './firebase-config.js';
import './check-maintenance.js'; // Global Maintenance Check
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initSupportWidget } from './support-widget.js';
// UIManager assumed global

// Sound Logic
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playNotificationSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    // Start at 400Hz, ramp to 600Hz, then back to 400Hz for a "siren" like long effect
    oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
    oscillator.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.5);
    oscillator.frequency.linearRampToValueAtTime(400, audioCtx.currentTime + 1.0);
    oscillator.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 1.5);

    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 1.3);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 1.6);
}

document.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
}, { once: true });


export async function initHeader(user) {
    if (!user) return;

    initSupportWidget();

    // 1. Setup Dropdown Toggles
    setupDropdowns();

    // 2. Load User Profile Data into Header
    await loadHeaderProfile(user.uid);

    // 3. Load Notifications (Real-time)
    loadNotifications(user.uid);

    // 4. Update Site Link for Student View
    updateSiteLink(user.uid);

    // 5. Setup Mark All Read
    setupMarkAllRead(user.uid);
}

function setupDropdowns() {
    const trigger = document.getElementById('profile-widget-trigger');
    const menu = document.getElementById('profile-dropdown-menu');
    const notifTrigger = document.getElementById('notif-bell-trigger');
    const notifMenu = document.getElementById('notif-dropdown');
    const logoutBtn = document.getElementById('logout-link-dropdown');
    const openSidebarBtn = document.getElementById('open-sidebar');
    const sidebar = document.getElementById('sidebar');

    function closeAll() {
        if (menu) menu.style.display = 'none';
        if (notifMenu) notifMenu.style.display = 'none';
    }

    if (trigger && menu) {
        trigger.onclick = (e) => {
            e.stopPropagation();
            const v = menu.style.display === 'block';
            closeAll();
            if (!v) menu.style.display = 'block';
        }
    }

    if (notifTrigger && notifMenu) {
        notifTrigger.onclick = (e) => {
            e.stopPropagation();
            const v = notifMenu.style.display === 'block';
            closeAll();
            if (!v) notifMenu.style.display = 'block';
        }
    }

    document.onclick = () => closeAll();

    if (logoutBtn) {
        logoutBtn.onclick = () => auth.signOut();
    }

    if (openSidebarBtn && sidebar) {
        openSidebarBtn.onclick = (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('active');
        }
    }
}

let profileUnsub = null;

async function loadHeaderProfile(uid) {
    if (profileUnsub) profileUnsub();

    try {
        const docRef = doc(db, "teachers", uid);

        profileUnsub = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                const nameEl = document.getElementById('user-name');
                const avatarChar = document.getElementById('user-avatar-char');
                const platformName = document.getElementById('platform-name');
                const dropName = document.getElementById('dropdown-name');
                const dropCode = document.getElementById('dropdown-code');

                if (nameEl) nameEl.innerText = data.name || "المعلم";
                if (platformName) platformName.innerText = data.platformName || "منصتي";
                if (dropName) dropName.innerText = data.name || "المعلم";
                if (dropCode) dropCode.innerText = data.code || uid.substring(0, 6);

                // Update Site Link
                const siteLink = document.getElementById('site-link');
                if (siteLink) {
                    const isTrial = data.planTier === 'trial' || data.subscriptionPlan === 'free_trial';

                    if (isTrial) {
                        siteLink.href = 'javascript:void(0)';
                        siteLink.style.opacity = '0.5';
                        siteLink.style.cursor = 'not-allowed';
                        siteLink.title = "يجب الاشتراك لتفعيل موقعك العام";
                        siteLink.onclick = async (e) => {
                            e.preventDefault();
                            const go = await UIManager.showConfirm(
                                "تنبيه: عضوية تجريبية ⚠️",
                                "عضويتك ما زالت في الفترة التجريبية.\nلا يمكنك نشر أو زيارة موقعك العام إلا بعد الدفع والاشتراك.\n\nهل تريد الذهاب لصفحة الاشتراكات الآن؟",
                                "نعم، اشترك الآن",
                                "لاحقاً"
                            );
                            if (go) window.location.href = 'subscriptions.html';
                        };
                    } else {
                        // Custom Domain Logic
                        let href = `../student-app/index.html?t=${uid}`;

                        if (data.customDomain && data.domainStatus === 'active') {
                            let domain = data.customDomain;
                            if (!domain.startsWith('http')) domain = 'https://' + domain;
                            href = domain;
                        } else if (data.slug) {
                            href = `../student-app/index.html#/${data.slug}`;
                        }

                        siteLink.href = href;
                        siteLink.style.opacity = '1';
                        siteLink.style.cursor = 'pointer';
                        siteLink.onclick = null;
                        siteLink.target = '_blank';
                        siteLink.title = "عرض موقعك العام";
                    }
                }

                if (data.profileImage) {
                    const avatars = document.querySelectorAll('.avatar, .profile-avatar');
                    avatars.forEach(av => {
                        if (av.id === 'user-avatar-char') {
                            av.parentElement.innerHTML = `<img src="${data.profileImage}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                        } else if (av.classList.contains('avatar')) {
                            av.innerHTML = `<img src="${data.profileImage}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                            av.style.background = 'transparent';
                            av.style.boxShadow = 'none';
                        }
                    });
                } else {
                    if (avatarChar) avatarChar.innerText = (data.name || 'T').charAt(0).toUpperCase();
                }
            }
        }, (error) => {
            console.error("Header Real-time Error:", error);
        });

    } catch (e) {
        console.error("Header Profile Error", e);
    }
}

let notifUnsub = null;
async function loadNotifications(uid) {
    const list = document.querySelector('.notif-list');
    const badge = document.querySelector('.badge-count');
    if (!list) return;

    if (notifUnsub) notifUnsub();

    try {
        const q = query(
            collection(db, "notifications"),
            where("target", "in", ["all", "all_teachers", uid]),
            orderBy("createdAt", "desc"),
            limit(15)
        );

        notifUnsub = onSnapshot(q, (snap) => {
            list.innerHTML = '';
            let count = 0;

            // Check new arrivals for sound
            snap.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const data = change.doc.data();
                    const notifTime = data.createdAt ? data.createdAt.toDate() : new Date();
                    const now = new Date();
                    // Play sound if recent (<10s)
                    if ((now - notifTime) < 10000) {
                        playNotificationSound();
                    }
                }
            });

            if (snap.empty) {
                list.innerHTML = '<div style="padding:15px; text-align:center; color:#64748b;">لا توجد إشعارات جديدة</div>';
            } else {
                snap.forEach(doc => {
                    const n = doc.data();
                    if (n.read === false) count++;

                    const time = n.createdAt ? new Date(n.createdAt.seconds * 1000).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '';

                    // Determine Icon
                    let iconClass = 'fa-bell';
                    let extraIconClass = '';
                    if (n.sender === 'admin') {
                        iconClass = 'fa-crown';
                        extraIconClass = 'admin-icon';
                    } else if (n.title && n.title.includes('اشتراك')) {
                        iconClass = 'fa-receipt';
                        extraIconClass = 'admin-icon';
                    }

                    list.innerHTML += `
                    <div class="notif-item ${n.read ? '' : 'unread'}" onclick="window.location.href='notifications.html'">
                        <div class="notif-icon-box ${extraIconClass}">
                            <i class="fas ${iconClass}"></i>
                        </div>
                        <div class="notif-content">
                            <div class="notif-header-row">
                                <span class="notif-title">${n.title || 'إشعار'}</span>
                                <span class="notif-time">${time}</span>
                            </div>
                            <p class="notif-body">${n.body || ''}</p>
                        </div>
                    </div>
                    `;
                });

                // Badge Logic
                if (badge) {
                    if (count > 0) {
                        badge.innerText = count;
                        badge.style.display = 'block';
                    } else {
                        badge.style.display = 'none';
                    }
                }
            }
        });

    } catch (e) {
        console.log("Notifs load error:", e);
    }
}

// Add writeBatch to imports
// import statement moved to top


function setupMarkAllRead(uid) {
    setTimeout(() => {
        const dropdownHeader = document.querySelector('#notif-dropdown > div:first-child');

        if (!dropdownHeader) {
            // Silent return if header not found (e.g. slight layout diff)
            return;
        }

        // Check if button already exists
        let btn = dropdownHeader.querySelector('.mark-all-read-btn');

        // Note: The previous selector matches the TITLE span if the button doesn't exist, causing safety check issues.
        // We will create the button if it doesn't exist.

        if (!btn) {
            // Check if there is already a second span (maybe hardcoded without class)
            const spans = dropdownHeader.querySelectorAll('span');
            if (spans.length > 1 && spans[1].innerText.includes('تحديد')) {
                btn = spans[1];
            } else {
                // Create it
                btn = document.createElement('span');
                btn.className = 'mark-all-read-btn';
                btn.innerText = 'تحديد الكل كمقروء';
                btn.style.fontSize = '0.75rem';
                btn.style.color = '#3b82f6';
                btn.style.cursor = 'pointer';
                dropdownHeader.appendChild(btn);
            }
        }

        if (btn) {
            btn.onclick = async (e) => {
                e.stopPropagation();
                if (btn.style.opacity === '0.5') return;

                const badge = document.querySelector('.badge-count');
                if (badge) badge.style.display = 'none';

                try {
                    btn.innerText = 'جاري...';
                    btn.style.opacity = '0.5';

                    const q = query(
                        collection(db, "notifications"),
                        where("target", "in", ["all", "all_teachers", uid]),
                        where("read", "==", false)
                    );
                    const snap = await getDocs(q);

                    const batch = writeBatch(db);
                    let count = 0;
                    snap.forEach(doc => {
                        batch.update(doc.ref, { read: true });
                        count++;
                    });

                    if (count > 0) {
                        await batch.commit();
                        btn.innerText = 'تحديد الكل كمقروء'; // Reset text
                        // List will auto-update via onSnapshot
                    } else {
                        btn.innerText = 'تحديد الكل كمقروء';
                    }

                    btn.style.opacity = '1';

                } catch (err) {
                    console.error("Mark read failed", err);
                    btn.innerText = 'فشل';
                    btn.style.opacity = '1';
                    if (badge) badge.style.display = 'block';
                }
            };
        }
    }, 1000);
}

function updateSiteLink(uid) {
    const link = document.getElementById('site-link');
    if (link) {
        link.href = `../student-app/index.html?t=${uid}`;
    }
}

