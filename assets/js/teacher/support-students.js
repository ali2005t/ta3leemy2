import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, doc, getDoc, updateDoc, arrayUnion, onSnapshot, serverTimestamp, orderBy, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentTeacherId = null;
let currentTicketId = null;
let unsubscribeChat = null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentTeacherId = user.uid;
        // Handle Impersonation
        const impId = sessionStorage.getItem('impersonatedTeacherId');
        if (impId) currentTeacherId = impId;

        loadTickets();
    } else {
        window.location.href = '../auth/login.html';
    }
});

async function loadTickets() {
    const list = document.getElementById('tickets-table-body');
    const loading = document.getElementById('loading-indicator');
    const empty = document.getElementById('empty-state');

    try {
        const q = query(collection(db, "tickets"), where("teacherId", "==", currentTeacherId), orderBy("updatedAt", "desc"));
        const snapshot = await getDocs(q);

        loading.style.display = 'none';

        if (snapshot.empty) {
            empty.style.display = 'block';
            list.innerHTML = '';
            return;
        }

        empty.style.display = 'none';
        list.innerHTML = '';

        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString('ar-EG') : '-';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="color:white; font-weight:bold;">${data.studentName || 'طالب'}</td>
                <td style="color:#cbd5e1;">${data.title}</td>
                <td style="color:#94a3b8;">${date}</td>
                <td><span class="ticket-status ${data.status === 'closed' ? 'status-closed' : 'status-open'}">
                    ${data.status === 'closed' ? 'مغلق' : 'مفتوح'}
                </span></td>
                <td>
                    <button class="action-btn" onclick="window.openChat('${doc.id}', '${data.studentName}', '${data.title}', '${data.studentId}')" 
                        style="background:#3b82f6; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; margin-left:5px;">
                        <i class="fas fa-comments"></i> محادثة
                    </button>
                    ${data.status !== 'closed' ? `
                    <button onclick="window.closeTicket('${doc.id}')" 
                        style="background:#f59e0b; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; margin-left:5px;">
                        <i class="fas fa-check"></i> إغلاق
                    </button>` : ''}
                    <button onclick="window.deleteTicket('${doc.id}')" 
                        style="background:#ef4444; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer;">
                        <i class="fas fa-trash"></i> حذف
                    </button>
                </td>
            `;
            list.appendChild(tr);
        });

    } catch (e) {
        console.error("Error loading tickets:", e);
        loading.innerHTML = '<span style="color:red">حدث خطأ في التحميل</span>';
    }
}

window.openChat = async (ticketId, studentName, title, studentId) => {
    currentTicketId = ticketId;
    document.getElementById('chat-overlay').style.display = 'flex';
    document.getElementById('chat-student-name').innerText = studentName;
    document.getElementById('chat-ticket-title').innerText = title;

    // Fetch Full Student Details (Name + Phone) if studentId exists
    if (studentId) {
        try {
            const sSnap = await getDoc(doc(db, "students", studentId));
            if (sSnap.exists()) {
                const sData = sSnap.data();
                const realName = sData.name || sData.fullName || studentName;
                const phone = sData.phone || sData.phoneNumber || "رقم غير مسجل";

                document.getElementById('chat-student-name').innerHTML = `
                    ${realName} <span style="font-size:0.8rem; background:#334155; padding:2px 5px; border-radius:4px; margin-right:5px;">${phone}</span>
                `;
            }
        } catch (e) { console.error("Error fetching student details", e); }
    }

    // Load Messages Realtime (Subcollection)
    const messagesDiv = document.getElementById('chat-messages');
    messagesDiv.innerHTML = '<div style="text-align:center; color:#94a3b8;">جاري تحميل المحادثة...</div>';

    if (unsubscribeChat) unsubscribeChat();

    const q = query(collection(db, "tickets", ticketId, "messages"), orderBy("timestamp", "asc"));
    unsubscribeChat = onSnapshot(q, (snapshot) => {
        messagesDiv.innerHTML = '';
        snapshot.forEach(doc => {
            const msg = doc.data();
            const div = document.createElement('div');
            // Check senderId matches currentTeacherId
            div.className = `msg ${msg.senderId === currentTeacherId ? 'msg-teacher' : 'msg-student'}`;
            div.innerText = msg.text;
            messagesDiv.appendChild(div);
        });
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
};

window.closeChat = () => {
    document.getElementById('chat-overlay').style.display = 'none';
    if (unsubscribeChat) unsubscribeChat();
    currentTicketId = null;
};

window.sendReply = async () => {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || !currentTicketId) return;

    try {
        // 1. Add message to subcollection
        await addDoc(collection(db, "tickets", currentTicketId, "messages"), {
            senderId: currentTeacherId,
            text: text,
            timestamp: serverTimestamp(), // Use serverTimestamp for consistency
            isAdmin: false // Teacher is not 'admin' in this context (or is he? Student script expects isAdmin false for student. We can assume this field is just metadata).
        });

        // 2. Update main ticket metadata
        const docRef = doc(db, "tickets", currentTicketId);
        await updateDoc(docRef, {
            lastMessage: text,
            updatedAt: serverTimestamp(),
            status: 'open' // Re-open if replied
        });

        input.value = '';
    } catch (e) {
        console.error("Send Error:", e);
        UIManager.showToast("فشل الإرسال", "error");
    }
};

window.closeTicket = async (ticketId) => {
    if (await UIManager.showConfirm('إغلاق التذكرة', 'هل أنت متأكد من إغلاق التذكرة؟')) {
        try {
            await updateDoc(doc(db, "tickets", ticketId), {
                status: 'closed'
            });
            loadTickets(); // Refresh list
        } catch (e) {
            console.error(e);
        }
    }
};

window.deleteTicket = async (ticketId) => {
    if (confirm('هل أنت متأكد من حذف هذه التذكرة نهائياً؟')) {
        try {
            await deleteDoc(doc(db, "tickets", ticketId));
            loadTickets();
        } catch (e) {
            console.error("Delete Error:", e);
            alert("حدث خطأ أثناء الحذف");
        }
    }
};
