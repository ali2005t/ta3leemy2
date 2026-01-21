import { auth, db } from './firebase-config.js';
import { applyTheme } from './theme-loader.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    arrayUnion,
    collection,
    query,
    where,
    getDocs,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {

    // Apply Dynamic Theme Immediately
    await applyTheme();

    const urlParams = new URLSearchParams(window.location.search);
    const trainingId = urlParams.get('id');

    if (!trainingId) {
        window.location.href = 'home.html' + (window.location.hash || '');
        return;
    }


    let currentUser = null;
    let enrollmentData = null;

    // State
    let activeTab = 'units';

    // Data Cache
    let CACHE = {
        units: [],
        content: []
    };

    // Modal Elements
    const modal = document.getElementById('code-modal');
    const codeInput = document.getElementById('access-code-input');
    const modalMsg = document.getElementById('modal-msg');
    const verifyBtn = document.getElementById('verify-code-btn');
    const closeModal = document.querySelector('.close-modal');

    // Setup Modal Close
    if (closeModal) closeModal.onclick = () => modal.style.display = 'none';

    // CSS Injection (Accordion & Toggles)
    const style = document.createElement('style');
    style.innerHTML = `
        /* Default Dark Variables */
        :root { 
            --bg-page: #0f172a; 
            --bg-card: #1e293b; 
            --text-primary: #f8fafc; 
            --primary-color: #6366f1; 
        }
        
        /* Light Theme Override */
        body.light-theme { 
            --bg-page: #f8fafc; 
            --bg-card: #ffffff; 
            --text-primary: #1e293b; 
        }

        body { background-color: var(--bg-page); color: var(--text-primary); }
        
        /* TABS (Dark Default) */
        .custom-tabs { 
            display: flex; gap: 8px; overflow-x: auto; padding: 10px 10px; 
            background: var(--bg-card); /* Use var */
            border-bottom: 1px solid rgba(255,255,255,0.05); /* Dark border */
            scrollbar-width: none; position: sticky; top:0; z-index:99; 
        }
        
        /* Tab Item */
        .custom-tab { 
            padding: 10px 12px; border-radius: 12px; font-weight: 700; 
            color: #94a3b8; /* Muted text */
            cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 6px; transition: all 0.2s; font-size: 0.85rem; 
            background: rgba(255,255,255,0.05); /* Dark bg */
        }
        
        /* Light Theme Specifics for Tabs */
        body.light-theme .custom-tabs { background: white; border-bottom: 1px solid rgba(0,0,0,0.05); }
        body.light-theme .custom-tab { background: #f1f5f9; color: #64748b; }

        .custom-tab.active { color: white; background: var(--primary-color); box-shadow: 0 4px 10px rgba(99, 102, 241, 0.3); }
        
        /* List Items */
        .list-item { 
            background: var(--bg-card); 
            border-radius: 12px; padding: 16px; margin-bottom: 12px; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.2); /* Darker shadow */
            display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: transform 0.2s; border: 1px solid transparent; 
        }
        body.light-theme .list-item { box-shadow: 0 2px 4px rgba(0,0,0,0.02); }

        .list-item:active { transform: scale(0.99); }
        .item-icon { width: 40px; height: 40px; border-radius: 10px; background: rgba(99, 102, 241, 0.1); color: var(--primary-color); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; margin-left: 15px; }
        .item-info { flex: 1; }
        .item-title { font-weight: bold; color: var(--text-primary); margin-bottom: 4px; }
        .item-sub { font-size: 0.85rem; color: #94a3b8; }
        
        /* Accordion Styles */
        .accordion-item { 
            background: var(--bg-card); 
            border-radius: 12px; margin-bottom: 15px; overflow: hidden; 
            box-shadow: 0 2px 5px rgba(0,0,0,0.2); 
        }
        body.light-theme .accordion-item { box-shadow: 0 2px 5px rgba(0,0,0,0.03); }

        .accordion-header { padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; background: var(--bg-card); border-bottom: 1px solid transparent; transition: all 0.2s; }
        .accordion-header:hover { background: rgba(255,255,255,0.02); }
        body.light-theme .accordion-header:hover { background: #f8fafc; }

        .accordion-header.active { border-bottom-color: rgba(255,255,255,0.1); background: rgba(255,255,255,0.02); }
        body.light-theme .accordion-header.active { border-bottom-color: #e2e8f0; background: #f8fafc; }

        .accordion-title { font-weight: 700; color: var(--text-primary); font-size: 1.1rem; }
        .accordion-actions { display: flex; align-items: center; gap: 10px; }
        
        .accordion-body { display: none; padding: 10px 15px; background: rgba(0,0,0,0.2); }
        body.light-theme .accordion-body { background: #f8fafc; }
        
        .accordion-body.show { display: block; }
        
        .sub-item { 
            display: flex; align-items: center; padding: 12px; 
            background: var(--bg-card); 
            border-radius: 8px; margin-bottom: 8px; 
            border: 1px solid rgba(255,255,255,0.05); 
            cursor: pointer; transition: 0.2s; 
        }
        body.light-theme .sub-item { border-color: #e2e8f0; background: white; }

        .sub-item:hover { transform: translateX(-5px); border-color: var(--primary-color); }
        .sub-icon { width: 35px; height: 35px; border-radius: 8px; background: rgba(99, 102, 241, 0.1); color: var(--primary-color); display: flex; align-items: center; justify-content: center; margin-left: 15px; }
        .sub-info { flex: 1; }
        
        .btn-buy-unit { background: var(--primary-color); color: white; border: none; padding: 6px 15px; border-radius: 20px; font-size: 0.85rem; cursor: pointer; transition: 0.2s; }
        .btn-buy-unit:hover { background: #4f46e5; }
        .badge-owned { background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 15px; font-size: 0.8rem; font-weight: 600; }
        
        .locked-overlay { opacity: 0.6; pointer-events: none; }
        .locked-icon { color: #cbd5e1; }

        /* Desktop Adjustments for Sticky Header */
        @media (min-width: 1024px) {
            .custom-tabs {
                top: 75px !important; /* Below the 70px Fixed Header */
                border-radius: 0 0 16px 16px; /* Optional styling */
                z-index: 1900 !important; /* Below Header (2000) but above content */
            }
        }
    `;
    document.head.appendChild(style);


    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await checkEnrollment(user.uid, trainingId);
        }
        await loadTrainingDetails(trainingId);
        await fetchData(trainingId);
        render();
    });

    async function checkEnrollment(uid, tId) {
        try {
            const docRef = doc(db, "enrollments", `${uid}_${tId}`);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                enrollmentData = docSnap.data();
            } else {
                enrollmentData = { unlockedUnits: [], unlockedLectures: [] };
            }
        } catch (e) { console.error("Enroll Check Error", e); }
    }

    // Helper: Check if item is unlocked
    function isUnlocked(itemId, unitId) {
        if (!enrollmentData) return false;
        if (enrollmentData.type === 'training' || enrollmentData.accessType === 'full') return true;
        if (unitId && enrollmentData.unlockedUnits && enrollmentData.unlockedUnits.includes(unitId)) return true;
        if (itemId && enrollmentData.unlockedLectures && enrollmentData.unlockedLectures.includes(itemId)) return true;
        return false;
    }

    async function loadTrainingDetails(id) {
        try {
            const docSnap = await getDoc(doc(db, "training_programs", id));
            if (docSnap.exists()) {
                const data = docSnap.data();
                document.getElementById('course-title').innerText = data.title;

                // Description
                const descEl = document.getElementById('course-desc');
                if (descEl && data.description) descEl.innerText = data.description;

                // Image Logic
                const imgContainer = document.getElementById('course-img-placeholder');
                if (data.coverImage) {
                    imgContainer.innerHTML = `<img src="${data.coverImage}" style="width:100%; height:100%; object-fit:cover;" onerror="this.onerror=null; this.parentElement.innerHTML='<i class=\\'fas fa-graduation-cap\\' style=\\'font-size:4rem; opacity:0.3; color:var(--text-secondary);\\'></i>';">`;
                } else {
                    // Fallback Logic: Try Teacher Logo
                    const tId = data.teacherId || data.uid || data.ownerId || sessionStorage.getItem('currentTeacherId') || new URLSearchParams(window.location.search).get('t');
                    console.log("Debug: Training Data", data); // DEBUG
                    console.log("Debug: Resolved Teacher ID", tId); // DEBUG
                    let logoFound = false;

                    if (tId) {
                        try {
                            const teacherSnap = await getDoc(doc(db, "teachers", tId));
                            console.log("Debug: Teacher Doc Exists?", teacherSnap.exists()); // DEBUG
                            if (teacherSnap.exists()) {
                                const tData = teacherSnap.data();
                                console.log("Debug: Teacher Data", tData); // DEBUG
                                const logo = tData.logo || tData.profileImage || tData.image;
                                if (logo) {
                                    imgContainer.innerHTML = `<img src="${logo}" style="width:100%; height:100%; object-fit:cover;" onerror="this.onerror=null; this.src='../assets/images/icon-platform.png';">`;
                                    logoFound = true;
                                }
                            }
                        } catch (e) {
                            console.warn("Error fetching teacher logo:", e);
                        }
                    }

                    if (!logoFound) {
                        imgContainer.innerHTML = `<img src="../assets/images/icon-platform.png" style="width:100%; height:100%; object-fit:cover;">`;
                    }
                }
            }
        } catch (e) {
            console.error("Error loading details:", e);
            // Fallback on error
            const imgContainer = document.getElementById('course-img-placeholder');
            if (imgContainer) imgContainer.innerHTML = `<img src="../assets/images/icon-platform.png" style="width:100%; height:100%; object-fit:cover;">`;
        }
    }

    async function fetchData(tId) {
        // Fetch Units (Courses)
        const uQ = query(collection(db, "courses"), where("trainingId", "==", tId));
        const uSnap = await getDocs(uQ);
        CACHE.units = [];
        uSnap.forEach(d => CACHE.units.push({ id: d.id, ...d.data() }));
        CACHE.units.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));

        // Fetch Content (Lectures/Exams)
        const cQ = query(collection(db, "course_content"), where("trainingId", "==", tId));
        const cSnap = await getDocs(cQ);
        CACHE.content = [];
        cSnap.forEach(d => CACHE.content.push({ id: d.id, ...d.data() }));
        CACHE.content.sort((a, b) => (a.order || 0) - (b.order || 0));
    }


    function render() {
        const container = document.getElementById('content-list');
        container.innerHTML = '';

        // Tabs Header
        const tabsDiv = document.createElement('div');
        tabsDiv.className = 'custom-tabs';
        const tabs = [
            { id: 'units', label: 'الكورسات', icon: 'fa-layer-group' },
            { id: 'lectures', label: 'المحاضرات', icon: 'fa-video' },
            { id: 'exams', label: 'الامتحانات', icon: 'fa-clipboard-check' },
            { id: 'files', label: 'الملازم', icon: 'fa-book' },
            { id: 'live', label: 'اللايفات', icon: 'fa-broadcast-tower' },
            // { id: 'homework', label: 'الواجبات', icon: 'fa-pen-fancy' }, // Commented out per user request
        ];
        tabs.forEach(t => {
            const btn = document.createElement('div');
            btn.className = `custom-tab ${activeTab === t.id ? 'active' : ''}`;
            btn.innerHTML = `<i class="fas ${t.icon}"></i> ${t.label}`;
            btn.onclick = () => { activeTab = t.id; render(); };
            tabsDiv.appendChild(btn);
        });
        container.appendChild(tabsDiv);

        const listDiv = document.createElement('div');
        listDiv.style.padding = '10px';

        if (activeTab === 'units') {
            renderAccordionUnits(listDiv);
        } else if (activeTab === 'lectures') {
            // STRICT MODE: Show only valid Video Lectures.
            renderFlatList(listDiv, CACHE.content.filter(x => x.hasVideo === true && x.type === 'lecture'));
        } else if (activeTab === 'exams') {
            renderFlatList(listDiv, CACHE.content.filter(x => x.hasExams || x.type === 'exam'));
        } else if (activeTab === 'files') {
            // Show Malzamas (Type Book/PDF OR has Drive link but NO Video)
            renderFlatList(listDiv, CACHE.content.filter(x =>
                x.type === 'book' || x.type === 'pdf' || (x.hasDrive && !x.hasVideo)
            ));
        } else if (activeTab === 'live') {
            const lives = CACHE.content.filter(x => x.isLive === true || x.isLive === 'yes');
            if (lives.length > 0) {
                renderFlatList(listDiv, lives);
            } else {
                listDiv.innerHTML = '<div style="text-align:center; padding:3rem; color:#94a3b8;"><i class="fas fa-satellite-dish" style="font-size:2rem; margin-bottom:10px; opacity:0.5;"></i><p>لا توجد لايفات حالياً</p></div>';
            }
        }

        container.appendChild(listDiv);
    }

    function renderAccordionUnits(container) {
        if (CACHE.units.length === 0) {
            container.innerHTML = '<p class="text-center">لا توجد كورسات</p>';
            return;
        }

        CACHE.units.forEach(unit => {
            const isUnitUnlocked = isUnlocked(unit.id, unit.id);
            // Filter: Show only items that are videos or exams. EXPLICTLY EXCLUDE Books/PDFs even if they have video flag.
            const unitLectures = CACHE.content.filter(c =>
                c.unitId === unit.id &&
                (c.hasVideo || c.type === 'exam' || c.hasExams) &&
                c.type !== 'book' && c.type !== 'pdf'
            );

            const item = document.createElement('div');
            item.className = 'accordion-item';

            // Header
            item.innerHTML = `
                <div class="accordion-header" onclick="this.parentElement.querySelector('.accordion-body').classList.toggle('show'); this.classList.toggle('active');">
                    <div class="accordion-title">${unit.title}</div>
                    <div class="accordion-actions">
                         ${!isUnitUnlocked ?
                    `<button class="btn-buy-unit" onclick="event.stopPropagation()">
                                <i class="fas fa-shopping-cart"></i> شراء الكورس (${unit.price || 0} ج.م)
                             </button>`
                    : '<span class="badge-owned">تم الاشتراك</span>'}
                        <i class="fas fa-chevron-down"></i>
                    </div>
                </div>
                <div class="accordion-body">
                    <div class="lectures-list"></div>
                </div>
            `;

            // Buy Button Logic
            const buyBtn = item.querySelector('.btn-buy-unit');
            if (buyBtn) {
                buyBtn.onclick = (e) => {
                    e.stopPropagation();
                    openCodeModal({ id: unit.id, title: unit.title, type: 'unit', price: unit.price });
                };
            }

            // Body Content (Lectures)
            const bodyList = item.querySelector('.lectures-list');
            if (unitLectures.length === 0) {
                bodyList.innerHTML = '<p class="text-muted text-center">لا يوجد محتوى</p>';
            } else {
                unitLectures.forEach(l => {
                    const el = document.createElement('div');
                    el.className = `sub-item ${!isUnitUnlocked ? 'locked-overlay' : ''}`;

                    let icon = 'fa-play-circle';
                    if (l.type === 'exam' || l.hasExams) icon = 'fa-clipboard-check';
                    else if (l.hasDrive && !l.hasVideo) icon = 'fa-file-pdf';

                    // Prerequisite Check
                    let isLocked = false;
                    let lockedMsg = '';
                    if (l.prerequisiteId) {
                        // Check unlocked state of prereq logic...
                        // For newly designed "Buy Course" = unlock all logic, prereq inside course matters less or same?
                        // Assuming Prereq logic still holds.
                    }

                    el.innerHTML = `
                        <div class="sub-icon ${isUnitUnlocked ? '' : 'locked-icon'}"><i class="fas ${icon}"></i></div>
                        <div class="sub-info">
                            <div style="font-weight:600;">${l.title}</div>
                            <div style="font-size:0.8rem; color:#64748b;">
                                ${l.hasVideo ? 'محاضرة' : ((l.type === 'book' || l.type === 'pdf' || (l.hasDrive && !l.hasVideo)) ? 'ملزمة' : (l.type === 'exam' ? 'امتحان' : 'تقييم'))}
                            </div>
                        </div>
                        ${!isUnitUnlocked ? '<i class="fas fa-lock" style="color:#cbd5e1;"></i>' : '<i class="fas fa-chevron-left" style="color:#cbd5e1;"></i>'}
                    `;

                    el.onclick = () => {
                        if (!isUnitUnlocked) {
                            // openCodeModal(unit); // Prompt to buy unit?
                            alert("يجب شراء الكورس أولاً لمشاهدة المحتوى");
                            return;
                        }
                        // Navigate
                        if (l.videoUrl) window.location.href = `video-player.html?url=${encodeURIComponent(l.videoUrl)}&title=${encodeURIComponent(l.title)}${window.location.hash || ''}`;
                        else if (l.driveUrl) window.open(`pdf-viewer.html?url=${encodeURIComponent(l.driveUrl)}`, '_blank');
                        else if (l.type === 'exam' || l.hasExams) window.location.href = `exam-view.html?id=${l.examId || l.id}${window.location.hash || ''}`;
                    };

                    bodyList.appendChild(el);
                });
            }

            container.appendChild(item);
        });
    }

    function renderFlatList(container, items) {
        if (items.length === 0) {
            container.innerHTML = '<p class="text-center text-muted">لا يوجد عناصر</p>';
            return;
        }
        items.forEach(item => {
            const unlocked = isUnlocked(item.id, item.unitId);
            const el = document.createElement('div');
            el.className = 'list-item';

            let icon = 'fa-cube';
            if (item.isLive === true || item.isLive === 'yes') icon = 'fa-broadcast-tower';
            else if (item.type === 'lecture') icon = item.hasVideo ? 'fa-play-circle' : 'fa-file-pdf';
            else if (item.type === 'exam' || item.hasExams) icon = 'fa-clipboard-check';

            let actionHtml = '';
            if (unlocked) {
                actionHtml = '<i class="fas fa-chevron-left" style="color:#cbd5e1;"></i>';
            } else {
                if (item.price > 0) {
                    actionHtml = `<button class="btn-buy-item" style="background:#6366f1; color:white; border:none; padding:5px 12px; border-radius:15px; font-size:0.8rem; cursor:pointer;">
                                    <i class="fas fa-shopping-cart"></i> شراء (${item.price} ج.م)
                                  </button>`;
                } else {
                    actionHtml = '<i class="fas fa-lock" style="color:#cbd5e1;" title="يجب شراء الكورس أولاً"></i>';
                }
            }

            el.innerHTML = `
                 <div style="display:flex; align-items:center; width:100%;">
                    <div class="item-icon" style="${!unlocked ? 'background:#f1f5f9; color:#94a3b8;' : ''}"><i class="fas ${icon}"></i></div>
                    <div class="item-info">
                        <div class="item-title">${item.title}</div>
                        <div class="item-sub">${(item.isLive === true || item.isLive === 'yes') ? 'بث مباشر' : (item.type === 'lecture' ? 'محاضرة' : 'تقييم')} ${item.price > 0 ? `| ${item.price} ج.م` : ''}</div>
                    </div>
                    <div>${actionHtml}</div>
                 </div>
             `;

            // Click Logic
            el.onclick = (e) => {
                if (e.target.closest('.btn-buy-item')) {
                    e.stopPropagation();
                    openCodeModal({ id: item.id, title: item.title, type: item.type || 'lecture', price: item.price });
                    return;
                }

                if (!unlocked) {
                    if (item.price > 0) openCodeModal({ id: item.id, title: item.title, type: item.type || 'lecture', price: item.price });
                    else alert("هذا المحتوى مغلق. يجب شراء الكورس لفتحه.");
                    return;
                }

                // Navigate
                if (item.isLive === true || item.isLive === 'yes') {
                    console.log("Navigating to Live:", item);
                    if (item.liveUrl) {
                        const targetUrl = `live-player.html?url=${encodeURIComponent(item.liveUrl)}&title=${encodeURIComponent(item.title)}&id=${item.id}`;
                        console.log("Target URL:", targetUrl);
                        window.location.href = targetUrl;
                    }
                    else alert("رابط البث غير متوفر حالياً");
                }
                else if (item.videoUrl) window.location.href = `video-player.html?url=${encodeURIComponent(item.videoUrl)}&title=${encodeURIComponent(item.title)}${window.location.hash || ''}`;
                else if (item.driveUrl) {
                    openPdfInternal(item.title, item.driveUrl);
                }
                else if (item.type === 'exam' || item.hasExams) {
                    window.location.href = `exam-view.html?id=${item.examId || item.id}${window.location.hash || ''}`;
                }
            };

            container.appendChild(el);
        });
    }


    let currentTargetItem = null;

    function openCodeModal(item) {
        if (!modal) return;
        currentTargetItem = item;
        modal.style.display = 'flex';
        modalMsg.innerText = '';
        codeInput.value = '';
        codeInput.focus();
    }

    verifyBtn.onclick = async () => {
        if (!currentUser) {
            alert("يجب تسجيل الدخول أولاً");
            window.location.href = 'login.html' + (window.location.hash || '');
            return;
        }
        const code = codeInput.value.trim();
        if (!code) return;

        verifyBtn.disabled = true;
        verifyBtn.innerText = 'جاري التحقق...';
        modalMsg.innerText = '';

        try {
            // Check Access Code
            // 1. Available?
            // 2. Value? User Logic: "Code Value opens course...". 
            // We assume Code 'points' to this Unit or Training.

            let q = query(collection(db, "access_codes"), where("code", "==", code), where("status", "==", "available"));
            let snap = await getDocs(q);

            if (snap.empty) {
                // Check if unused?
                // Also check if code is bound to "Student Wallet" (future)?
                // For now, strict 'access_codes' collection check.
                throw new Error("الكود غير صالح");
            }

            const codeDoc = snap.docs[0];
            const codeData = codeDoc.data();

            // Validate Target
            // If code is for a specific Unit, is it THIS unit?
            // If code is 'universal' matching price?
            // User: "Code value same as course price".
            // Suggests `value` field.

            // Logic:
            // If codeData.targetId == currentTargetItem.id -> OK.
            // OR if codeData.value >= currentTargetItem.price -> OK (and consume value?).

            // Validation Logic:
            // 1. If Code has a Target ID, it MUST match the Item ID.
            // 2. If Code is Generic (Balance/Value), its Value MUST EQUAL Item Price.

            let valid = false;

            if (codeData.targetId) {
                if (codeData.targetId === currentTargetItem.id) {
                    valid = true;
                } else {
                    throw new Error("هذا الكود مخصص لمحتوى آخر");
                }
            } else {
                // Generic Value Code
                const codeVal = Number(codeData.value || 0);
                const itemPrice = Number(currentTargetItem.price || 0);

                if (codeVal === itemPrice) {
                    valid = true;
                } else {
                    if (codeVal > itemPrice) throw new Error(`قيمة الكود (${codeVal}) أكبر من سعر المحتوى (${itemPrice}). يجب استخدام كود بنفس القيمة.`);
                    else throw new Error(`قيمة الكود (${codeVal}) غير كافية لشراء المحتوى (${itemPrice}).`);
                }
            }

            // Mark Used
            await updateDoc(doc(db, "access_codes", codeDoc.id), {
                isUsed: true,
                status: 'used',
                usedBy: currentUser.uid,
                usedAt: serverTimestamp()
            });

            // Update Enrollment
            const enrollRef = doc(db, "enrollments", `${currentUser.uid}_${trainingId}`);
            const enrollSnap = await getDoc(enrollRef);

            const updates = {}; // Logic to update unlockedUnits array

            if (!enrollSnap.exists()) {
                await setDoc(enrollRef, {
                    studentId: currentUser.uid,
                    courseId: trainingId,
                    trainingId: trainingId,
                    type: 'partial',
                    unlockedUnits: [currentTargetItem.id],
                    unlockedLectures: [],
                    createdAt: serverTimestamp()
                });
            } else {
                await updateDoc(enrollRef, {
                    unlockedUnits: arrayUnion(currentTargetItem.id)
                });
            }

            modalMsg.style.color = 'green';
            modalMsg.innerText = 'تم الشراء بنجاح';
            setTimeout(() => {
                modal.style.display = 'none';
                window.location.reload();
            }, 1000);

        } catch (e) {
            modalMsg.style.color = 'red';
            modalMsg.innerText = e.message;
        } finally {
            verifyBtn.disabled = false;
            verifyBtn.innerText = 'تفعيل';
        }
    };

    async function openPdfInternal(title, url) {
        const modal = document.getElementById('pdf-modal');
        const frame = document.getElementById('pdf-frame');
        const titleEl = document.getElementById('pdf-title');
        const wm = document.getElementById('pdf-watermark');

        if (!modal || !frame) return;

        // 1. Process URL
        let finalUrl = url;
        if (finalUrl.includes('drive.google.com')) {
            if (finalUrl.includes('/view')) finalUrl = finalUrl.replace('/view', '/preview');
            else if (!finalUrl.includes('/preview')) finalUrl += '/preview';
        }

        // 2. Load
        frame.src = finalUrl;
        if (titleEl) titleEl.innerText = title;

        // 3. Watermark (Grid Pattern)
        const fillWatermark = (text) => {
            wm.innerHTML = '';
            wm.style.display = 'grid';
            wm.style.gridTemplateColumns = 'repeat(2, 1fr)';
            wm.style.gridTemplateRows = 'repeat(5, 1fr)';
            wm.style.height = '100%';
            wm.style.width = '100%';
            wm.style.position = 'absolute';
            wm.style.top = '0';
            wm.style.left = '0';
            wm.style.zIndex = '50';
            wm.style.pointerEvents = 'none';
            wm.style.overflow = 'hidden';

            for (let i = 0; i < 10; i++) {
                const div = document.createElement('div');
                div.innerText = text;
                div.style.display = 'flex';
                div.style.alignItems = 'center';
                div.style.justifyContent = 'center';
                div.style.opacity = '0.04'; // Very subtle
                div.style.transform = 'rotate(-25deg)';
                div.style.fontSize = '1.2rem';
                div.style.fontWeight = '800';
                div.style.color = 'white';
                div.style.whiteSpace = 'nowrap';
                wm.appendChild(div);
            }
        };

        if (currentUser) {
            fillWatermark(currentUser.email); // Initial
            try {
                const userSnap = await getDoc(doc(db, "students", currentUser.uid));
                if (userSnap.exists()) {
                    const d = userSnap.data();
                    const name = d.name || 'Student';
                    const phone = d.phone || currentUser.phoneNumber || '';
                    fillWatermark(`${name}\n${phone}`);
                }
            } catch (e) { console.error("WM Error", e); }
        }


        modal.style.display = 'flex';
    }

});
