import { auth, db } from './firebase-config.js';
import { applyTheme } from './theme-loader.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection, query, where, orderBy, onSnapshot,
    addDoc, doc, getDocs, getDoc, serverTimestamp, updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    const ticketsContainer = document.getElementById('tickets-container');
    const modal = document.getElementById('new-ticket-modal');
    const fab = document.getElementById('open-new-ticket');
    const cancelBtn = document.getElementById('cancel-ticket');
    const createBtn = document.getElementById('create-ticket-btn');
    const teacherSelect = document.getElementById('teacher-select');

    // Chat Elements
    const chatView = document.getElementById('chat-view');
    const closeChatBtn = document.getElementById('close-chat');
    const chatBody = document.getElementById('student-chat-body');
    const chatInput = document.getElementById('student-chat-input');
    const sendBtn = document.getElementById('student-send-btn');
    const chatTitle = document.getElementById('chat-page-title');

    let currentUser = null;
    let currentTicketId = null;
    let messageUnsub = null;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await applyTheme();
            currentUser = user;
            loadFAQs(); // Load FAQs
            loadTickets();
            loadMyTeachers(); // Populate dropdown
        } else {
            window.location.href = 'login.html';
        }
    });

    // --- 0. Load FAQs ---
    async function loadFAQs() {
        const container = document.getElementById('faq-container');
        if (!container) return;

        try {
            const docRef = doc(db, 'settings', 'student_faqs');
            const snap = await getDoc(docRef);

            if (snap.exists() && snap.data().list && snap.data().list.length > 0) {
                container.innerHTML = '';
                snap.data().list.forEach(item => {
                    const el = document.createElement('div');
                    el.className = 'faq-card';

                    el.innerHTML = `
                        <div class="faq-header">
                            <span>${item.question}</span>
                            <i class="fas fa-chevron-down faq-icon"></i>
                        </div>
                        <div class="faq-body">
                            ${item.answer}
                        </div>
                    `;

                    // Toggle Logic
                    const header = el.querySelector('.faq-header');
                    const body = el.querySelector('.faq-body');
                    const icon = el.querySelector('.fa-chevron-down');

                    header.onclick = () => {
                        const isOpen = body.style.display === 'block';
                        body.style.display = isOpen ? 'none' : 'block';
                        icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
                    };

                    container.appendChild(el);
                });
            } else {
                container.innerHTML = '<div style="display:none;"></div>';
            }

        } catch (e) {
            console.error("FAQ Load Error", e);
            container.innerHTML = '';
        }
    }

    // --- 1. Load Tickets ---
    function loadTickets() {
        const q = query(
            collection(db, 'tickets'),
            where('studentId', '==', currentUser.uid),
            orderBy('updatedAt', 'desc')
        );

        onSnapshot(q, (snapshot) => {
            ticketsContainer.innerHTML = '';
            if (snapshot.empty) {
                ticketsContainer.innerHTML = '<div style="text-align:center; padding:50px; color:#64748b;">لا توجد تذاكر مسجلة. اضغط + لإضافة واحدة.</div>';
                return;
            }

            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const statusClass = data.status === 'open' ? 'status-open' : 'status-closed';
                const statusText = data.status === 'open' ? 'مفتوح' : 'مغلق';

                const card = document.createElement('div');
                card.className = 'ticket-card';
                card.innerHTML = `
                    <div style="overflow:hidden; margin-bottom:5px;">
                        <span class="ticket-status ${statusClass}">${statusText}</span>
                        <span class="ticket-date">${data.updatedAt?.toDate().toLocaleDateString('ar-EG') || ''}</span>
                    </div>
                    <h3 class="ticket-subject">${data.title}</h3>
                    <p class="ticket-snippet">${data.lastMessage ? data.lastMessage.substring(0, 40) + '...' : 'لا توجد رسائل'}</p>
                `;
                card.onclick = () => openChat(docSnap.id, data);
                ticketsContainer.appendChild(card);
            });
        });
    }

    // --- 2. Load Teachers (for Dropdown) ---
    async function loadMyTeachers() {
        try {
            let sessionTeacherId = sessionStorage.getItem('teacherId') || sessionStorage.getItem('currentTeacherId');

            // Aggressive Context Check (Check URL Hash directly if session empty)
            if (!sessionTeacherId) {
                const hash = window.location.hash.startsWith('#/') ? window.location.hash.substring(2) : null;
                if (hash) {
                    const nameQuery = decodeURIComponent(hash).replace(/-/g, ' ');
                    const q = query(collection(db, "teachers"), where("platformName", "==", nameQuery));
                    const snapshot = await getDocs(q);
                    if (!snapshot.empty) {
                        sessionTeacherId = snapshot.docs[0].id;
                        // Cache it for this session to avoid re-fetching
                        sessionStorage.setItem('teacherId', sessionTeacherId);
                    }
                }
            }

            if (sessionTeacherId) {
                // We are viewing a specific teacher's app
                const tSnap = await getDoc(doc(db, "teachers", sessionTeacherId));
                if (tSnap.exists()) {
                    const tData = tSnap.data();
                    teacherSelect.innerHTML = ''; // Clear options

                    const opt = document.createElement('option');
                    opt.value = sessionTeacherId;
                    opt.textContent = tData.name || tData.platformName || "المعلم الحالي";
                    opt.selected = true; // Auto-select
                    teacherSelect.appendChild(opt);

                    // Force disable to prevent confusion
                    // teacherSelect.disabled = true; 
                    // teacherSelect.style.background = '#e2e8f0';
                    return;
                }
            }

            // Fallback: Load enrolled teachers (Portal Mode)
            const studentDoc = await getDoc(doc(db, "students", currentUser.uid));
            if (studentDoc.exists()) {
                const data = studentDoc.data();
                const teacherIds = data.enrolledTeachers || [];

                teacherSelect.innerHTML = '<option value="">اختر المعلم...</option>';

                if (teacherIds.length === 0) {
                    teacherSelect.innerHTML = '<option value="">لست مشتركاً مع أي معلم</option>';
                    return;
                }

                for (const tid of teacherIds) {
                    const tSnap = await getDoc(doc(db, "teachers", tid));
                    if (tSnap.exists()) {
                        const tData = tSnap.data();
                        const opt = document.createElement('option');
                        opt.value = tid;
                        opt.textContent = tData.name || tData.platformName || "معلم";
                        teacherSelect.appendChild(opt);
                    }
                }
            } else {
                teacherSelect.innerHTML = '<option value="">حساب الطالب غير مفعل</option>';
            }
        } catch (e) {
            console.error(e);
        }
    }

    // --- 3. Create Ticket ---
    // --- 3. Create Ticket (UI Logic) ---
    let currentSupportType = 'scientific';

    // Expose functions to window for HTML onclicks
    window.selectSupportType = async (type) => {
        currentSupportType = type;
        document.getElementById('step-type-select').classList.add('hide');
        document.getElementById('step-details').classList.remove('hide');

        const teacherContainer = document.getElementById('teacher-select-container');
        const modalTitle = document.getElementById('modal-title');

        // Always show teacher select (Assistant of the teacher handles it)
        teacherContainer.style.display = 'block';
        await loadMyTeachers();

        if (type === 'scientific') {
            modalTitle.innerText = 'تذكرة دعم علمي';
        } else {
            modalTitle.innerText = 'تذكرة دعم فني';
        }
    };

    window.backToTypeSelect = () => {
        document.getElementById('step-type-select').classList.remove('hide');
        document.getElementById('step-details').classList.add('hide');
    };

    // Open Modal
    fab.onclick = () => {
        // Reset state
        document.getElementById('step-type-select').classList.remove('hide');
        document.getElementById('step-details').classList.add('hide');
        document.getElementById('ticket-title').value = '';
        modal.classList.add('active');
    };

    // Close Modal
    const closeModalBtn = document.getElementById('close-modal-btn');
    if (closeModalBtn) closeModalBtn.onclick = () => modal.classList.remove('active');

    // Create Action
    createBtn.onclick = async () => {
        const teacherId = teacherSelect.value;
        const title = document.getElementById('ticket-title').value;

        // Validation
        if (!title) {
            alert('يرجى كتابة عنوان للمشكلة');
            return;
        }

        if (!teacherId) {
            alert('يرجى اختيار المعلم');
            return;
        }

        try {
            createBtn.disabled = true;
            createBtn.innerText = 'جاري الإرسال...';

            // Get Student Name
            let studentName = currentUser.displayName;
            if (!studentName) {
                const sDoc = await getDoc(doc(db, "students", currentUser.uid));
                if (sDoc.exists()) studentName = sDoc.data().name || sDoc.data().fullName;
            }
            studentName = studentName || "طالب";

            // Prepare Data
            const ticketData = {
                studentId: currentUser.uid,
                studentName: studentName,
                title: title,
                status: 'open',
                updatedAt: serverTimestamp(),
                lastMessage: "تذكرة جديدة",
                type: currentSupportType, // 'scientific' or 'technical'
                teacherId: teacherId // Route to this teacher (and their assistant)
            };

            if (currentSupportType === 'technical') {
                ticketData.isTechnical = true;
            }

            await addDoc(collection(db, "tickets"), ticketData);

            modal.classList.remove('active');
            // alert('تم إنشاء التذكرة بنجاح');

        } catch (e) {
            console.error(e);
            alert('حدث خطأ أثناء الإرسال');
        } finally {
            createBtn.disabled = false;
            createBtn.innerText = 'إنشاء التذكرة';
        }
    };

    let currentTicketStatus = 'open';

    // --- 4. Chat System ---
    function openChat(ticketId, data) {
        currentTicketId = ticketId;
        currentTicketStatus = data.status || 'open';

        chatTitle.textContent = data.title;
        chatView.classList.add('active');

        // Check if closed
        if (currentTicketStatus === 'closed') {
            chatInput.disabled = true;
            chatInput.placeholder = "هذه التذكرة مغلقة ولا يمكن الرد عليها";
            sendBtn.disabled = true;
            sendBtn.style.opacity = '0.5';
        } else {
            chatInput.disabled = false;
            chatInput.placeholder = "اكتب رسالتك هنا...";
            sendBtn.disabled = false;
            sendBtn.style.opacity = '1';
        }

        // Listen to messages
        if (messageUnsub) messageUnsub();
        const ref = collection(db, 'tickets', ticketId, 'messages');
        const q = query(ref, orderBy('timestamp', 'asc'));

        messageUnsub = onSnapshot(q, (snap) => {
            chatBody.innerHTML = '';
            snap.forEach(d => {
                const msg = d.data();
                const isMe = msg.senderId === currentUser.uid;
                const div = document.createElement('div');
                div.className = `message ${isMe ? 'msg-me' : 'msg-other'}`;
                div.textContent = msg.text;
                chatBody.appendChild(div);
            });
            chatBody.scrollTop = chatBody.scrollHeight;
        });
    }

    closeChatBtn.onclick = () => {
        chatView.classList.remove('active');
        currentTicketId = null;
        if (messageUnsub) messageUnsub();
    };

    async function sendMsg() {
        const text = chatInput.value.trim();
        if (!text || !currentTicketId) return;

        try {
            chatInput.value = '';
            await addDoc(collection(db, 'tickets', currentTicketId, 'messages'), {
                text,
                senderId: currentUser.uid,
                isAdmin: false,
                timestamp: serverTimestamp()
            });

            await updateDoc(doc(db, 'tickets', currentTicketId), {
                lastMessage: text,
                updatedAt: serverTimestamp(),
                // teacherUnread: true
            });
        } catch (e) { console.error(e); }
    }

    sendBtn.onclick = sendMsg;

});
