
// student-common.js
import { auth, db } from './firebase-config.js';
import { collection, query, where, orderBy, onSnapshot, limit, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// Shared logic for all student pages (OneSignal, Branding, Theme)

// 1. OneSignal Initialization with Localhost Protection
window.OneSignalDeferred = window.OneSignalDeferred || [];
window.OneSignalDeferred.push(async function (OneSignal) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.warn('OneSignal: Running on Localhost. Notifications disabled to prevent errors.');
        return; // Stop here to prevent "App not configured" error
    }

    // Only init if not already initialized
    if (!OneSignal.initialized) {
        await OneSignal.init({
            appId: "3dd814ae-df51-4396-8aca-0877931b7b5f", // Replace with your App ID
            safari_web_id: "web.onesignal.auto.xxxxx",
            allowLocalhostAsSecureOrigin: true, // Attempt to allow if configured
        });
    }

    // EXPLICIT PERMISSION REQUEST
    console.log("Requesting Permission...");

    // DEBUG: Force Button to check Median Status
    const debugBtn = document.createElement('button');
    debugBtn.innerText = "🔧 إعدادات الإشعارات (اضغط هنا)";
    debugBtn.style.cssText = "position:fixed; bottom:80px; left:20px; z-index:99999; background:red; color:white; padding:10px; border-radius:5px;";
    debugBtn.onclick = function () {
        alert("UA: " + navigator.userAgent);
        if (window.gonative) {
            alert("GoNative JS Found! Registering...");
            if (window.gonative.onesignal) window.gonative.onesignal.register();
            else window.location.href = 'gonative://onesignal/register';
        } else {
            alert("Not Native App? Trying Protocol...");
            window.location.href = 'gonative://onesignal/register';
        }
    };
    document.body.appendChild(debugBtn);

    // 1. Median/GoNative Usage
    // 1. Median/GoNative Usage
    if (navigator.userAgent.indexOf('gonative') > -1 || window.gonative) {
        console.log("Median App Detected: Triggering Native Registration");
        if (window.gonative && window.gonative.onesignal) {
            window.gonative.onesignal.register();
        } else {
            window.location.href = 'gonative://onesignal/register';
        }
    }
    // 2. Standard Browser Usage
    // Modern SDK
    OneSignal.Notifications.requestPermission();

    // Show Banner if not granted
    if (OneSignal.Notifications.permission !== "granted") {
        showNotificationBanner(OneSignal);
    }
}); // Close push function cleanly

function showNotificationBanner(OneSignal) {
    const banner = document.createElement('div');
    banner.style.cssText = "position:fixed; bottom:0; left:0; width:100%; background:#6366f1; color:white; padding:15px; text-align:center; z-index:99999; box-shadow:0 -2px 10px rgba(0,0,0,0.2); display:flex; justify-content:center; align-items:center; gap:10px;";
    banner.innerHTML = `
        <span>🔔 لكي تصلك محاضراتك، يجب تفعيل الإشعارات.</span>
        <button id="enable-notif-btn" style="background:white; color:#6366f1; border:none; padding:5px 15px; border-radius:5px; font-weight:bold; cursor:pointer;">تفعيل الآن</button>
    `;
    document.body.appendChild(banner);

    document.getElementById('enable-notif-btn').addEventListener('click', async () => {
        await OneSignal.Notifications.requestPermission();
        if (OneSignal.Notifications.permission === "granted") {
            banner.remove();
            alert("تم التفعيل بنجاح! شكراً لك.");
        }
    });
}

// 2. Apply Branding from Session Storage
// This ensures sub-pages (Profile, Courses) still look like the Teacher's App
// 2. Apply Visual Branding (Colors/Title)
function applyBranding() {
    try {
        // Color Branding
        const cachedColor = sessionStorage.getItem('platformColor');
        if (cachedColor) {
            document.documentElement.style.setProperty('--app-primary', cachedColor);
        }

        const platformName = sessionStorage.getItem('platformName');
        if (platformName) {
            // Update Title if not already set
            if (!document.title.includes(platformName)) {
                document.title = platformName + ' - ' + document.title;
            }

            // If page has a generic header title, update it
            const headerTitle = document.getElementById('header-platform-title');
            if (headerTitle) {
                headerTitle.innerText = platformName;
            }
        }

    } catch (e) {
        console.error("Branding Error", e);
    }
}

// 3. Desktop Menu Toggle Logic
function initDesktopMenu() {
    // Check if we are on desktop (simple check, or just run it and let CSS hide it)
    if (!document.getElementById('desktop-menu-btn')) {

        // Create Toggle Button
        const btn = document.createElement('button');
        btn.id = 'desktop-menu-btn';
        btn.innerHTML = '<i class="fas fa-bars"></i>';
        btn.style.display = 'none'; // CSS will show it on desktop
        // Note: Styles are in student-desktop.css

        // Create Overlay
        const overlay = document.createElement('div');
        overlay.id = 'sidebar-overlay';
        // Ensure z-index is correct via JS or rely on CSS
        // The CSS handles z-index: 1900.


        document.body.appendChild(btn);
        document.body.appendChild(overlay);

        // Event Listeners
        const nav = document.querySelector('.bottom-nav');

        function toggleMenu() {
            if (!nav) return;
            nav.classList.toggle('sidebar-open');
            overlay.classList.toggle('active');

            // Icon Toggle
            const isOpen = nav.classList.contains('sidebar-open');
            btn.innerHTML = isOpen ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
        }

        btn.addEventListener('click', toggleMenu);
        overlay.addEventListener('click', toggleMenu);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // --- GLOBAL URL CAPTURE (t can be in search OR inside hash) ---
    const searchParams = new URLSearchParams(window.location.search);
    let tid = searchParams.get('t');

    // Support if token is accidentally inside hash (backup)
    if (!tid && window.location.hash.includes('?')) {
        const hashQuery = window.location.hash.split('?')[1];
        const hashParams = new URLSearchParams(hashQuery);
        tid = hashParams.get('t');
    }

    if (tid) {
        sessionStorage.setItem('currentTeacherId', tid);

        // Clean URL (remove t from visible URL)
        // Keep hash route if exists but remove ?t=...
        let cleanHash = window.location.hash;
        if (cleanHash.includes('?')) cleanHash = cleanHash.split('?')[0];

        const newUrl =
            window.location.protocol +
            "//" +
            window.location.host +
            window.location.pathname +
            cleanHash;

        window.history.replaceState({ path: newUrl }, '', newUrl);
    }
    // -----------------------------------------------------------

    applyBranding();
    initDesktopMenu();

    // --- AUTO-RESTORE SESSION (Median Fix) ---
    // If Auth state is taking too long or null, check local storage for credentials
    // This fixes the "Logged out on App Restart" issue.
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("Auth State: Logged In", user.uid);
            initStudentNotifications(user.uid);
            injectDesktopHeader(user); // Inject Header
        } else {
            console.log("Auth State: Null. checking backup...");
            const storedAuth = localStorage.getItem('median_auth_data');
            if (storedAuth) {
                try {
                    const creds = JSON.parse(storedAuth);
                    if (creds.email && creds.secret) {
                        console.log("Attempting Silent Re-Login...");
                        // Import SignIn dynamically or use global if available.
                        // Since 'auth' is imported, we need signInWithEmailAndPassword
                        const { signInWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");

                        await signInWithEmailAndPassword(auth, creds.email, atob(creds.secret));
                        console.log("Silent Re-Login Successful!");
                        // onAuthStateChanged will trigger again with 'user'
                    }
                } catch (e) {
                    console.error("Silent Re-Login Failed", e);
                }
            } else {
                console.log("No backup credentials found.");
                // Optionally redirect to login?
                // window.location.href = '../auth/login.html'; 
                // But this file is common, might be used on public pages? 
                // If it's the student app index, it has its own redirect checks?
                // Actually student-home.js doesn't check auth.
                // So we SHOULD probably redirect if this is a protected page.
                // But let's be safe and let the page logic handle it specifically if it wants data.
            }
        }
    });
});

let unsubNotif = null;
function initStudentNotifications(uid) {
    if (unsubNotif) unsubNotif();

    // Listen for: Specific User OR All Students OR All Users
    const q = query(
        collection(db, "notifications"),
        where("target", "in", [uid, "all_students", "all"]),
        orderBy("createdAt", "desc"),
        limit(10)
    );

    unsubNotif = onSnapshot(q, (snapshot) => {
        // Just log for now, or show a toast?
        // Ideally we should have a bell icon in student app too.
        // For now, let's just make sure we capture them.
        // We can show a simple "Toast" for new ones.

        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const data = change.doc.data();
                // Check if recent (< 10s) to avoid showing old on load
                const notifTime = data.createdAt ? data.createdAt.toDate() : new Date();
                if (Date.now() - notifTime.getTime() < 10000) {
                    showToast(data.title, data.body);
                }
            }
        });
    });
}

function showToast(title, body) {
    const div = document.createElement('div');
    div.style.cssText = `
        position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
        background: #1e293b; color: white; padding: 12px 20px; borderRadius: 8px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.2); z-index: 1000; display: flex; flex-direction: column;
        min-width: 300px; animation: slideUpToast 0.3s ease;
    `;
    div.innerHTML = `<strong style="font-size:0.9rem; margin-bottom:4px; color:#60a5fa;">${title}</strong><span style="font-size:0.8rem;">${body}</span>`;

    document.body.appendChild(div);

    // Slide Up Animation
    const style = document.createElement('style');
    style.textContent = `@keyframes slideUpToast { from { transform: translate(-50%, 20px); opacity:0; } to { transform: translate(-50%, 0); opacity:1; } }`;
    document.head.appendChild(style);

    setTimeout(() => {
        div.style.opacity = '0';
        div.style.transition = 'opacity 0.5s';
        setTimeout(() => div.remove(), 500);
    }, 4000);
}

async function injectDesktopHeader(user) {
    // Only for Desktop (we can check simple width first or let CSS handle display)
    // We let CSS handle display:none on mobile, so we just inject it.

    // Exclude injection on Home Page (User Request)
    const currentPath = window.location.pathname;
    // Check for home.html or root path if applicable
    // Check for home.html or root path if applicable
    if (currentPath.includes('home.html') || currentPath.includes('index.html') || currentPath.includes('login.html') || currentPath.includes('register.html') || currentPath.endsWith('/')) {
        // Reset body padding for Home Page (No fixed header)
        document.body.style.paddingTop = '0px';
        return;
    }


    if (document.getElementById('student-desktop-header')) return;

    const header = document.createElement('header');
    header.id = 'student-desktop-header';
    header.className = 'desktop-header'; // Styles in student-desktop.css
    // hidden by default in CSS if not desktop media query

    let displayName = user.displayName;
    const photoURL = user.photoURL || null;

    // If displayName is missing, try to fetch from Firestore 'students'
    if (!displayName) {
        try {
            const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            const userDoc = await getDoc(doc(db, "students", user.uid));
            if (userDoc.exists()) {
                displayName = userDoc.data().name;
            }
        } catch (e) {
            console.error("Error fetching student name:", e);
        }
    }

    // Fallback if still missing
    if (!displayName) displayName = 'طالب مجتهد';

    // HTML Structure
    const backBtnHtml = `
        <button onclick="window.history.back()" class="desktop-back-btn" title="رجوع">
            <i class="fas fa-arrow-right"></i>
        </button>
    `;

    header.innerHTML = `
        <div style="display:flex; align-items:center; gap:15px;">
             ${backBtnHtml}
             <div class="user-info">
                <div class="user-avatar" onclick="window.location.href='profile.html'">
                    ${photoURL ? `<img src="${photoURL}">` : '<i class="fas fa-user"></i>'}
                </div>
                <div style="display:flex; flex-direction:column;">
                     <span style="font-size:0.8rem; color:#64748b;">مرحباً بك</span>
                     <span class="user-name">${displayName}</span>
                </div>
            </div>
        </div>

        <div class="header-actions">
             <button class="theme-toggle" onclick="toggleDarkMode()" title="تبديل الوضع الليلي">
                <i class="fas fa-moon"></i>
             </button>
             <button class="logout-btn" onclick="logoutUser()">
                 <i class="fas fa-sign-out-alt"></i>
                 <span>تسجيل خروج</span>
             </button>
        </div>
        
        <style>
            .desktop-back-btn {
                width: 40px; 
                height: 40px; 
                border-radius: 50%; 
                border: 1px solid #e2e8f0; 
                background: white; 
                color: #1e293b;
                display: flex; 
                align-items: center; 
                justify-content: center; 
                cursor: pointer; 
                transition: all 0.2s;
            }
            .desktop-back-btn:hover {
                background: #f1f5f9;
                color: var(--primary-color, #6366f1);
                transform: translateX(3px); 
            }
            .theme-toggle {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                border: 1px solid #e2e8f0;
                background: white;
                color: #64748b;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s;
                font-size: 1.1rem;
            }
            .theme-toggle:hover {
                background: #f1f5f9;
                color: #1e293b;
            }
            body.dark-mode .theme-toggle {
                background: #334155;
                border-color: #475569;
                color: #f1f5f9;
            }
            body.dark-mode .desktop-back-btn {
                background: #334155;
                border-color: #475569;
                color: #f1f5f9;
            }
            body.dark-mode .desktop-back-btn:hover {
                background: #475569;
            }
        </style>
    `;


    document.body.prepend(header);

    // Dark Mode Logic
    window.toggleDarkMode = () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme_mode', isDark ? 'dark' : 'light');
        updateThemeIcon(isDark);
    };

    function updateThemeIcon(isDark) {
        const btn = document.querySelector('.theme-toggle i');
        if (btn) {
            btn.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
            if (isDark) btn.style.color = '#fbbf24'; // Amber sun
            else btn.style.color = '';
        }
    }

    // Init Theme
    const savedTheme = localStorage.getItem('theme_mode');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        updateThemeIcon(true);
    }


    // Global Logout Function with Custom Modal
    window.logoutUser = () => {
        // Check if modal already exists
        if (document.getElementById('custom-logout-modal')) return;

        const modalHtml = `
            <div id="custom-logout-modal" class="custom-modal-overlay">
                <div class="custom-modal-content">
                    <div class="modal-icon">
                        <i class="fas fa-sign-out-alt"></i>
                    </div>
                    <h3>تسجيل الخروج</h3>
                    <p>هل أنت متأكد أنك تريد تسجيل الخروج؟</p>
                    <div class="modal-actions">
                        <button id="confirm-logout" class="btn-danger">نعم، خروج</button>
                        <button id="cancel-logout" class="btn-secondary">إلغاء</button>
                    </div>
                </div>
            </div>
            <style>
                .custom-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(15, 23, 42, 0.6);
                    backdrop-filter: blur(4px);
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: fadeIn 0.2s ease-out;
                }
                .custom-modal-content {
                    background: white;
                    padding: 2rem;
                    border-radius: 20px;
                    width: 90%;
                    max-width: 400px;
                    text-align: center;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                body.dark-mode .custom-modal-content {
                    background: #1e293b;
                    color: #f1f5f9;
                    border: 1px solid #334155;
                }
                .modal-icon {
                    width: 60px;
                    height: 60px;
                    background: #fee2e2;
                    color: #ef4444;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                    margin: 0 auto 1rem;
                }
                body.dark-mode .modal-icon {
                    background: rgba(239, 68, 68, 0.2);
                }
                .custom-modal-content h3 {
                    margin-bottom: 0.5rem;
                    font-size: 1.25rem;
                    font-weight: 700;
                }
                .custom-modal-content p {
                    color: #64748b;
                    margin-bottom: 1.5rem;
                }
                body.dark-mode .custom-modal-content p {
                    color: #94a3b8;
                }
                .modal-actions {
                    display: flex;
                    gap: 1rem;
                    justify-content: center;
                }
                .modal-actions button {
                    flex: 1;
                    padding: 0.75rem 1rem;
                    border-radius: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    border: none;
                    transition: all 0.2s;
                    font-size: 1rem;
                }
                .btn-danger {
                    background: #ef4444;
                    color: white;
                }
                .btn-danger:hover {
                    background: #dc2626;
                    color: white;
                }
                .btn-secondary {
                    background: #f1f5f9;
                    color: #475569;
                }
                .btn-secondary:hover {
                    background: #e2e8f0;
                }
                body.dark-mode .btn-secondary {
                    background: #334155;
                    color: #cbd5e1;
                }
                body.dark-mode .btn-secondary:hover {
                    background: #475569;
                }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            </style>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Event Listeners
        document.getElementById('cancel-logout').onclick = () => {
            document.getElementById('custom-logout-modal').remove();
        };

        document.getElementById('confirm-logout').onclick = async () => {
            // Import auth dynamically if needed or use global
            // Usually auth is imported in module. 
            // Since student-common.js is a module that might not import auth directly in this scope if not defined.
            // But let's try to assume global availability or dynamic import.
            // Actually, the original code had `logoutUser` doing simple redirect or confirm.
            // It didn't seem to have the `signOut` logic inside standard `student-common.js` usually unless connected.
            // However, `profile.html` had `signOut`.

            // Let's standardise:
            try {
                const { getAuth, signOut } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
                const auth = getAuth();
                await signOut(auth);
                window.location.href = 'login.html';
            } catch (e) {
                console.error("Logout failed", e);
                // Fallback
                window.location.href = 'login.html';
            }
        };

        // Close on click outside
        document.getElementById('custom-logout-modal').onclick = (e) => {
            if (e.target.id === 'custom-logout-modal') {
                e.target.remove();
            }
        };
    };
}
