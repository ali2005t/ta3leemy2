import { auth, db } from './firebase-config.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    sendEmailVerification,
    signOut,
    RecaptchaVerifier,
    signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    doc,
    setDoc,
    getDoc,
    serverTimestamp,
    updateDoc,
    arrayUnion,
    collection,
    query,
    where,
    getDocs,
    getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { setPersistence, browserLocalPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"; // Import Persistence

// Force Local Persistence
// Force Local Persistence was here, now handled dynamically
// setPersistence(auth, browserLocalPersistence)...


// === CONFIGURATION ===
const ENABLE_PHONE_VERIFICATION = false; // Set to false to disable OTP step (User Request)
// =====================

document.addEventListener('DOMContentLoaded', async () => {

    // --- 1. Hash Routing Check (Slug System) ---
    // Format: #/slug
    const hash = window.location.hash;
    // Check if hash exists and is not just empty "#"
    if (hash && hash.length > 2 && hash.startsWith('#/')) {
        // Exclude internal navigation hashes if any (e.g. #contact) - unlikely in this architecture
        const slug = hash.substring(2); // Remove #/
        if (slug && !slug.includes('/')) {
            try {
                let tid = null;
                // 1. Try Slug
                let q = query(collection(db, "teachers"), where("slug", "==", slug));
                let snap = await getDocs(q);

                // 2. Try Platform Name (Fallback like Home Page)
                if (snap.empty) {
                    const nameQuery = decodeURIComponent(slug).replace(/-/g, ' ');
                    q = query(collection(db, "teachers"), where("platformName", "==", nameQuery));
                    snap = await getDocs(q);
                }

                if (!snap.empty) {
                    tid = snap.docs[0].id;
                    sessionStorage.setItem('currentTeacherId', tid);
                } else {
                    console.warn("Slug/Name not found:", slug);
                }
            } catch (e) {
                console.error("Slug Query Error:", e);
            }
        }
    }

    // --- Context Management ---
    const params = new URLSearchParams(window.location.search);
    let teacherSupportContact = null;
    let teacherTelegramSupport = null;
    let teacherId = params.get('t') || sessionStorage.getItem('currentTeacherId');

    // Persist Context
    if (teacherId) {
        sessionStorage.setItem('currentTeacherId', teacherId);

        // Retain 't' in links ONLY if we don't have a hash slug (Legacy Mode)
        // If we have a hash slug, we prefer that for cleaner URLs
        const hasSlug = window.location.hash && window.location.hash.startsWith('#/');

        if (!hasSlug) {
            const links = document.querySelectorAll('a');
            links.forEach(link => {
                // Only touch internal links
                if (link.hostname === window.location.hostname &&
                    (link.href.includes('login.html') || link.href.includes('register.html') || link.href.includes('home.html'))) {

                    const url = new URL(link.href);
                    // Don't duplicate
                    if (!url.searchParams.has('t')) {
                        url.searchParams.set('t', teacherId);
                        link.href = url.toString();
                    }
                }
            });
        }
    }

    // --- Dynamic Branding & Settings ---
    if (teacherId) {
        try {
            const docRef = doc(db, "teachers", teacherId);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const data = snap.data();

                // 1. Branding
                if (data.platformName) {
                    const titleEl = document.querySelector('.auth-header h2');
                    const logoEl = document.querySelector('.auth-logo');
                    if (titleEl) titleEl.innerText = `مرحباً بك في ${data.platformName}`;
                    if (logoEl) logoEl.innerText = data.platformName;
                    document.title = `${data.platformName} - تسجيل الدخول`;
                }

                // AUTO-UPDATE HASH: Ensure consistent #/slug
                if (data.slug) {
                    const desiredHash = `#/${data.slug}`;
                    if (window.location.hash !== desiredHash) {
                        const cleanUrl = `${window.location.pathname}${desiredHash}`;
                        window.history.replaceState(null, '', cleanUrl);
                    }
                }

                // Capture Support Info
                if (data.supportPhone) teacherSupportContact = data.supportPhone;
                if (data.telegramSupport) teacherTelegramSupport = data.telegramSupport;

                // Branding Priority: App Settings > Platform Color > Default
                const brandColor = (data.appSettings && data.appSettings.brandColor) ? data.appSettings.brandColor : data.platformColor;

                if (brandColor) {
                    document.documentElement.style.setProperty('--primary-color', brandColor);
                    document.documentElement.style.setProperty('--app-primary', brandColor);
                    document.documentElement.style.setProperty('--app-primary-hover', brandColor);

                    const btn = document.querySelector('.btn-primary');
                    if (btn) btn.style.backgroundColor = brandColor;

                    const link = document.querySelector('.auth-logo');
                    if (link) link.style.color = brandColor;
                }

                // 2. Academic Years (For Register Page)
                const yearSelect = document.getElementById('academic-year');
                const yearGroup = document.getElementById('year-group');

                if (yearSelect && yearGroup && data.academicYears && data.academicYears.length > 0) {
                    yearGroup.style.display = 'block';
                    data.academicYears.forEach(year => {
                        const opt = document.createElement('option');
                        opt.value = year;
                        opt.innerText = year;
                        yearSelect.appendChild(opt);
                    });
                }
            }
        } catch (e) {
            console.error("Error loading teacher context:", e);
        }
    }

    // --- Helper: Device ID ---
    function getDeviceId() {
        let id = localStorage.getItem('student_device_id');
        if (!id) {
            // Generate a persistent ID for this browser/device
            id = 'dev_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
            localStorage.setItem('student_device_id', id);
        }
        return id;
    }

    // --- Helper: Device Modal ---
    // --- Helper: Device Modal ---
    function showDeviceLockModal() {
        const backdrop = document.createElement('div');
        backdrop.className = 'device-modal-backdrop';

        const card = document.createElement('div');
        card.className = 'device-modal-card';

        let supportHtml = '';
        let buttons = [];

        if (teacherSupportContact) {
            let href = teacherSupportContact;
            if (!href.startsWith('http') && !href.startsWith('wa.me')) {
                href = `https://wa.me/${href.replace(/\+/g, '').replace(/ /g, '')}`;
            }
            buttons.push(`<a href="${href}" target="_blank" style="display:inline-flex;align-items:center;gap:5px;background:#25D366;color:white;padding:8px 16px;border-radius:20px;text-decoration:none;font-weight:600;font-size:0.9rem;"><i class="fab fa-whatsapp" style="font-size:1.1rem;"></i> واتساب</a>`);
        }

        if (teacherTelegramSupport) {
            let href = teacherTelegramSupport;
            if (!href.startsWith('http') && !href.startsWith('t.me')) {
                if (href.startsWith('@')) href = href.substring(1);
                href = `https://t.me/${href}`;
            }
            buttons.push(`<a href="${href}" target="_blank" style="display:inline-flex;align-items:center;gap:5px;background:#0088cc;color:white;padding:8px 16px;border-radius:20px;text-decoration:none;font-weight:600;font-size:0.9rem;"><i class="fab fa-telegram" style="font-size:1.1rem;"></i> تليجرام</a>`);
        }

        if (buttons.length > 0) {
            supportHtml = `
                <div class="device-modal-support" style="margin-top:20px;border-top:1px solid #e2e8f0;padding-top:15px;">
                    <p style="margin:0 0 10px;color:#64748b;font-size:0.9rem;">تواجه مشكلة؟ تواصل معنا:</p>
                    <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                        ${buttons.join('')}
                    </div>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="device-modal-icon-wrapper">
                <i class="fas fa-lock device-modal-icon"></i>
            </div>
            <h3 class="device-modal-title">الجهاز غير مصرح</h3>
            <p class="device-modal-text">
                عذراً، هذا الحساب مرتبط بجهاز آخر ولا يمكن فتحه من هنا.
                <br><br>
                <div class="device-modal-note">
                   يرجى تسجيل الدخول من الهاتف الذي قمت بالتسجيل منه (جهازك الأصلي).
                </div>
            </p>
            <button id="close-device-modal" class="device-modal-btn">فهمت</button>
            ${supportHtml}
        `;

        backdrop.appendChild(card);
        document.body.appendChild(backdrop);

        document.getElementById('close-device-modal').onclick = () => {
            backdrop.remove();
            auth.signOut();
        };
    }

    // --- Login Logic ---
    const loginForm = document.getElementById('student-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailEl = document.getElementById('email') || document.getElementById('login-email');
            const passEl = document.getElementById('password') || document.getElementById('login-password');

            if (!emailEl || !passEl) {
                alert('خطأ في الصفحة: حقل البريد أو كلمة المرور غير موجود');
                return;
            }

            const btn = document.getElementById('login-btn');
            const btnTextEl = document.getElementById('btn-text');
            const originalText = btnTextEl ? btnTextEl.innerHTML : btn.innerText;
            const loader = document.getElementById('btn-loader');

            // Loading State
            btn.disabled = true;
            if (btnTextEl) btnTextEl.style.visibility = 'hidden';
            if (loader) loader.style.display = 'inline-block';

            // Hide previous errors
            const errorContainer = document.getElementById('student-error-message');
            if (errorContainer) {
                errorContainer.style.display = 'none';
                errorContainer.innerHTML = '';
            }

            const method = document.getElementById('login-method') ? document.getElementById('login-method').value : 'email';
            let identifier = "";
            const password = document.getElementById('login-password').value;

            // 1. RESOLVE INPUT
            if (method === 'phone') {
                let rawPhone = document.getElementById('login-phone').value.trim();
                // Intelligent Parsing for Egypt (+20)
                // Input: 10xxxx -> +2010xxxx
                // Input: 010xxxx -> +2010xxxx
                if (rawPhone.startsWith('0')) rawPhone = rawPhone.substring(1);
                identifier = '+20' + rawPhone;
                console.log("LOGIN DEBUG: Constructed Phone (Tabs):", identifier);
            } else {
                identifier = document.getElementById('login-email').value.trim();
            }

            try {
                // --- 0. PHONE LOGIN SUPPORT ---
                identifier = identifier.replace(/\s/g, ''); // Remove spaces
                // Check if it's a phone number (digits/plus)
                if (/^[\d+]{10,}$/.test(identifier)) {
                    let foundEmail = null;
                    const searchPhones = [identifier];

                    // Smart Formats (+20 Egypt) - Additional Fallbacks just in case
                    if (identifier.startsWith('01')) searchPhones.push('+20' + identifier.substring(1)); // 010 -> +2010
                    if (identifier.startsWith('20') && !identifier.startsWith('+')) searchPhones.push('+' + identifier); // 2010 -> +2010
                    if (identifier.startsWith('+20')) {
                        searchPhones.push('0' + identifier.substring(3)); // +2010 -> 010
                        searchPhones.push(identifier.substring(1)); // +2010 -> 2010
                    }

                    console.log("LOGIN DEBUG: Searching for phones:", searchPhones);

                    // Execute checks
                    for (const phone of searchPhones) {
                        const q = query(collection(db, "students"), where("phone", "==", phone));
                        const snap = await getDocs(q);
                        if (!snap.empty) {
                            foundEmail = snap.docs[0].data().email;
                            break;
                        }
                    }

                    if (foundEmail) {
                        console.log("LOGIN DEBUG: Phone resolved to Email:", foundEmail);
                        identifier = foundEmail;
                    } else {
                        throw new Error("PHONE_NOT_FOUND");
                    }
                }
                // -----------------------------

                // 1. Authenticate
                // Determine Persistence Mode
                const rememberMe = document.getElementById('remember-me');
                const persistenceMode = (rememberMe && rememberMe.checked) ? browserLocalPersistence : browserSessionPersistence;

                await setPersistence(auth, persistenceMode);
                const cred = await signInWithEmailAndPassword(auth, identifier, password);
                const user = cred.user;

                // --- EMAIL VERIFICATION CHECK ---
                if (!user.emailVerified) {
                    try {
                        await sendEmailVerification(user);
                    } catch (err) {
                        console.error("Auto-resend failed:", err.message);
                    }

                    await signOut(auth); // Kick out

                    if (errorContainer) {
                        errorContainer.innerHTML = `
                            <div style="margin-bottom:10px;">
                                <i class="fas fa-envelope-open-text" style="font-size: 2.5rem; color: #ef4444; margin-bottom: 10px; display:inline-block;"></i>
                            </div>
                            <h4 style="color: white; margin: 0 0 5px 0; font-size: 1.1rem;">البريد الإلكتروني غير مفعل</h4>
                            <p style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 5px; line-height: 1.5;">
                                تم إرسال رابط تفعيل جديد إلى بريدك الآن.
                                <br>
                                <span style="font-size: 0.8rem; opacity: 0.8;">(يرجى التحقق من صندوق الوارد أو الرسائل غير المرغوب فيها)</span>
                            </p>
                        `;
                        errorContainer.style.display = 'block';
                    } else {
                        // Fallback
                        alert("⚠️ البريد الإلكتروني غير مفعل!\nتم إرسال رابط جديد.");
                    }

                    btn.disabled = false;
                    btn.innerHTML = originalText;
                    return;
                }
                // --------------------------------

                // 2. Check Security (Ban & Device Lock)
                const studentDocRef = doc(db, "students", user.uid);
                const studentSnap = await getDoc(studentDocRef);

                if (studentSnap.exists()) {
                    const data = studentSnap.data();

                    // A. Check Ban
                    if (data.isBanned === true) {
                        throw new Error("BLOCK_BAN");
                    }

                    // B. Check Device Lock
                    const currentDeviceId = getDeviceId();
                    const registeredDeviceId = data.deviceId;

                    if (registeredDeviceId && registeredDeviceId !== currentDeviceId) {
                        throw new Error("BLOCK_DEVICE");
                    }

                    // C. Register Device if new (First time login or after reset)
                    if (!registeredDeviceId) {
                        await updateDoc(studentDocRef, {
                            deviceId: currentDeviceId,
                            lastLogin: serverTimestamp()
                        });
                    } else {
                        // Just update last login
                        await updateDoc(studentDocRef, {
                            lastLogin: serverTimestamp()
                        });
                    }
                }

                // 3. Save Credentials for Silent Auto-Login (Median/WebView Fix)
                try {
                    const authData = {
                        email: user.email, // Use authenticated email
                        secret: btoa(password) // Simple encoding for auto-fill logic
                    };
                    localStorage.setItem('median_auth_data', JSON.stringify(authData));
                    console.log("Login credentials saved for silent re-login.");
                } catch (e) {
                    console.error("Failed to save auth backup:", e);
                }

                // Redirect preserving context
                window.location.href = `home.html${teacherId ? '?t=' + teacherId : ''}`;

            } catch (error) {
                console.error(error);
                // Handle specific blocking errors
                if (error.message === "PHONE_NOT_FOUND") {
                    const msg = "رقم الهاتف هذا غير مسجل لدينا. تأكد من الرقم أو سجل حساب جديد.";
                    const errorContainer = document.getElementById('student-error-message');
                    if (errorContainer) {
                        errorContainer.innerHTML = `<span style="color: #ef4444; font-weight:bold;">${msg}</span>`;
                        errorContainer.style.display = 'block';
                    } else alert(msg);

                    btn.disabled = false;
                    btn.innerHTML = originalText;
                    return;
                }

                if (error.message === "BLOCK_BAN") {
                    alert("⛔ تم حظر حسابك. يرجى التواصل مع الإدارة.");
                    auth.signOut(); // Force logout
                    auth.signOut(); // Force logout
                } else if (error.message === "BLOCK_DEVICE") {
                    showDeviceLockModal();
                } else {
                    // Generic Error Message (No "User not found")
                    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                        const errorContainer = document.getElementById('student-error-message');
                        let msg = "البريد الإلكتروني أو كلمة المرور غير صحيحة";
                        if (error.code === 'auth/invalid-credential') {
                            msg += "<br><small>تأكد من أنك لم تسجل باستخدام جوجل (Google Sign-In) حيث لا يوجد كلمة مرور.</small>";
                        }

                        if (errorContainer) {
                            errorContainer.innerHTML = `<span style="color: #ef4444; font-weight:bold;">${msg}</span>`;
                            errorContainer.style.display = 'block';
                        } else {
                            alert(msg);
                        }
                    } else {
                        // Fallback for other errors
                        console.warn("Login Error Fallback");
                    }
                }

                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        });
    }

    // --- Register Logic ---
    const registerForm = document.getElementById('student-register-form');
    if (registerForm) {
        // Initialize Recaptcha
        if (ENABLE_PHONE_VERIFICATION) {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                'size': 'invisible',
                'callback': (response) => { }
            });
        }

        let confirmationResult = null;
        let isPhoneVerified = false;

        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Safe Element Access
            const nameEl = document.getElementById('full-name');
            const emailEl = document.getElementById('email');
            const passEl = document.getElementById('password');
            const phoneEl = document.getElementById('details-phone');
            const yearEl = document.getElementById('academic-year');

            if (!nameEl || !emailEl || !passEl) {
                alert("حدث خطأ في الصفحة، يرجى التحديث.");
                return;
            }

            const name = nameEl.value.trim();
            const email = emailEl.value.trim();
            const password = passEl.value;
            let phone = phoneEl ? phoneEl.value.trim() : '';
            const academicYear = yearEl ? yearEl.value : '';

            // Format Phone (+20)
            if (phone && !phone.startsWith('+')) {
                if (phone.startsWith('0')) phone = '+20' + phone.substring(1);
                else phone = '+20' + phone;
            }

            // --- VALIDATION ---
            if (!email.endsWith('@gmail.com')) {
                alert("عذراً، التسجيل متاح فقط لحسابات Gmail (@gmail.com).");
                return;
            }

            if (!phone) {
                alert("رقم الهاتف مطلوب");
                return;
            }

            const btn = registerForm.querySelector('button');
            const originalText = btn.innerHTML;
            btn.disabled = true;

            // Format Phone
            if (!phone.startsWith('+')) {
                if (phone.startsWith('0')) phone = '+20' + phone.substring(1);
                else phone = '+20' + phone;
            }

            // --- PHONE VERIFICATION (OTP) ---
            if (ENABLE_PHONE_VERIFICATION && !isPhoneVerified) {
                btn.innerHTML = '<i class="fas fa-sms"></i> جاري إرسال الرمز...';

                try {
                    const appVerifier = window.recaptchaVerifier;
                    const confirmation = await signInWithPhoneNumber(auth, phone, appVerifier);
                    confirmationResult = confirmation;

                    document.getElementById('otp-phone-display').innerText = phone;
                    document.getElementById('otp-modal').style.display = 'flex';

                    btn.disabled = false;
                    btn.innerHTML = originalText;
                    return; // Stop & Wait for OTP

                } catch (error) {
                    console.error("SMS Error:", error);
                    let msg = "فشل إرسال رسالة التحقق.";
                    if (error.code === 'auth/invalid-phone-number') msg = "رقم الهاتف غير صحيح.";
                    alert(msg);
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                    return;
                }
            }
            // --------------------------------

            // Proceed to Create (Helper function inline or block)
            await createStudentAccount(email, password, name, phone, academicYear, btn, originalText);
        });

        // OTP Confirm Button
        document.getElementById('verify-otp-btn')?.addEventListener('click', async () => {
            const otpInput = document.getElementById('otp-input').value;
            if (!otpInput) return;

            try {
                await confirmationResult.confirm(otpInput);
                isPhoneVerified = true;
                document.getElementById('otp-modal').style.display = 'none';
                await signOut(auth); // Sign out from phone user

                // Trigger creation
                const btn = registerForm.querySelector('button');
                const originalText = btn.innerHTML; // Hacky but works if not changed

                // Re-read values
                const name = document.getElementById('full-name').value.trim();
                const email = document.getElementById('email').value.trim();
                const password = document.getElementById('password').value;
                let phone = document.getElementById('details-phone').value.trim();
                if (!phone.startsWith('+')) {
                    if (phone.startsWith('0')) phone = '+20' + phone.substring(1);
                    else phone = '+20' + phone;
                }
                const year = document.getElementById('academic-year').value;

                await createStudentAccount(email, password, name, phone, year, btn, "إنشاء الحساب");

            } catch (error) {
                alert("رمز التحقق غير صحيح");
            }
        });

        async function createStudentAccount(email, password, name, phone, academicYear, btn, originalText) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> التحقق من البيانات...';

            try {
                // 0. Check Phone Uniqueness
                const q = query(collection(db, "students"), where("phone", "==", phone));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    throw new Error("PHONE_EXISTS");
                }

                // 0.5 Check Student Limit (New Feature)
                if (teacherId) {
                    const tDoc = await getDoc(doc(db, "teachers", teacherId));
                    if (tDoc.exists()) {
                        const tData = tDoc.data();
                        const maxStudents = tData.maxStudents;

                        // Check logic: If maxStudents exists and is a valid number (>0)
                        if (maxStudents && typeof maxStudents === 'number' && maxStudents > 0) {
                            const countQ = query(collection(db, "students"), where("enrolledTeachers", "array-contains", teacherId));
                            const countSnap = await getCountFromServer(countQ);
                            const currentCount = countSnap.data().count();

                            if (currentCount >= maxStudents) {
                                throw new Error("TEACHER_FULL");
                            }
                        }
                    }
                }

                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإنشاء...';

                // 1. Create Auth
                const cred = await createUserWithEmailAndPassword(auth, email, password);
                const user = cred.user;

                // 2. Send Verification Email
                await sendEmailVerification(user);

                // 3. Create Student Doc
                const studentData = {
                    name: name,
                    email: email,
                    phone: phone,
                    academicYear: academicYear,
                    role: 'student',
                    createdAt: serverTimestamp(),
                    enrolledTeachers: teacherId ? [teacherId] : [],
                    currentPlatform: teacherId || null,
                    isBanned: false,
                    deviceId: getDeviceId(),
                    emailVerified: false,
                    phoneVerified: ENABLE_PHONE_VERIFICATION
                };

                await setDoc(doc(db, "students", user.uid), studentData);

                // 4. Sign Out
                await signOut(auth);

                // 5. Success Alert
                alert(`✅ تم إنشاء الحساب بنجاح!\n\n⚠️ يرجى تفعيل حسابك من خلال الرسالة التي أرسلناها إلى بريدك (${email}) لتتمكن من الدخول.`);
                window.location.href = 'login.html';

            } catch (error) {
                console.error(error);
                let msg = "حدث خطأ: " + error.message;
                if (error.message === 'PHONE_EXISTS') msg = "رقم الهاتف مستخدم بالفعل في حساب آخر.";
                if (error.message === 'TEACHER_FULL') msg = "عفواً، التسجيل مع هذا المعلم مغلق مؤقتاً لاكتمال العدد المسموح به. يرجى التواصل مع المعلم.";
                if (error.code === 'auth/email-already-in-use') msg = "البريد الإلكتروني مستخدم بالفعل";
                if (error.code === 'auth/weak-password') msg = "كلمة المرور ضعيفة";
                alert(msg);
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }
    }

});
