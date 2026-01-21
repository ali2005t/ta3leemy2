import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, onSnapshot, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const SOUND_URI = "data:audio/mp3;base64,//uQRAAAAWMSLwUIYAAsYkXgoQwAEaYLWfkWgAI0wWs/ItAAAG84AAAD%20DTEAAAB7%20KAAAAAJDA8%20AAAAAAABREAAAABRThwm8NFbNw8kK1Y7eZ/n%2080f//BGmC1n5FoAAIwWs/ItAAAG84AAAD%20DTEAAAB7%20KAAAAAJDA8%20AAAAAAABREAAAABRThwm8NFbNw8kK1Y7eZ/n%2080f//BGmC1n5FoAAIwWs/ItAAAG84AAAD%20DTEAAAB7%20KAAAAAJDA8%20AAAAAAABREAAAABRThwm8NFbNw8kK1Y7eZ/n%2080f//";
// Note: The above is a placeholder truncated string. I will use a simple beep function or a valid short base64 in the actual file.

// Lazy-load AudioContext to avoid "prevented from starting" warnings
let audioCtx = null;
function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

function playNotificationSound() {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        // Try to resume - if blocked by browser, we ignore sound or wait for interaction
        ctx.resume().then(() => {
            playSoundOscillator(ctx);
        }).catch(err => {
            // Sshh, it's okay. Browser blocked it. 
            // We just won't play sound this time until user clicks.
        });
    } else {
        playSoundOscillator(ctx);
    }
}

function playSoundOscillator(ctx) {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, ctx.currentTime); // A4
    oscillator.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.5);
}

document.addEventListener('DOMContentLoaded', () => {
    // Inject Modal HTML
    const modalHtml = `
        <div id="welcome-back-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:9999; align-items:center; justify-content:center;">
            <div style="background:white; width:90%; max-width:400px; padding:20px; border-radius:15px; text-align:center; animation: slideUp 0.3s ease;">
                <div style="font-size:3rem; margin-bottom:10px;">👋</div>
                <h2 style="color:#1e293b; margin-bottom:10px;">مرحباً بك مجدداً!</h2>
                <p style="color:#64748b; margin-bottom:20px;">لديك إشعارات جديدة فاتتك أثناء غيابك.</p>
                <div id="missed-notifs-list" style="text-align:right; max-height:200px; overflow-y:auto; background:#f8fafc; padding:10px; border-radius:8px; margin-bottom:15px;"></div>
                <button onclick="document.getElementById('welcome-back-modal').style.display='none'" style="background:#6366f1; color:white; border:none; padding:10px 25px; border-radius:8px; pointer-events:all; cursor:pointer;">حسناً</button>
            </div>
        </div>
        <style>@keyframes slideUp { from { transform: translateY(20px); opacity:0; } to { transform: translateY(0); opacity:1; } }</style>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    onAuthStateChanged(auth, (user) => {
        if (user) {
            initNotifications(user.uid);
        }
    });

    // Request Audio Context permission on first click
    document.addEventListener('click', () => {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
    }, { once: true });
});

let unsubscribe = null;

function initNotifications(uid) {
    if (unsubscribe) unsubscribe();

    // 1. Check Last Login / View time from LocalStorage
    const lastViewed = localStorage.getItem(`last_notif_check_${uid}`);
    const lastDate = lastViewed ? new Date(lastViewed) : new Date(Date.now() - 86400000 * 7); // Default 7 days ago

    // 2. Realtime Listener
    const q = query(
        collection(db, "notifications"),
        where("target", "==", "all_students"),
        orderBy("createdAt", "desc"),
        limit(20)
    );

    // Note: If index missing, this onSnapshot might fail silently or error.
    // For safety, fallback without orderBy if needed, but let's try.

    unsubscribe = onSnapshot(q, (snapshot) => {
        let newCount = 0;
        let missedHtml = '';
        let isFirstLoad = !window.hasLoadedNotifs;

        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const data = change.doc.data();
                const notifDate = data.createdAt ? data.createdAt.toDate() : new Date();

                // If new notification (newer than last check AND not first load of page history)
                if (notifDate > lastDate) {
                    // Only count if it's genuinely new OR if we are doing the "Welcome Back" check on first load
                    if (isFirstLoad) {
                        // Welcome Back Logic (Offline catch-up)
                        missedHtml += `
                            <div style="padding:8px; border-bottom:1px solid #e2e8f0; font-size:0.9rem;">
                                <div style="font-weight:bold; color:#334155;">${data.title}</div>
                                <div style="color:#64748b; font-size:0.8rem;">${data.body}</div>
                            </div>
                        `;
                        newCount++;
                    } else {
                        // Real-time new arrival while app is open
                        playNotificationSound();
                        showToast(data.title, data.body);
                        newCount++;
                    }
                }
            }
        });

        if (isFirstLoad && newCount > 0) {
            // Show Welcome Modal
            const list = document.getElementById('missed-notifs-list');
            list.innerHTML = missedHtml;
            document.getElementById('welcome-back-modal').style.display = 'flex';
        }

        // Update Last Viewed to now
        localStorage.setItem(`last_notif_check_${uid}`, new Date().toISOString());
        window.hasLoadedNotifs = true;

        // REGISTER PUSH TAGS (MEDIAN.CO)
        registerOneSignalTags(uid);

    }, (error) => {
        console.warn("Notification listener error (likely index)", error);
    });
}

function showToast(title, body) {
    // Create Toast
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        background: white;
        padding: 15px;
        border-radius: 10px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        z-index: 10000;
        border-right: 4px solid #6366f1;
        min-width: 250px;
        animation: slideIn 0.3s ease;
    `;
    toast.innerHTML = `
        <h4 style="margin:0 0 5px 0; color:#1e293b;">${title}</h4>
        <p style="margin:0; font-size:0.9rem; color:#64748b;">${body}</p>
    `;
    document.body.appendChild(toast);

    // Play Sound
    playNotificationSound();

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// --- MEDIAN.CO / ONESIGNAL INTEGRATION ---
function registerOneSignalTags(uid) {
    const tags = {
        'firebase_uid': uid,
        'role': 'student',
        'teacher_context': sessionStorage.getItem('currentTeacherId') || 'global'
    };

    // 1. MEDIAN (GoNative) App
    if (navigator.userAgent.indexOf('gonative') > -1 || window.gonative) {
        console.log("Registering Native Tags:", tags);
        if (window.gonative && window.gonative.onesignal) {
            window.gonative.onesignal.tags.set(tags);
        } else {
            window.location.href = 'gonative://onesignal/tags/set?tags=' + encodeURIComponent(JSON.stringify(tags));
        }
    }
    // 2. WEB SDK (Browsers)
    else {
        // Ensure OneSignalDeferred is available
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(function (OneSignal) {
            console.log("Registering Web Tags:", tags);
            // Check for v16 User Namespace or fallback
            if (OneSignal.User && OneSignal.User.addTags) {
                OneSignal.User.addTags(tags);
                // VISUAL CONFIRMATION FOR USER
                console.log("✅ Tags Sent to OneSignal");
                if (!sessionStorage.getItem('notif_toast_shown')) {
                    const toast = document.createElement('div');
                    toast.innerText = "🔔 تم تفعيل الإشعارات لهذا الجهاز بنجاح!";
                    toast.style.cssText = "position:fixed; top:20px; right:20px; background:#10b981; color:white; padding:15px; z-index:99999; border-radius:8px; font-family:sans-serif;";
                    document.body.appendChild(toast);
                    setTimeout(() => toast.remove(), 5000);
                    sessionStorage.setItem('notif_toast_shown', 'true');
                }
            } else if (OneSignal.sendTags) {
                OneSignal.sendTags(tags);
            }
        });
    }
}
