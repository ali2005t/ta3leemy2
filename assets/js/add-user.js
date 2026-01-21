import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection,
    addDoc,
    serverTimestamp,
    getDoc,
    doc,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    let currentUser = null;

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
        } else {
            window.location.href = '../auth/login.html';
        }
    });

    const form = document.getElementById('add-user-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('save-btn');
            const loader = document.getElementById('btn-loader');

            btn.disabled = true;
            loader.style.display = 'inline-block';

            const name = document.getElementById('user-name').value;
            const email = document.getElementById('user-email').value;
            const pass = document.getElementById('user-password').value;
            // Collect Permissions
            const permissions = {
                manage_students: document.getElementById('perm-students').checked,
                manage_content: document.getElementById('perm-content').checked,
                manage_codes: document.getElementById('perm-codes').checked,
                grade_exams: document.getElementById('perm-exams').checked,
                view_analytics: document.getElementById('perm-analytics').checked
            };

            // Basic Validation: At least one permission? Or not needed.

            try {
                // IMPORTANT: We cannot create a Firebase Auth User here while logged in as Admin.
                // We would need a Cloud Function or Admin SDK.
                // FOR DEMO/MVP: We will just save the "Invite" to Firestore.
                // The actual user creation would happen when they use the invite or we mock it.

                // --- LIMIT CHECK LOGIC (Dynamic) ---
                // 1. Get Current Plan & Pricing Config
                const [teacherSnap, configSnap] = await Promise.all([
                    getDoc(doc(db, "teachers", currentUser.uid)),
                    getDoc(doc(db, "config", "pricing_v2"))
                ]);

                const teacherData = teacherSnap.exists() ? teacherSnap.data() : {};
                const planKey = teacherData.subscriptionPlan || 'basic'; // basic, pro, elite

                // Get Limit from Config
                let limit = 1; // Default fallback
                if (configSnap.exists()) {
                    const config = configSnap.data();
                    if (config[planKey] && config[planKey].maxStaff !== undefined) {
                        limit = config[planKey].maxStaff;
                    }
                }

                // 2. Get Current Staff Count
                const q = query(collection(db, "staff_invites"), where("ownerId", "==", currentUser.uid));
                const snap = await getDocs(q);
                const currentCount = snap.size;

                // 3. Check
                if (limit > 0 && currentCount >= limit) {
                    let msg = `عفواً، لقد وصلت للحد الأقصى من المساعدين (${limit}).`;
                    msg += "\nيرجى ترقية باقتك لإضافة المزيد.";

                    if (confirm(msg)) {
                        window.location.href = 'subscriptions.html';
                    }

                    btn.disabled = false;
                    loader.style.display = 'none';
                    return; // Stop execution
                }
                // --- END LIMIT CHECK ---

                await addDoc(collection(db, "staff_invites"), {
                    ownerId: currentUser.uid,
                    name: name,
                    email: email,
                    initialPassword: pass, // Insecure in production, ok for MVP demo
                    role: 'staff', // Generic role
                    permissions: permissions, // Detailed permissions
                    status: 'active',
                    createdAt: serverTimestamp()
                });

                // Also add to a visible 'staff' collection for list view if separate
                // Or just query 'staff_invites' in users.js

                alert("تم إضافة الموظف بنجاح (Simulation)");
                window.location.href = 'users.html';

            } catch (error) {
                console.error("Error adding user:", error);
                alert("حدث خطأ: " + error.message);
                btn.disabled = false;
                loader.style.display = 'none';
            }
        });
    }

});
