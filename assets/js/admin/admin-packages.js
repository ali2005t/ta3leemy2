import { db, auth } from '../firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Default Data Structure
const defaultPackages = {
    basic: {
        title: "المعلم (Teacher)",
        tagline: "ادخل عالم التعليم الأونلاين بأقل تكلفة",
        priceMonthly: 199,
        priceYearly: 1999,
        maxStudents: 100,
        storage: 5,
        maxStaff: 1,
        features: "100 طالب\nالمساحة = 5 (GB)\nعدد المساعدين = 1\nرابط خاص بك\nبنك أسئلة وامتحانات\nدعم فني 24/7",
        btnText: "اشترك الآن",
        isPopular: false
    },
    pro: {
        title: "السنتر (Center)",
        tagline: "للمعلمين المحترفين وأصحاب السناتر",
        priceMonthly: 599,
        priceYearly: 5999,
        maxStudents: 1000,
        storage: 100,
        maxStaff: 5,
        features: "1,000 طالب\nالمساحة = 100 (GB)\nعدد المساعدين = 5\nدومين خاص (.com)\nتطبيق للطلاب (Android)\nتفعيل أكواد الشراء\nمنصة باسمك\nدعم فني مخصص",
        btnText: "اشترك الآن (تجربة مجانية)",
        isPopular: true
    },
    elite: {
        title: "الأكاديمية (Academy)",
        tagline: "امتلك منصة وتطبيق خاص باسمك بالكامل",
        priceMonthly: 999,
        priceYearly: 9999,
        maxStudents: 0,
        storage: 10000, // Open
        maxStaff: 9999,
        features: "عدد طلاب غير محدود\nمساحة تخزين مفتوحة\nعدد مساعدين لا نهائي\nتطبيق (Android & iOS)\nدعم فني فوري (Priority)\nدومين خاص (.com)\nمدير حساب خاص",
        btnText: "تواصل معنا",
        isPopular: false
    }
};

let currentPackages = { ...defaultPackages };

let isRestricted = false;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Check Scope
        try {
            const adminSnap = await getDoc(doc(db, "admins", user.uid));
            if (adminSnap.exists()) {
                const list = adminSnap.data().assignedTeachers || [];
                if (list.length > 0) isRestricted = true;
            }
        } catch (e) { console.error("Scope Check Error", e); }

        loadPackages();
    } else {
        window.location.href = 'login.html';
    }
});

async function loadPackages() {
    try {
        const docSnap = await getDoc(doc(db, "config", "pricing_v2")); // Use new doc v2
        if (docSnap.exists()) {
            currentPackages = { ...defaultPackages, ...docSnap.data() };
        } else {
            // Migrating or Init
            await setDoc(doc(db, "config", "pricing_v2"), defaultPackages);
        }
        fillInputs();

        // Disable if Restricted
        if (isRestricted) {
            document.querySelectorAll('.form-input').forEach(el => el.disabled = true);
            document.querySelectorAll('.save-pkg-btn').forEach(el => el.style.display = 'none');
            // Also block notifications input if present
            const notifInputs = document.querySelectorAll('#notif-title, #notif-body, #notif-target');
            notifInputs.forEach(el => el.disabled = true);
            const notifBtn = document.getElementById('send-notif-btn');
            if (notifBtn) notifBtn.disabled = true;

            if (window.UIManager) UIManager.showToast('ليس لديك صلاحية لتعديل إعدادات النظام العامة', 'warning');
        }

    } catch (e) { console.error("Error loading packages:", e); }
}

function fillInputs() {
    document.querySelectorAll('.package-card').forEach(card => {
        const id = card.dataset.id;
        const data = currentPackages[id];
        if (!data) return;

        card.querySelector('.pkg-title').value = data.title || '';
        card.querySelector('.pkg-tagline').value = data.tagline || '';
        card.querySelector('.pkg-price-monthly').value = data.priceMonthly || 0;
        card.querySelector('.pkg-price-yearly').value = data.priceYearly || 0;

        // New Fields
        card.querySelector('.pkg-max-students').value = (data.maxStudents !== undefined) ? data.maxStudents : 0;
        card.querySelector('.pkg-storage').value = (data.storage !== undefined) ? data.storage : 0;
        card.querySelector('.pkg-max-staff').value = (data.maxStaff !== undefined) ? data.maxStaff : 1;

        card.querySelector('.pkg-features').value = data.features || '';
        card.querySelector('.pkg-btn-text').value = data.btnText || '';
        card.querySelector('.pkg-popular').checked = data.isPopular || false;

        // Setup individual save listener? No, bulk save or individual? 
        // The HTML has save buttons per card.
        card.querySelector('.save-pkg-btn').onclick = () => savePackage(id);
    });
}

async function savePackage(id) {
    const card = document.querySelector(`.package-card[data-id="${id}"]`);
    if (!card) return;

    const newData = {
        title: card.querySelector('.pkg-title').value,
        tagline: card.querySelector('.pkg-tagline').value,
        priceMonthly: Number(card.querySelector('.pkg-price-monthly').value),
        priceYearly: Number(card.querySelector('.pkg-price-yearly').value),
        maxStudents: Number(card.querySelector('.pkg-max-students').value),
        storage: Number(card.querySelector('.pkg-storage').value),
        maxStaff: Number(card.querySelector('.pkg-max-staff').value),
        features: card.querySelector('.pkg-features').value,
        btnText: card.querySelector('.pkg-btn-text').value,
        isPopular: card.querySelector('.pkg-popular').checked
    };

    currentPackages[id] = newData;

    try {
        const btn = card.querySelector('.save-pkg-btn');
        const originalText = btn.innerText;
        btn.innerText = "جاري الحفظ...";
        btn.disabled = true;

        await setDoc(doc(db, "config", "pricing_v2"), currentPackages); // Update whole object

        btn.innerText = "تم الحفظ!";
        setTimeout(() => {
            btn.innerText = originalText;
            btn.disabled = false;
        }, 1500);

        UIManager.showToast('تم حفظ الباقة بنجاح');

    } catch (e) {
        console.error(e);
        UIManager.showToast("خطأ في حفظ البيانات", "error");
    }
}

// Notification Logic (Keeping existing logic if needed)
const sendBtn = document.getElementById('send-notif-btn');
if (sendBtn) {
    sendBtn.onclick = async () => {
        // ... (Existing notification logic) ...
        UIManager.showToast('هذه الميزة (الإشعارات) تم نقلها لصفحة مستقلة ولكن يمكن تفعيلها هنا أيضاً.', 'info');
    };
}
