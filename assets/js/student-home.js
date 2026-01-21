import { db } from './firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Constants
const params = new URLSearchParams(window.location.search);
const teacherId = params.get('t');
// Splash might not exist in all pages, safe check later
const splash = document.getElementById('splash-screen');

async function init() {
    let tid = params.get('t');
    const hash = window.location.hash.substring(2);
    const hostname = window.location.hostname;

    // 0. Resolve Custom Domain (Priority)
    // Only run if not localhost and not the main platform domains
    const mainDomains = ['localhost', '127.0.0.1', 'ta3leemy.web.app', 'ta3leemy.firebaseapp.com', 'app.ta3leemy.com', 'edu-hive-6db28.web.app', 'edu-hive.web.app'];

    // 0. Resolve Custom Domain / Subdomain (Priority)
    // A: Check for Wildcard Subdomain (e.g. sero.ta3leemy.online)
    // This allows "sero" to be the ID without a database lookup for customDomain
    const platformDomain = "ta3leemy.online"; // The main domain for subdomains
    if (!tid && hostname.endsWith(platformDomain) && hostname !== platformDomain && hostname !== `www.${platformDomain}`) {
        // Extract subdomain
        const parts = hostname.split('.');
        if (parts[0] !== 'www') {
            tid = parts[0];
            sessionStorage.setItem('currentTeacherId', tid);
            console.log("Detected Subdomain ID:", tid);
        }
    }

    // Soft check to avoid query if obviously main domain
    const isMainDomain = mainDomains.some(d => hostname.includes(d));

    if (!tid && !isMainDomain) {
        try {
            // Check cache first to avoid flicker/delay
            const cachedDomainTid = sessionStorage.getItem('domain_tid_' + hostname);
            if (cachedDomainTid) {
                tid = cachedDomainTid;
            } else {
                // Normalize hostname (remove www if needed or keep consistent with storage)
                // Currently assuming stored exactly as entered (e.g. "www.school.com")
                // We also strip 'https://' just in case, though hostname doesn't have it.

                // Firestore Query
                const ref = collection(db, "teachers");
                // We check both with and without www just in case
                const q = query(ref, where("customDomain", "in", [hostname, hostname.replace('www.', ''), 'www.' + hostname]), limit(1));

                const snap = await getDocs(q);
                if (!snap.empty) {
                    tid = snap.docs[0].id;
                    sessionStorage.setItem('domain_tid_' + hostname, tid);
                    // Also set verify status to active implicitly? No, rely on Admin.
                }
            }
        } catch (e) {
            console.error("Domain lookup failed", e);
        }
    }

    // 1. Resolve ID (Fallback)
    if (!tid) {
        if (localStorage.getItem('lastTeacherId')) {
            tid = localStorage.getItem('lastTeacherId');
        } else if (hash) {
            try {
                const nameQuery = decodeURIComponent(hash).replace(/-/g, ' ');
                let q = query(collection(db, "teachers"), where("platformName", "==", nameQuery));
                let snapshot = await getDocs(q);
                if (snapshot.empty) {
                    q = query(collection(db, "teachers"), where("appSettings.appName", "==", nameQuery));
                    snapshot = await getDocs(q);
                }
                if (!snapshot.empty) tid = snapshot.docs[0].id;
            } catch (e) {
                console.error("Hash lookup failed", e);
            }
        }
    }

    // 404
    if (!tid) {
        if (splash) splash.innerHTML = '<h1>404</h1><p style="color:white;">رابط غير صحيح</p>';
        return;
    }

    // Persistence
    sessionStorage.setItem('currentTeacherId', tid);
    localStorage.setItem('lastTeacherId', tid);

    // Clean URL
    if (params.get('t')) {
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: newUrl }, '', newUrl);
    }

    // Links
    document.querySelectorAll('a[href="login.html"]').forEach(a => a.href = `login.html?t=${tid}`);
    const regBtn = document.querySelector('a[href="register.html"]');
    if (regBtn) regBtn.href = `register.html?t=${tid}`;

    try {
        const teacherDoc = await getDoc(doc(db, "teachers", tid));
        if (teacherDoc.exists()) {
            const data = teacherDoc.data();
            const platformName = data.platformName || data.name || "منصتي";

            // Cache for sub-pages
            sessionStorage.setItem('platformName', platformName);
            if (data.platformColor) sessionStorage.setItem('platformColor', data.platformColor);

            // Update UI
            document.title = platformName;
            // Update UI - Safe Checks
            document.title = platformName;

            const splashNameEl = document.getElementById('splash-name');
            if (splashNameEl) splashNameEl.innerText = platformName;

            const platformNameEl = document.getElementById('platform-name'); // In header?
            if (platformNameEl) platformNameEl.innerText = platformName;

            const heroNameEl = document.getElementById('platform-name-hero') || document.getElementById('hero-platform-name');
            if (heroNameEl) heroNameEl.innerText = platformName;

            const footerNameEl = document.getElementById('footer-platform-name');
            if (footerNameEl) footerNameEl.innerText = platformName;

            // Set Hash
            const cleanName = platformName.replace(/\s+/g, '-');
            if (window.location.hash !== `#/${cleanName}`) {
                window.history.replaceState(null, null, `#/${cleanName}`);
            }

            // Branding
            if (data.profileImage) {
                const img = document.getElementById('platform-logo-img');
                if (img) {
                    img.src = data.profileImage;
                    img.style.display = 'block';
                    // Hide the default icon if image exists
                    const icon = document.getElementById('platform-logo-icon');
                    if (icon) icon.style.display = 'none';
                }
            }
            // 1B. Update Header Title (Platform Name)
            const headerTitleEl = document.getElementById('header-platform-title');
            if (headerTitleEl) headerTitleEl.innerText = platformName;

            // Branding Priority: Web vs App
            const urlParams = new URLSearchParams(window.location.search);
            const isAppMode = urlParams.get('mode') === 'app' ||
                window.matchMedia('(display-mode: standalone)').matches || // PWA
                window.navigator.userAgent.includes('wv'); // WebView

            let brandColor = null;

            if (isAppMode) {
                // APP MODE: App Settings > Platform Color
                brandColor = (data.appSettings && data.appSettings.brandColor) ? data.appSettings.brandColor : data.platformColor;
                document.body.classList.add('platform-app');
                document.body.classList.remove('platform-web');
            } else {
                // WEB MODE: Platform Color > App Settings
                brandColor = data.platformColor || (data.appSettings ? data.appSettings.brandColor : null);
                document.body.classList.add('platform-web');
                document.body.classList.remove('platform-app');
            }

            if (brandColor) {
                document.documentElement.style.setProperty('--primary', brandColor);
                document.documentElement.style.setProperty('--primary-color', brandColor);
                document.documentElement.style.setProperty('--app-primary', brandColor);
                document.documentElement.style.setProperty('--app-primary-hover', brandColor);
            }

            // Render Sections (Ordered)
            const sectionOrder = data.sectionOrder || ['gallery', 'location', 'bio', 'counter'];
            const mainContainer = document.querySelector('main');
            const idMap = { 'gallery': 'gallery', 'location': 'location', 'bio': 'about', 'counter': 'student-counter' };

            sectionOrder.forEach(secKey => {
                const elId = idMap[secKey];
                if (!elId) return;
                const el = document.getElementById(elId);
                if (!el) return;

                if (secKey === 'gallery') {
                    if (data.galleryImages?.length > 0 && data.showGallery) {
                        el.style.display = 'block';
                        renderGallery(data.galleryImages);
                        mainContainer.appendChild(el);
                    } else { el.style.display = 'none'; }
                }
                else if (secKey === 'location') {
                    if (data.location && data.showLocation) {
                        el.style.display = 'block';
                        document.getElementById('location-content').innerHTML = `
                            <p style="font-size:1.2rem; margin-bottom:1rem;"><i class="fas fa-map-marker-alt" style="color:var(--primary);"></i> ${data.location.address || data.location}</p>
                            ${data.location.mapUrl ? `<iframe src="${data.location.mapUrl}" width="100%" height="400" style="border:0; border-radius:20px;" allowfullscreen="" loading="lazy"></iframe>` : ''}
                        `;
                        mainContainer.appendChild(el);
                    } else { el.style.display = 'none'; }
                }
                else if (secKey === 'bio') {
                    if (data.bio) {
                        el.style.display = 'block';
                        document.getElementById('about-content').innerText = data.bio;
                        mainContainer.appendChild(el);
                    } else { el.style.display = 'none'; }
                }
                else if (secKey === 'counter') { // New Counter Support
                    if (data.studentCounter) {
                        el.style.display = 'block';
                        document.getElementById('counter-number').innerText = data.studentCounter;
                        mainContainer.appendChild(el);
                    } else { el.style.display = 'none'; }
                }
            });

            // Fallback: If counter is not in order list but exists
            if (data.studentCounter && !sectionOrder.includes('counter')) {
                const el = document.getElementById('student-counter');
                if (el) {
                    el.style.display = 'block';
                    document.getElementById('counter-number').innerText = data.studentCounter;
                }
            }

            // LOAD COURSES (Fix for Infinite Spinner)
            const teacherLogo = data.logo || data.profileImage || data.image;
            loadCourses(tid, teacherLogo);
        }
    } catch (error) {
        console.error(error);
    }

    if (splash) {
        setTimeout(() => {
            splash.style.opacity = '0';
            setTimeout(() => splash.style.display = 'none', 600);
        }, 1000);
    }
}

async function loadCourses(tid, teacherLogo) {
    const list = document.getElementById('courses-list');
    if (!list) return;

    try {
        // Query TRAINING PROGRAMS (The parent containers)
        const q = query(
            collection(db, "training_programs"),
            where("teacherId", "==", tid),
            where("status", "==", "active"),
            orderBy("order", "asc") // Support the new order field!
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            list.innerHTML = `
                <div style="text-align:center; padding:3rem; color:#94a3b8;">
                    <i class="fas fa-layer-group" style="font-size:3rem; margin-bottom:1rem; opacity:0.5;"></i>
                    <p>لا توجد دورات متاحة حالياً</p>
                </div>
            `;
            return;
        }

        list.innerHTML = '';
        const trainings = [];
        snapshot.forEach(doc => trainings.push({ id: doc.id, ...doc.data() }));

        // Group by Grade? Or just list?
        // Let's Group by 'grade' (Academic Year)
        const groups = {};
        trainings.forEach(t => {
            const gradeID = t.grade || 'general';
            // We might need to map gradeID to Name if it's an ID.
            // For now, use the ID or "عام"
            if (!groups[gradeID]) groups[gradeID] = [];
            groups[gradeID].push(t);
        });

        // Helper to get Grade Name (if we had the settings loaded, but we don't here easily)
        // We'll just display them. If grade is "1", "2", etc. we might need a map.
        // For now, just render keys.

        Object.keys(groups).sort().forEach(grade => {
            // Header
            let gradeName = grade;
            if (grade === 'general' || grade === '') gradeName = "عام";

            const lvlHeader = document.createElement('h4');
            lvlHeader.style.cssText = "margin: 20px 0 10px; color: var(--app-primary, #6366f1); font-size: 1rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 5px; width: fit-content;";
            lvlHeader.innerText = gradeName;
            list.appendChild(lvlHeader);

            groups[grade].forEach(training => {
                // Link to Training View (Content View)
                const navUrl = `course-view.html?id=${training.id}&t=${tid}`;

                const div = document.createElement('div');
                div.className = 'training-row';
                div.onclick = () => window.location.href = navUrl;
                div.innerHTML = `
                    <div style="display:flex; align-items:center; flex:1;">
                        <div class="training-logo">
                           <img src="${training.coverImage || teacherLogo || '../assets/images/icon-platform.png'}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" onerror="this.onerror=null; this.src='../assets/images/icon-platform.png';">
                        </div>
                        <div class="training-info" style="margin-right:15px; text-align:right;">
                            <div class="training-title">${training.title}</div>
                            <div class="training-meta">
                                <span class="instructor"><i class="fas fa-chalkboard-teacher"></i> ${window.sessionStorage.getItem('platformName') || 'المعلم'}</span>
                            </div>
                        </div>
                    </div>
                    <i class="fas fa-chevron-left" style="color:#cbd5e1;"></i>
                `;
                list.appendChild(div);
            });
        });

    } catch (e) {
        console.error("Load Trainings Error:", e);
        // Fallback for missing index or other error
        list.innerHTML = `<p style="text-align:center; color:red; font-size:0.8rem;">خطأ في التحميل: ${e.message}</p>`;
    }
}

function renderGallery(images) {
    const wrapper = document.getElementById('gallery-wrapper');
    wrapper.innerHTML = images.map(img => `
        <div class="swiper-slide">
            <img src="${img}" style="width:100%; height:300px; object-fit:cover; border-radius:15px; box-shadow:0 10px 20px rgba(0,0,0,0.1);">
        </div>
    `).join('');

    new Swiper('.gallery-slider', {
        slidesPerView: 1,
        spaceBetween: 30,
        centeredSlides: true,
        loop: true,
        autoplay: {
            delay: 2500,
            disableOnInteraction: false,
        },
        pagination: {
            el: '.swiper-pagination',
            clickable: true,
        },
        navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
        },
        breakpoints: {
            640: {
                slidesPerView: 1,
            },
            768: {
                slidesPerView: 2,
            },
            1024: {
                slidesPerView: 3,
            },
        }
    });
}

// Ensure init is called
init();

// --- DESKTOP SIDEBAR LOGIC IS NOW HANDLED BY global-ui.js ---
