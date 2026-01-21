import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    addDoc,
    serverTimestamp,
    doc,
    updateDoc,
    getDocs // Added getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    let selectedTeacherId = null; // Also acts as selectedStudentId
    let unsubscribeMessages = null;
    let allConversations = [];
    let myTeacherIds = new Set(); // Set of IDs
    let currentFilter = 'all'; // 'all' or 'mine'
    let currentTab = 'teacher'; // 'teacher' or 'student'

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await loadAssignedTeachers(user.uid);
            loadConversations();
        } else {
            window.location.href = '../auth/login.html';
        }
    });

    // 0. Fetch My Assigned Teachers
    async function loadAssignedTeachers(uid) {
        try {
            const q = query(collection(db, "teachers"), where("assignedAgentId", "==", uid));
            const snap = await getDocs(q);
            myTeacherIds = new Set(snap.docs.map(d => d.id));
            console.log("My Teachers:", myTeacherIds);
        } catch (e) {
            console.error("Error loading assigned teachers:", e);
        }
    }

    // 1. Load Conversations (Teachers who sent messages)
    // Firestore doesn't support "Group By" easily. 
    // We will query ALL messages, order by time, and client-side group? 
    // Or better: Keep a "conversations" collection.
    // Given the current structure in `teacher/support.html`: we just add to `support_tickets_teacher`.
    // So we need to query unique teacherIds.
    // Optimization: In a real app, we'd have a `last_message` on the user profile or a `conversations` collection.
    // For now, let's query the `support_tickets_teacher` and group client-side.
    // Warning: This could be heavy if thousands of messages.
    // Limit to last 500 messages?

    function loadConversations() {
        // Switch Collection based on Tab
        const collectionName = currentTab === 'teacher' ? "support_tickets_teacher" : "tickets";
        const orderByField = currentTab === 'teacher' ? "createdAt" : "updatedAt"; // 'tickets' uses updatedAt

        let q;
        if (currentTab === 'student') {
            q = query(
                collection(db, collectionName),
                where("isTechnical", "==", true),
                orderBy(orderByField, "desc")
            );
        } else {
            q = query(collection(db, collectionName), orderBy(orderByField, "desc"));
        }

        onSnapshot(q, (snapshot) => {
            const listMap = new Map();

            snapshot.forEach(docSnap => {
                const data = docSnap.data();

                if (currentTab === 'teacher') {
                    // Logic for Teacher Chat (Grouping Messages)
                    if (!listMap.has(data.teacherId)) {
                        listMap.set(data.teacherId, {
                            id: data.teacherId, // Unified ID
                            name: data.teacherName,
                            lastMsg: data.text,
                            time: data.createdAt,
                            unread: (data.sender === 'teacher' && data.read === false) ? 1 : 0
                        });
                    } else {
                        const existing = listMap.get(data.teacherId);
                        if (data.sender === 'teacher' && data.read === false) {
                            existing.unread += 1;
                        }
                    }
                } else {
                    // Logic for Student Tickets (Each doc is a ticket, not a message)
                    // But we might want to list Tickets? Or group by Student?
                    // The student-app creates a doc in 'tickets' per ticket.
                    // The messages are in subcollection.
                    // So we listed Tickets directly.
                    listMap.set(docSnap.id, {
                        id: docSnap.id, // Ticket ID
                        teacherId: data.teacherId, // For filtering
                        name: data.title + ' - ' + data.studentName,
                        lastMsg: data.lastMessage,
                        time: data.updatedAt,
                        status: data.status,
                        unread: (data.adminUnread) ? 1 : 0 // We need to add adminUnread flag logic later
                    });
                }
            });

            allConversations = Array.from(listMap.values());
            renderList(allConversations);
        });
    }

    function renderList(list) {
        const container = document.getElementById('conversations-list');
        container.innerHTML = '';

        const searchVal = document.getElementById('search-teacher').value.toLowerCase();



        let filtered = list.filter(c => c.name.toLowerCase().includes(searchVal));

        if (currentFilter === 'mine') {
            if (currentTab === 'teacher') {
                filtered = filtered.filter(c => myTeacherIds.has(c.id));
            } else {
                // Student Ticket: Check c.teacherId
                filtered = filtered.filter(c => c.teacherId && myTeacherIds.has(c.teacherId));
            }
        }

        if (filtered.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#64748b;">لا توجد محادثات</div>';
            return;
        }

        filtered.forEach(conv => {
            const div = document.createElement('div');
            div.className = `chat-item ${selectedTeacherId === conv.id ? 'active' : ''}`;
            const timeStr = conv.time ? new Date(conv.time.seconds * 1000).toLocaleDateString('ar-EG') : '';

            div.innerHTML = `
                <div class="avatar">${conv.name.charAt(0)}</div>
                <div class="info">
                    <div style="display:flex; justify-content:space-between;">
                        <span class="name">${conv.name}</span>
                        <span style="font-size:0.7rem; color:#64748b;">${timeStr}</span>
                    </div>
                    <div class="last-msg">
                        ${conv.lastMsg}
                        ${conv.unread > 0 ? `<span class="unread-badge">${conv.unread}</span>` : ''}
                    </div>
                </div>
            `;

            div.onclick = () => selectConversation(conv);
            container.appendChild(div);
        });
    }

    document.getElementById('search-teacher').addEventListener('input', () => renderList(allConversations));

    function selectConversation(conv) {
        selectedTeacherId = conv.id;
        renderList(allConversations); // Re-render to highlight active

        // Update Header
        document.getElementById('chat-header').style.visibility = 'visible';
        document.getElementById('current-name').innerText = conv.name;
        document.getElementById('current-avatar').innerText = conv.name.charAt(0);
        document.getElementById('chat-input-area').style.display = 'flex';

        if (currentTab === 'teacher') {
            loadMessages(conv.id);
        } else {
            loadStudentMessages(conv.id);
        }
    }

    function loadMessages(teacherId) {
        if (unsubscribeMessages) unsubscribeMessages();

        const q = query(
            collection(db, "support_tickets_teacher"),
            where("teacherId", "==", teacherId),
            orderBy("createdAt", "asc")
        );

        const container = document.getElementById('messages-container');

        unsubscribeMessages = onSnapshot(q, (snapshot) => {
            container.innerHTML = '';

            snapshot.forEach(docSnap => {
                const msg = docSnap.data();
                // Mark as read if from teacher
                if (msg.sender === 'teacher' && !msg.read) {
                    updateDoc(doc(db, "support_tickets_teacher", docSnap.id), { read: true });
                }

                const div = document.createElement('div');
                div.className = `message ${msg.sender === 'admin' ? 'msg-admin' : 'msg-teacher'}`;
                const time = msg.createdAt ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '...';

                div.innerHTML = `
                    ${msg.text}
                    <div class="msg-time">${time}</div>
                `;
                container.appendChild(div);
            });
            container.scrollTop = container.scrollHeight;
        });
    }

    function loadStudentMessages(ticketId) {
        if (unsubscribeMessages) unsubscribeMessages();

        const q = query(
            collection(db, "tickets", ticketId, "messages"),
            orderBy("timestamp", "asc")
        );

        const container = document.getElementById('messages-container');

        unsubscribeMessages = onSnapshot(q, (snapshot) => {
            container.innerHTML = '';

            snapshot.forEach(docSnap => {
                const msg = docSnap.data();
                // Mark as read if from student? (TODO: Need flag in msg)

                const div = document.createElement('div');
                // senderId logic... If isAdmin=true -> msg-admin.
                div.className = `message ${msg.isAdmin ? 'msg-admin' : 'msg-teacher'}`; // reusing msg-teacher for student styling
                const time = msg.timestamp ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '...';

                div.innerHTML = `
                    ${msg.text}
                    <div class="msg-time">${time}</div>
                `;
                container.appendChild(div);
            });
            container.scrollTop = container.scrollHeight;
        });
    }

    // Send Message
    const input = document.getElementById('message-input');
    const btn = document.getElementById('send-btn');

    async function send() {
        const text = input.value.trim();
        if (!text || !selectedTeacherId) return;

        input.value = '';

        try {
            if (currentTab === 'teacher') {
                const currentConvo = allConversations.find(c => c.id === selectedTeacherId);
                await addDoc(collection(db, "support_tickets_teacher"), {
                    teacherId: selectedTeacherId,
                    teacherName: currentConvo ? currentConvo.name : 'Unknown',
                    text: text,
                    sender: 'admin',
                    createdAt: serverTimestamp(),
                    read: false
                });

                // Notify Teacher
                await addDoc(collection(db, "notifications"), {
                    target: selectedTeacherId,
                    title: 'رد من الدعم الفني',
                    body: text,
                    type: 'support_reply',
                    link: 'support.html',
                    createdAt: serverTimestamp(),
                    read: false
                });

            } else {
                // STUDENT SEND
                // selectedTeacherId is ticketID here
                await addDoc(collection(db, "tickets", selectedTeacherId, "messages"), {
                    text: text,
                    senderId: auth.currentUser.uid, // Admin ID
                    isAdmin: true,
                    timestamp: serverTimestamp()
                });

                await updateDoc(doc(db, "tickets", selectedTeacherId), {
                    lastMessage: text,
                    updatedAt: serverTimestamp(),
                    // adminUnread: false
                });
            }

        } catch (e) {
            console.error(e);
            alert("خطأ في الإرسال");
        }
    }

    btn.onclick = send;
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') send();
    });

    window.openTeacherProfile = () => {
        if (selectedTeacherId) {
            window.location.href = `teachers.html?viewProfile=${selectedTeacherId}`;
            // Note: admin/teachers.html might need logic to auto-open modal if param exists.
            // I'll skip implementing that "auto open" logic for now unless requested, 
            // but the link will at least go to teachers page.
        }
    };

    // Filter Tabs Logic
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => {
                b.classList.remove('active');
                b.style.background = 'transparent';
                b.style.color = '#94a3b8';
                b.style.border = '1px solid #334155';
            });
            e.target.classList.add('active');
            e.target.style.background = '#3b82f6';
            e.target.style.color = 'white';
            e.target.style.border = 'none';

            currentFilter = e.target.dataset.filter;
            renderList(allConversations);
        };
    });

    // Main Tabs Logic
    document.querySelectorAll('.main-tab-btn').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('.main-tab-btn').forEach(b => {
                b.classList.remove('active');
                b.style.color = '#94a3b8';
                b.style.borderBottom = '2px solid transparent';
            });
            e.target.classList.add('active');
            e.target.style.color = 'white';
            e.target.style.borderBottom = '2px solid #3b82f6';

            currentTab = e.target.dataset.type;

            // Toggle Filter Visibility
            const filterTabs = document.getElementById('teacher-filters');
            filterTabs.style.display = 'flex'; // Always show filters now
            /*
            if (currentTab === 'student') {
                filterTabs.style.display = 'none';
            } else {
                filterTabs.style.display = 'flex';
            }
            */

            // Reset
            selectedTeacherId = null;
            document.getElementById('messages-container').innerHTML = '';
            document.getElementById('chat-header').style.visibility = 'hidden';
            document.getElementById('chat-input-area').style.display = 'none';

            loadConversations();
        };
    });
});
