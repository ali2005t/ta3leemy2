import { db } from '../firebase-config.js';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    arrayUnion,
    arrayRemove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    loadFAQs();

    window.openEditModal = (id = null) => {
        const modal = document.getElementById('faq-modal');
        const titleEl = document.getElementById('modal-title');
        const qEl = document.getElementById('faq-question');
        const aEl = document.getElementById('faq-answer');
        const idEl = document.getElementById('faq-id');

        if (id) {
            // Edit Mode
            const faq = allFaqs.find(f => f.id === id);
            if (faq) {
                titleEl.textContent = 'تعديل سؤال';
                qEl.value = faq.question;
                aEl.value = faq.answer;
                idEl.value = id;
            }
        } else {
            // Add Mode
            titleEl.textContent = 'إضافة سؤال';
            qEl.value = '';
            aEl.value = '';
            idEl.value = '';
        }

        modal.style.display = 'flex';
    };

    window.closeModal = () => {
        document.getElementById('faq-modal').style.display = 'none';
    };

    window.saveFAQ = async () => {
        const q = document.getElementById('faq-question').value.trim();
        const a = document.getElementById('faq-answer').value.trim();
        const id = document.getElementById('faq-id').value;

        if (!q || !a) return alert("يرجى ملء الحقول");

        document.querySelector('button[onclick="saveFAQ()"]').textContent = 'جاري الحفظ...';

        try {
            const docRef = doc(db, "config", "faq");

            // We store FAQs as an array of objects in a single doc 'config/faq'
            // or we could use a subcollection. Single doc is cheaper for read if list is small (<100).

            const newFaq = {
                id: id || Date.now().toString(),
                question: q,
                answer: a
            };

            if (id) {
                // Edit: Remove old, add new (or update array)
                // Firestore array update is tricky for objects. simpler to read-modify-write.
                const snap = await getDoc(docRef);
                let faqs = snap.exists() ? snap.data().list || [] : [];
                faqs = faqs.map(f => f.id === id ? newFaq : f);
                await setDoc(docRef, { list: faqs }, { merge: true });
            } else {
                // Add
                await setDoc(docRef, {
                    list: arrayUnion(newFaq)
                }, { merge: true });
            }

            closeModal();
            loadFAQs();

        } catch (e) {
            console.error(e);
            alert("حدث خطأ");
        } finally {
            document.querySelector('button[onclick="saveFAQ()"]').textContent = 'حفظ';
        }
    };

    window.deleteFAQ = async (id) => {
        if (!confirm("هل أنت متأكد من الحذف؟")) return;

        try {
            const docRef = doc(db, "config", "faq");
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                let faqs = snap.data().list || [];
                faqs = faqs.filter(f => f.id !== id);
                await setDoc(docRef, { list: faqs });
                loadFAQs();
            }
        } catch (e) {
            console.error(e);
        }
    };
});

let allFaqs = [];

async function loadFAQs() {
    const container = document.getElementById('faq-list');
    container.innerHTML = '<div>جاري التحميل...</div>';

    try {
        const docRef = doc(db, "config", "faq");
        const snap = await getDoc(docRef);

        container.innerHTML = '';

        if (snap.exists() && snap.data().list && snap.data().list.length > 0) {
            allFaqs = snap.data().list;
            allFaqs.forEach(faq => {
                const div = document.createElement('div');
                div.style.background = '#1e293b';
                div.style.padding = '15px';
                div.style.borderRadius = '8px';
                div.style.border = '1px solid #334155';
                div.style.display = 'flex';
                div.style.justifyContent = 'space-between';
                div.style.alignItems = 'center';

                div.innerHTML = `
                    <div>
                        <div style="font-weight:bold; color:white; margin-bottom:5px;">${faq.question}</div>
                        <div style="color:#94a3b8; font-size:0.9rem;">${faq.answer}</div>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button onclick="openEditModal('${faq.id}')" style="background:none; border:none; color:#60a5fa; cursor:pointer;"><i class="fas fa-edit"></i></button>
                        <button onclick="deleteFAQ('${faq.id}')" style="background:none; border:none; color:#ef4444; cursor:pointer;"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                container.appendChild(div);
            });
        } else {
            container.innerHTML = `
                <div style="color:#64748b; text-align:center; padding:20px;">
                    <p style="margin-bottom:10px;">لا توجد أسئلة مضافة</p>
                    <button onclick="seedFAQs()" style="padding:8px 20px; background:#1e293b; border:1px solid #334155; color:#3b82f6; border-radius:6px; cursor:pointer;">
                        <i class="fas fa-magic"></i> إضافة أسئلة جاهزة
                    </button>
                </div>
            `;
        }

    } catch (e) {
        console.error(e);
        container.innerHTML = '<div>حدث خطأ في التحميل</div>';
    }
}

window.seedFAQs = async () => {
    if (!confirm("هل تريد إضافة أسئلة افتراضية؟")) return;

    const defaults = [
        { id: Date.now() + '1', question: "كيف يمكنني الاشتراك في الكورس؟", answer: "يمكنك الاشتراك عن طريق شراء كود شحن من السنتر أو فودافون كاش، ثم إدخاله في صفحة الدفع." },
        { id: Date.now() + '2', question: "الفيديو لا يعمل، ماذا أفعل؟", answer: "تأكد من اتصال الإنترنت، وحاول تحديث الصفحة. إذا استمرت المشكلة جرب متصفح جوجل كروم." },
        { id: Date.now() + '3', question: "هل يمكنني فتح الحساب من جهازين؟", answer: "نعم، ولكن لا يمكن مشاهدة الدروس في نفس الوقت من جهازين مختلفين." },
        { id: Date.now() + '4', question: "نسيت كلمة المرور؟", answer: "يمكنك التواصل مع الدعم الفني لإعادة تعيين كلمة المرور الخاصة بك." }
    ];

    try {
        await setDoc(doc(db, "config", "faq"), { list: defaults }, { merge: true });
        loadFAQs();
    } catch (e) {
        console.error(e);
        alert("فشل الإضافة");
    }
};
