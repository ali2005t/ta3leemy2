
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    // Auth Listener
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Load User Data
            await loadStudentProfile(user.uid, user);
        } else {
            // Redirect to login if not logged in
            window.location.href = 'login.html';
        }
    });

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
                await signOut(auth);
                window.location.href = 'login.html';
            }
        });
    }

    // Load Profile Function
    async function loadStudentProfile(uid, authUser) {
        try {
            // 1. Try fetching from 'students' collection
            const userDoc = await getDoc(doc(db, "students", uid));

            let userData = {
                name: authUser.displayName || 'طالب',
                email: authUser.email,
                phone: authUser.phoneNumber || 'غير مسجل',
                createdAt: authUser.metadata.creationTime
            };

            if (userDoc.exists()) {
                const data = userDoc.data();
                // Merge Firestore data (prioritizing Firestore)
                userData = {
                    ...userData,
                    name: data.name || userData.name,
                    phone: data.phone || userData.phone,
                    email: data.email || userData.email
                };
            }

            // 2. Update UI
            updateElement('user-name', userData.name || 'طالب');
            updateElement('user-email', userData.email);
            updateElement('user-phone', userData.phone || 'غير متوفر');

            // Format Date
            if (userData.createdAt) {
                const date = new Date(userData.createdAt);
                const dateStr = date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
                updateElement('join-date', dateStr);
            }

            // Avatar (if any)
            // if (userData.photoURL) ... 

        } catch (error) {
            console.error("Profile Load Error:", error);
            // Fallback to Auth Data
            updateElement('user-name', authUser.displayName || 'طالب');
            updateElement('user-email', authUser.email);
        }
    }

    function updateElement(id, value) {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    }

});
