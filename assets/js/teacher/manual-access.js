import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getEffectiveUserUid } from '../impersonation-manager.js';
// import { UIManager } from '../ui-manager.js';
const UIManager = window.UIManager;
import { initHeader } from '../header-manager.js';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    arrayUnion,
    serverTimestamp,
    getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    let selectedStudent = null;

    // --- 1. Student Search ---
    const searchInput = document.getElementById('student-search');
    const searchResults = document.getElementById('search-results');
    const selectedContainer = document.getElementById('selected-student-container');
    let debounceTimer;

    // Mobile Sidebar
    const openSidebarBtn = document.getElementById('open-sidebar');
    if (openSidebarBtn) {
        openSidebarBtn.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('active');
        });
    }

    // Check for Pre-selected Student (from Shortcut)
    const params = new URLSearchParams(window.location.search);
    if (params.has('sid')) {
        const student = {
            id: params.get('sid'),
            uid: params.get('sid'),
            name: params.get('sname'),
            email: params.get('semail')
        };
        selectStudent(student.id, student);
    }

    // Auth & Init
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            initHeader(user);
            const uid = await getEffectiveUserUid(user);
            loadPrograms(); // Initialize Programs
        } else {  // window.location.href = '../admin/login.html'; // Or teacher login
        }
    });

    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const term = e.target.value.trim();

        if (term.length < 3) {
            searchResults.style.display = 'none';
            return;
        }

        debounceTimer = setTimeout(() => searchStudents(term), 500);
    });

    async function searchStudents(term) {
        searchResults.innerHTML = '<div style="padding:10px; color:#94a3b8;">جاري البحث...</div>';
        searchResults.style.display = 'block';

        try {
            // Define collections to search
            const collections = ["users", "students"];
            const searchPromises = [];

            // Build queries for each collection
            collections.forEach(collName => {
                const ref = collection(db, collName);

                // Email
                searchPromises.push(getDocs(query(ref, where("email", ">=", term), where("email", "<=", term + '\uf8ff'))));
                // Name
                searchPromises.push(getDocs(query(ref, where("name", ">=", term), where("name", "<=", term + '\uf8ff'))));
                // FullName
                searchPromises.push(getDocs(query(ref, where("fullName", ">=", term), where("fullName", "<=", term + '\uf8ff'))));
                // Phone
                searchPromises.push(getDocs(query(ref, where("phone", ">=", term), where("phone", "<=", term + '\uf8ff'))));
                // PhoneNumber
                searchPromises.push(getDocs(query(ref, where("phoneNumber", ">=", term), where("phoneNumber", "<=", term + '\uf8ff'))));
            });

            // Execute all
            const snapshots = await Promise.all(searchPromises);

            // Merge Results (Unique by ID)
            const results = new Map();

            snapshots.forEach(snap => {
                snap.forEach(doc => {
                    // Avoid duplicates if ID exists
                    if (!results.has(doc.id)) {
                        results.set(doc.id, { id: doc.id, ...doc.data() });
                    }
                });
            });

            searchResults.innerHTML = '';
            if (results.size === 0) {
                searchResults.innerHTML = '<div style="padding:10px; color:#ef4444;">لا توجد نتائج</div>';
                return;
            }

            results.forEach((data, id) => {
                // Determine display data
                const dName = data.name || data.fullName || 'بدون اسم';
                const dPhone = data.phone || data.phoneNumber || 'لا يوجد هاتف';
                const dEmail = data.email || 'لا يوجد بريد';

                const div = document.createElement('div');
                div.className = 'search-item';
                div.innerHTML = `
                    <div style="font-weight:bold; color:white;">${dName}</div>
                    <div style="font-size:0.85rem; color:#94a3b8;">${dEmail} | ${dPhone}</div>
                `;
                div.onclick = () => selectStudent(id, data);
                searchResults.appendChild(div);
            });

        } catch (e) {
            console.error(e);
            searchResults.innerHTML = '<div style="padding:10px; color:red;">خطأ في البحث</div>';
        }
    }

    function selectStudent(uid, data) {
        selectedStudent = { uid, ...data };
        searchInput.value = '';
        searchResults.style.display = 'none';
        const dName = data.name || data.fullName || 'طالب';
        const dEmail = data.email || '';

        selectedContainer.innerHTML = `
            <div class="selected-badge">
                <i class="fas fa-user-check"></i>
                <span>${dName} (${dEmail})</span>
                <i class="fas fa-times" style="cursor:pointer; margin-right:5px;" onclick="removeStudent()"></i>
            </div>
        `;

        // Enable Next Section
        document.getElementById('course-section').style.opacity = '1';
        document.getElementById('course-section').style.pointerEvents = 'auto';
        document.getElementById('grant-btn').style.opacity = '1';
        document.getElementById('grant-btn').style.pointerEvents = 'auto';
    }

    window.removeStudent = () => {
        selectedStudent = null;
        selectedContainer.innerHTML = '';
        document.getElementById('course-section').style.opacity = '0.5';
        document.getElementById('course-section').style.pointerEvents = 'none';
        document.getElementById('grant-btn').style.opacity = '0.5';
        document.getElementById('grant-btn').style.pointerEvents = 'none';
    };


    // --- 2. Programs, Units & Lectures ---
    const programSelect = document.getElementById('program-select');
    const unitSelect = document.getElementById('unit-select');
    const unitSection = document.getElementById('unit-selection');
    const lectureSelect = document.getElementById('lecture-select');
    const lectureSection = document.getElementById('lecture-selection');

    async function loadPrograms() {
        try {
            const q = query(collection(db, "training_programs"));
            const snap = await getDocs(q);

            snap.forEach(doc => {
                const opt = document.createElement('option');
                opt.value = doc.id;
                opt.textContent = doc.data().title;
                programSelect.appendChild(opt);
            });
        } catch (e) { console.error(e); }
    }

    programSelect.addEventListener('change', async (e) => {
        const pid = e.target.value;
        unitSelect.innerHTML = '<option value="all">-- كامل البرنامج (Full Access) --</option>';
        lectureSelect.innerHTML = '<option value="all_unit">-- كامل الكورس (All Lectures in Unit) --</option>';
        lectureSection.style.display = 'none';

        if (!pid) {
            unitSection.style.display = 'none';
            return;
        }

        // Load Units (Courses)
        try {
            // Fallback: Query 'courses' AND 'units' just in case data model is split
            const qCourses = query(collection(db, "courses"), where("trainingId", "==", pid));
            const qUnits = query(collection(db, "units"), where("trainingId", "==", pid));

            const [coursesSnap, unitsSnap] = await Promise.all([
                getDocs(qCourses).catch(e => ({ empty: true, forEach: () => { } })),
                getDocs(qUnits).catch(e => ({ empty: true, forEach: () => { } }))
            ]);

            let hasCourses = false;

            const addOpt = (doc, source) => {
                hasCourses = true;
                const opt = document.createElement('option');
                opt.value = doc.id;
                // Append source for debugging if needed, but keeping it clean for now
                opt.textContent = doc.data().title;
                unitSelect.appendChild(opt);
            };

            if (!coursesSnap.empty) coursesSnap.forEach(d => addOpt(d, 'courses'));
            if (!unitsSnap.empty) unitsSnap.forEach(d => addOpt(d, 'units'));

            if (hasCourses) {
                unitSection.style.display = 'block';
            } else {
                // Keep section visible but only Full Access option? 
                // Or hide? The user expects to see content.
                // If no content, maybe just show warning?
                // For now, keep visible so they can at least grant full access.
                unitSection.style.display = 'block';
            }
        } catch (e) {
            console.error(e);
            unitSection.style.display = 'block'; // Fallback
        }
    });

    unitSelect.addEventListener('change', async (e) => {
        const uid = e.target.value;
        const pid = programSelect.value;
        lectureSelect.innerHTML = '<option value="all_unit">-- كامل الكورس (All Lectures in Unit) --</option>';

        if (uid === 'all' || !uid) {
            lectureSection.style.display = 'none';
            return;
        }

        // Load Lectures
        try {
            // Lecture is in course_content with unitId or linked via course
            // Our data model: course_content collection has trainingId and unitId
            const q = query(collection(db, "course_content"), where("trainingId", "==", pid), where("unitId", "==", uid));
            const snap = await getDocs(q);

            if (!snap.empty) {
                lectureSection.style.display = 'block';
                snap.forEach(doc => {
                    const d = doc.data();
                    if (d.type === 'lecture' || d.type === 'exam') {
                        const opt = document.createElement('option');
                        opt.value = doc.id;
                        opt.textContent = (d.type === 'exam' ? '[Exam] ' : '') + d.title;
                        lectureSelect.appendChild(opt);
                    }
                });
            } else {
                lectureSection.style.display = 'none';
            }
        } catch (e) { console.error(e); }
    });

    // --- 3. Grant Access ---
    document.getElementById('grant-btn').addEventListener('click', async () => {
        if (!selectedStudent || !programSelect.value) {
            UIManager.showToast("يرجى اختيار الطالب والبرنامج", 'error');
            return;
        }

        if (!await UIManager.showConfirm("تأكيد العملية", "هل أنت متأكد من منح الصلاحية لهذا الطالب؟")) {
            return;
        }

        // --- Limit Check (Dynamic) ---
        const teacherId = auth.currentUser.uid;
        try {
            // 1. Get Teacher's Plan & Config
            const [tDoc, configSnap] = await Promise.all([
                getDoc(doc(db, "teachers", teacherId)),
                getDoc(doc(db, "config", "pricing_v2"))
            ]);

            const tData = tDoc.data();
            const planKey = tData.subscriptionPlan || 'basic';

            let maxStudents = 100; // Basic Default
            if (configSnap.exists()) {
                const config = configSnap.data();
                if (config[planKey] && config[planKey].maxStudents !== undefined) {
                    maxStudents = config[planKey].maxStudents;
                }
            }

            // 2. Count Current Students
            if (maxStudents > 0) { // 0 = Unlimited
                const qCount = query(collection(db, "students"), where("enrolledTeachers", "array-contains", teacherId));
                const countSnap = await getCountFromServer(qCount);
                const currentCount = countSnap.data().count;

                // Check: Only block if adding a NEW student (not granting more access to existing)
                // We check if student is already counted? 
                // The current selection logic isn't verifying enrollment status explicitly here, 
                // but usually if they search and select, they might be new OR existing.
                // Robustness: checks if student ID is in the query results? 
                // For simplicity/performance: If count exceeds limit, block ALL actions for now, or fetch strict enrollment check.
                // Let's keep it simple: If you are at limit, you can't manually grant access (which implies enrollment).

                if (currentCount >= maxStudents) {
                    // Check if this specific student is ALREADY enrolled (don't block existing students getting more content)
                    // But querying that is extra read. 
                    // Let's just block to be safe/strict for upsell.
                    UIManager.showToast(`عفواً، لقد وصلت للحد الأقصى من الطلاب (${maxStudents}). يرجى ترقية الباقة.`, "error");
                    return;
                }
            }

        } catch (e) {
            console.error("Limit check failed", e);
        }
        // -------------------

        const btn = document.getElementById('grant-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التنفيذ...';
        btn.disabled = true;

        try {
            const uid = selectedStudent.uid;
            const tId = programSelect.value;
            const unitId = unitSelect.value;
            const lectureId = lectureSelect.value;

            const enrollRef = doc(db, "enrollments", `${uid}_${tId}`);
            const enrollSnap = await getDoc(enrollRef);

            let updateData = {};
            let isNew = !enrollSnap.exists();

            if (unitId === 'all') {
                // Full Access to Program
                updateData = {
                    type: 'full',
                    accessType: 'full',
                    unlockedUnits: [],
                    unlockedLectures: []
                };
            } else if (lectureId !== 'all_unit') {
                // Specific Lecture Access
                // Ensure we are in Partial Mode
                if (isNew) {
                    updateData = {
                        type: 'partial',
                        unlockedUnits: [],
                        unlockedLectures: [lectureId]
                    };
                } else {
                    updateData = {
                        unlockedLectures: arrayUnion(lectureId)
                        // Don't change type if it was full? But here we are adding permissions.
                    };
                }
            } else {
                // Full Unit Access
                if (isNew) {
                    updateData = {
                        type: 'partial',
                        unlockedUnits: [unitId],
                        unlockedLectures: []
                    };
                } else {
                    updateData = {
                        unlockedUnits: arrayUnion(unitId)
                    };
                }
            }

            // Common Fields
            updateData.studentId = uid;
            updateData.trainingId = tId;
            updateData.grantedBy = auth.currentUser.uid;
            updateData.grantedAt = serverTimestamp();

            if (isNew) {
                await setDoc(enrollRef, updateData);
            } else {
                await updateDoc(enrollRef, updateData);
            }

            showToast("تم منح الصلاحية بنجاح");

            // Reset
            removeStudent();
            programSelect.value = '';
            unitSection.style.display = 'none';
            lectureSection.style.display = 'none';

        } catch (e) {
            console.error(e);
            UIManager.showToast("حدث خطأ: " + e.message, "error");
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });

    function showToast(msg) {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.className = "toast show";
        setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
    }

});
