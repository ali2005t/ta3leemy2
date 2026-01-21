import { db } from './firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {

    const params = new URLSearchParams(window.location.search);
    const trainingId = params.get('id');
    const teacherId = params.get('t') || sessionStorage.getItem('currentTeacherId');

    if (!trainingId) {
        alert("رابط غير صحيح");
        window.history.back();
        return;
    }

    // 1. Load Training Details
    try {
        const docRef = doc(db, "training_programs", trainingId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            const header = document.getElementById('training-header-container');
            const img = document.getElementById('header-image');
            const title = document.getElementById('header-title');
            const desc = document.getElementById('header-desc');

            header.style.display = 'block';
            title.innerText = data.title;
            desc.innerText = data.description || '';

            if (data.coverImage) {
                img.src = data.coverImage;
            } else {
                img.style.display = 'none';
            }

            // Render Courses inside this Training
            loadCourses(trainingId, teacherId);

        } else {
            document.getElementById('courses-list').innerHTML = '<p style="text-align:center;">لم يتم العثور على الدورة</p>';
        }
    } catch (e) {
        console.error("Error loading training:", e);
    }

    // 2. Load Courses Function
    async function loadCourses(parentId, tid) {
        const list = document.getElementById('courses-list');

        try {
            // Query courses where trainingId == parentId
            // And ensure published
            const q = query(
                collection(db, "courses"),
                where("trainingId", "==", parentId),
                // where("status", "==", "active"), // Assuming 'active' or 'published' logic
                orderBy("rank", "asc")
            );

            const snapshot = await getDocs(q);

            list.innerHTML = '';

            if (snapshot.empty) {
                list.innerHTML = `
                    <div style="text-align:center; padding:2rem; color:#94a3b8;">
                        <i class="fas fa-box-open" style="font-size:2rem; margin-bottom:10px; opacity:0.5;"></i>
                        <p>لا توجد وحدات مضافة بعد</p>
                    </div>
                `;
                return;
            }

            snapshot.forEach(docSnap => {
                const course = docSnap.data();
                const courseId = docSnap.id;

                // Use course-view.html as the content view
                // Pass mode or just id
                const navUrl = `course-view.html?id=${courseId}&t=${tid}`;

                const div = document.createElement('div');
                div.className = 'course-card';
                div.onclick = () => window.location.href = navUrl;

                div.innerHTML = `
                    <div class="course-icon">
                        <i class="fas fa-book-open"></i>
                    </div>
                    <div style="flex:1;">
                        <div style="font-weight:bold; font-size:1rem; color:#1e293b;">${course.title}</div>
                        <div style="font-size:0.85rem; color:#64748b;">
                           ${course.lecturesCount || 0} محاضرة 
                           ${course.price > 0 ? ` · <span style="color:#10b981; font-weight:bold;">${course.price} ج.م</span>` : ' · <span style="color:#10b981; font-weight:bold;">مجاني</span>'}
                        </div>
                    </div>
                    <i class="fas fa-chevron-left" style="color:#cbd5e1;"></i>
                `;

                list.appendChild(div);
            });

        } catch (e) {
            console.error(e);
            list.innerHTML = '<p style="text-align:center; color:red;">خطأ في تحميل المحتويات</p>';
        }
    }

});
