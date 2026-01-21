import { db } from '../firebase-config.js';
import { collection, addDoc, query, where, orderBy, getDocs, serverTimestamp, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { PushService } from '../push-service.js?v=5.0';

document.addEventListener('DOMContentLoaded', async () => {
    // Elements
    const form = document.getElementById('send-notif-form');
    const historyBody = document.getElementById('notif-history-body');
    const loading = document.getElementById('loading-indicator');

    // 1. Send Notification
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('send-btn');
            const originalText = btn.innerHTML;

            const target = document.getElementById('target-audience').value;
            const title = document.getElementById('notif-title').value;
            const body = document.getElementById('notif-body').value;

            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';

            try {
                // A. Save to Firestore
                await addDoc(collection(db, "notifications"), {
                    target: target,
                    title: title,
                    body: body,
                    createdAt: serverTimestamp(),
                    sender: "admin" // Critical for Segregation
                });

                // B. Trigger Push (OneSignal)
                // Filter users based on target? PushService needs to handle segments.
                // providing 'target' to PushService or handling it here.
                // simpler implementation for now:
                if (target === 'all') await PushService.sendToAll(title, body);
                else if (target === 'all_teachers') await PushService.sendToAllTeachers(title, body);
                else if (target === 'all_students') await PushService.sendToAll(title, body); // Adjusted as needed

                alert("✅ تم الإرسال بنجاح!");
                form.reset();
                loadHistory(); // Refresh table

            } catch (error) {
                console.error("Send Error:", error);
                alert("❌ حدث خطأ أثناء الإرسال");
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        });
    }

    // 2. Load History (Segregated: Sender == Admin)
    async function loadHistory() {
        if (!historyBody) return;

        try {
            loading.style.display = 'block';
            historyBody.innerHTML = '';

            // Query: Only fetch reports sent by 'admin'
            const q = query(
                collection(db, "notifications"),
                where("sender", "==", "admin"),
                orderBy("createdAt", "desc")
            );

            const snapshot = await getDocs(q);
            loading.style.display = 'none';

            if (snapshot.empty) {
                historyBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#94a3b8;">لا توجد إشعارات سابقة</td></tr>';
                return;
            }

            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const tr = document.createElement('tr');

                // Map Target to Readable
                let targetText = data.target;
                if (targetText === 'all') targetText = 'الكل';
                else if (targetText === 'all_teachers') targetText = 'المعلمين';
                else if (targetText === 'all_students') targetText = 'الطلاب';

                const date = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString('ar-EG') : '-';

                tr.innerHTML = `
                    <td style="font-weight:bold; color:white;">${data.title}</td>
                    <td style="color:#cbd5e1;">${(data.body || '').substring(0, 50)}${(data.body?.length > 50) ? '...' : ''}</td>
                    <td><span class="badge" style="background:#3b82f6; color:white; padding:3px 8px; border-radius:4px; font-size:0.8rem;">${targetText}</span></td>
                    <td style="color:#94a3b8; font-size:0.9rem;">${date}</td>
                    <td>
                        <button onclick="window.deleteAdminNotification('${docSnap.id}')" 
                                style="background:rgba(239, 68, 68, 0.1); border:1px solid #ef4444; color:#ef4444; width:32px; height:32px; border-radius:6px; cursor:pointer; transition:all 0.2s;" 
                                title="حذف"
                                onmouseover="this.style.background='#ef4444'; this.style.color='white'"
                                onmouseout="this.style.background='rgba(239, 68, 68, 0.1)'; this.style.color='#ef4444'">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                historyBody.appendChild(tr);
            });

        } catch (e) {
            console.error("History Load Error:", e);
            loading.style.display = 'none';
            historyBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#ef4444;">فشل تحميل السجل. تأكد من الفهرس (Index) في Firebase Console.</td></tr>';
        }
    }

    // 3. Expose Delete Function globally
    window.deleteAdminNotification = async (id) => {
        if (!confirm("هل أنت متأكد من حذف هذا الإشعار؟")) return;
        try {
            await deleteDoc(doc(db, "notifications", id));
            await loadHistory(); // Reload table safely
        } catch (e) {
            console.error(e);
            alert("فشل الحذف");
        }
    };

    // 4. Delete All Function
    window.deleteAllAdminNotifications = async () => {
        if (!confirm("⚠️ تحذير: هل أنت متأكد من حذف كافة إشعاراتك؟ لا يمكن التراجع عن هذا الإجراء.")) return;

        const btn = document.getElementById('delete-all-btn');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحذف...';
            btn.disabled = true;
        }

        try {
            // Query all admin notifications
            const q = query(
                collection(db, "notifications"),
                where("sender", "==", "admin")
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                alert("لا توجد إشعارات لحذفها.");
            } else {
                // Batch delete not always possible for large sets on client, using parallel promises
                const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
                await Promise.all(deletePromises);
                alert("تم حذف جميع الإشعارات بنجاح.");
            }

            await loadHistory();

        } catch (e) {
            console.error("Delete All Error:", e);
            alert("حدث خطأ أثناء الحذف.");
        } finally {
            if (btn) {
                btn.innerHTML = '<i class="fas fa-trash-alt"></i> حذف الكل';
                btn.disabled = false;
            }
        }
    };

    // Initial Load
    loadHistory();

});
