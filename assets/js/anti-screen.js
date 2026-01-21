/**
 * anti-screen.js
 * PROTECTS CONTENT FROM SCREENSHOTS & RECORDING
 * 
 * 1. Uses Median/GoNative 'privacy' API to block screenshots at OS level (Android/iOS).
 * 2. Adds CSS overlay when window loses focus (Alt+Tab, backgrounding).
 * 3. Disables Context Menu & Shortcuts.
 */

document.addEventListener('DOMContentLoaded', () => {

    // 1. Median/GoNative System-Level Protection (The Real Fix)
    // REQUIRES: Median "Screen Security" Plugin (Enterprise)
    function enableMedianSecurity() {
        if (navigator.userAgent.indexOf('gonative') > -1) {

            // New API (median.secureScreen)
            if (window.median && window.median.secureScreen) {
                window.median.secureScreen.set({ secure: true });
            }
            // Legacy API (gonative.privacy - unlikely to work for screen block, but kept)
            else if (window.gonative && window.gonative.privacy) {
                window.gonative.privacy.set({ enabled: true });
            }
            // URL Scheme Fallback
            else {
                window.location.href = 'median://secureScreen/set?secure=true';
            }
        }
    }
    enableMedianSecurity();

    // 2. CSS Blur Overlay (For Web/Browser Fallback)
    const overlay = document.createElement('div');
    overlay.id = 'security-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: #000; z-index: 999999; display: none;
        align-items: center; justify-content: center; color: white;
        font-family: 'Cairo', sans-serif; font-size: 1.2rem;
    `;
    overlay.innerHTML = '<div style="text-align:center"><i class="fas fa-eye-slash" style="font-size:3rem; margin-bottom:15px; color:#f59e0b;"></i><br>المحتوى محمي<br><span style="font-size:0.8rem; opacity:0.7">يمنع التصوير أو التسجيل</span></div>';
    document.body.appendChild(overlay);

    // Toggle on blur/focus
    window.addEventListener('blur', () => {
        overlay.style.display = 'flex';
    });
    window.addEventListener('focus', () => {
        overlay.style.display = 'none';
        // Re-enforce Median just in case
        if (window.gonative) window.location.href = 'gonative://privacy/set?enabled=true';
    });

    // Initial check (if document heavily hidden)
    if (document.hidden) overlay.style.display = 'flex';
    document.addEventListener('visibilitychange', () => {
        overlay.style.display = document.hidden ? 'flex' : 'none';
    });

    // 3. Disable Shortcuts (PrintScreen, Ctrl+S, etc.)
    document.addEventListener('keyup', (e) => {
        if (e.key === 'PrintScreen') {
            alert('⚠️ تنبيه: تصوير الشاشة غير مسموح به حفاظاً على حقوق الملكية.');
            copyToClipboard(); // Clear clipboard
            overlay.style.display = 'flex';
            setTimeout(() => overlay.style.display = 'none', 2000);
        }
    });

    document.addEventListener('keydown', (e) => {
        // Ctrl+P, Ctrl+S, Ctrl+U
        if (e.ctrlKey && (e.key === 'p' || e.key === 's' || e.key === 'u')) {
            e.preventDefault();
            alert('⛔ هذا الإجراء غير مسموح.');
        }
    });

    // 4. Disable Context Menu
    document.addEventListener('contextmenu', e => e.preventDefault());

    function copyToClipboard() {
        // Try to clear clipboard
        try { navigator.clipboard.writeText(''); } catch (e) { }
    }
});
