import { auth, db } from './firebase-config.js';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    updateDoc,
    addDoc,
    serverTimestamp,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { increment, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


document.addEventListener('DOMContentLoaded', () => {

    let currentUser = null;

    // Enforce Auth
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
        } else {
            // If checking out as guest is not allowed anymore
            window.location.href = 'login.html';
        }
    });

    const codeInputs = document.querySelectorAll('.code-box');

    // Auto focus next input
    codeInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1) {
                if (index < codeInputs.length - 1) {
                    codeInputs[index + 1].focus();
                }
            }
        });

        // Backspace support
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && e.target.value === '') {
                if (index > 0) {
                    codeInputs[index - 1].focus();
                }
            }
        });
    });

    const submitBtn = document.getElementById('submit-code');
    const msgDiv = document.getElementById('message');

    submitBtn.addEventListener('click', async () => {
        const fullCode = Array.from(codeInputs).map(i => i.value).join('').trim();

        if (fullCode.length < 8) { // Assuming 8-10 chars
            showMsg("الرجاء إدخال الكود كاملاً", "error");
            return;
        }

        if (!currentUser) {
            showMsg("الرجاء تسجيل الدخول أولاً", "error");
            setTimeout(() => window.location.href = 'login.html', 1500);
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحقق...';

        try {
            // 1. Verify Code in Firestore
            const q = query(
                collection(db, "access_codes"),
                where("code", "==", fullCode),
                where("status", "==", "available")
            );

            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                showMsg("الكود غير صحيح أو مستخدم من قبل", "error");
                resetBtn();
                return;
            }

            const codeDoc = querySnapshot.docs[0];
            const codeData = codeDoc.data();
            const courseId = codeData.courseId || codeData.targetId; // Handle targetId

            // 2. Transaction: Mark Code Used + Increment Teacher Revenue (Immutable)
            await runTransaction(db, async (transaction) => {
                const sfDoc = await transaction.get(doc(db, "access_codes", codeDoc.id));
                if (!sfDoc.exists()) throw "Codes does not exist!";

                const newData = sfDoc.data();
                if (newData.status !== 'available') throw "Code already used!";

                // A. Mark code used
                transaction.update(doc(db, "access_codes", codeDoc.id), {
                    status: "used",
                    isUsed: true,
                    usedBy: currentUser.uid,
                    usedAt: serverTimestamp()
                });

                // B. Increment Teacher Revenue (Persistent Field)
                if (newData.teacherId && newData.price) {
                    const priceVal = parseFloat(newData.price) || 0;
                    if (priceVal > 0) {
                        const teacherRef = doc(db, "teachers", newData.teacherId);
                        transaction.update(teacherRef, {
                            totalPaid: increment(priceVal)
                        });
                    }
                }
            });

            // 3. Create Enrollment Record in Firestore
            await addDoc(collection(db, "enrollments"), {
                studentId: currentUser.uid,
                courseId: courseId,
                codeUsed: fullCode,
                teacherId: codeData.teacherId || null,
                price: codeData.price || 0,
                enrolledAt: serverTimestamp()
            });

            showMsg("تم تفعيل الكورس بنجاح!", "success");

            setTimeout(() => {
                window.location.href = `course-view.html?id=${courseId}`;
            }, 1500);

        } catch (error) {
            console.error("Error activating code:", error);
            showMsg("حدث خطأ أثناء التفعيل", "error");
            resetBtn();
        }
    });

    function showMsg(text, type) {
        msgDiv.innerText = text;
        msgDiv.className = type === 'success' ? 'success-msg' : 'error-msg';
        msgDiv.style.display = 'block';
    }

    function resetBtn() {
        submitBtn.disabled = false;
        submitBtn.innerText = "تفعيل الكورس";
    }

});
