import { db } from './firebase-config.js';
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Check Maintenance Mode
// This script should be imported in the head or top of body of all client-facing pages

(async function checkMaintenance() {
    const path = window.location.pathname;
    const search = window.location.search;

    // --- 1. WHITELIST ---
    // If Admin Page, skip checks
    if (path.includes('/admin/')) return;

    // If Maintenance Page, skip checks (but maybe listen for open?)
    if (path.includes('maintenance.html')) return;

    // If Student Panel, skip checks
    if (path.includes('/student/')) return;

    // --- 2. SPECIAL HANDLING FOR AUTH ---
    // User wants to block "Teacher Login/Register" specifically.
    // If it's auth/login.html -> It's shared. IF generic, we can't block easily without hurting students.
    // However, if the user insists "Close all teacher pages... even teacher login and register",
    // We can check if "role=teacher" exists (register), or simply block ALL auth if the user decides Maintenance = NO NEW USERS.
    // BUT, students need to login.
    // COMPROMISE: Block if 'role' param is 'teacher'.
    // NOTE: 'register.html' usually has ?role=teacher. 'login.html' might not.
    // If the user attempts to enter teacher pages later, they get blocked.
    // Let's block `register.html` if role=teacher.

    if (path.includes('/auth/')) {
        if (!search.includes('role=teacher')) {
            // It's likely student or generic login - ALLOW
            return;
        }
        // If it HAS role=teacher -> FALL THROUGH to maintenance check
    }

    // --- 3. REALTIME LISTENER ---
    try {
        const docRef = doc(db, "config", "general_settings");

        // Use onSnapshot for Realtime 'Kick' experience
        onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.maintenanceMode) {
                    // Check Time
                    if (data.maintenanceEndTime) {
                        const endTime = new Date(data.maintenanceEndTime).getTime();
                        const now = new Date().getTime();
                        if (now > endTime) {
                            // Expired -> Do nothing (allow access)
                            return;
                        }
                    }

                    // MAINTENANCE IS ACTIVE & VALID
                    // Show Warning if user is currently viewing the page
                    if (document.body) {
                        // Create a scary overlay if not already there
                        if (!document.getElementById('maint-overlay')) {
                            const overlay = document.createElement('div');
                            overlay.id = 'maint-overlay';
                            overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;font-family:sans-serif;text-align:center;";
                            overlay.innerHTML = `
                                <i class="fas fa-tools" style="font-size:4rem;margin-bottom:20px;color:#fca5a5;"></i>
                                <h1 style="margin:0 0 10px;">عذراً، الموقع يدخل وضع الصيانة</h1>
                                <p>سيتم تحويلك لصفحة الصيانة خلال لحظات...</p>
                            `;
                            document.body.appendChild(overlay);
                        }

                        setTimeout(() => {
                            window.location.href = '/maintenance.html';
                        }, 2000);
                    } else {
                        // Head script exec
                        window.location.href = '/maintenance.html';
                    }
                }
            }
        });

    } catch (e) {
        console.error("Maintenance check failed", e);
    }
})();
