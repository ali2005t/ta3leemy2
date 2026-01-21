/**
 * Global UI Manager
 * Handles Theme (Dark/Light) and Language (AR/EN) Toggling.
 * Usage: Import and call initGlobalUI() or use window.GlobalUI
 */

const THEME_KEY = 'ta3leemy_theme';

export const GlobalUI = {
    init() {
        this.initTheme();
        this.injectControls();
        this.exposeHelpers(); // Fix for inline onclicks
        this.initDesktopSidebar();
        this.initMobileNav(); // Inject Mobile/Tablet Toggle
        this.injectBranding(); // New Static Footer
    },

    injectBranding() {
        // Prevent duplicates
        if (document.getElementById('ta3leemy-branding')) return;

        // Target Main Content to append at the bottom of the scroll
        const container = document.querySelector('.main-content') || document.querySelector('.app-container') || document.body;

        const footer = document.createElement('div');
        footer.id = 'ta3leemy-branding';

        // Using Embedded Styles for Theme Awareness (Dark Default / Light Override)
        const styles = `
            <style>
                .branding-footer {
                    width: 100%;
                    text-align: center;
                    padding: 40px 0 30px 0;
                    margin-top: 60px;
                    opacity: 0.8;
                    font-family: 'Segoe UI', sans-serif;
                    font-size: 1rem;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 5px;
                }
                .branding-label {
                    font-size: 0.85rem;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    color: #94a3b8; /* Default Slate */
                }
                .branding-name {
                    font-size: 1.2rem;
                    font-weight: bold;
                    letter-spacing: 0.5px;
                    color: #ffffff; /* Default White */
                }
                
                /* LIGHT THEME OVERRIDES */
                body.light-theme .branding-footer {
                    border-top: 1px solid rgba(0, 0, 0, 0.1);
                }
                body.light-theme .branding-label {
                    color: #64748b; /* Darker Slate for Light Mode */
                }
                body.light-theme .branding-name {
                    color: #1e293b; /* Dark Blue/Black for Light Mode */
                }
            </style>
        `;

        footer.innerHTML = styles + `
            <div class="branding-footer">
                <span class="branding-label">Powered By</span>
                <span class="branding-name">Ta3leemy Platform</span>
            </div>
        `;

        container.appendChild(footer);
    },

    exposeHelpers() {
        window.toggleSubmenu = (id) => {
            const el = document.getElementById(id);
            if (el) el.style.display = (el.style.display === 'none' || !el.style.display) ? 'block' : 'none';
        };
        // Expose toggleTheme to window for the pull cord onclick
        window.toggleThemeGlobal = (e) => this.toggleTheme(e);
    },

    // --- Theme Logic ---
    // --- Theme Logic ---
    initTheme() {
        const savedTheme = localStorage.getItem(THEME_KEY);
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }
    },

    toggleTheme(event) {
        if (this.isToggling) return;
        this.isToggling = true;

        const willBeLight = !document.body.classList.contains('light-theme');

        // --- Water Drop / Pouring Effect (Top to Bottom) ---
        const overlay = document.createElement('div');
        overlay.id = 'theme-transition-overlay';
        Object.assign(overlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '0%', // Start empty
            backgroundColor: willBeLight ? '#f8fafc' : '#0f172a',
            zIndex: '99999',
            transition: 'height 0.6s cubic-bezier(0.4, 0, 0.2, 1)', // Smooth drop
            pointerEvents: 'none'
        });

        document.body.appendChild(overlay);

        // Trigger Drop
        requestAnimationFrame(() => {
            overlay.style.height = '100%';
        });

        // Change Theme Halfway
        setTimeout(() => {
            const isLight = document.body.classList.toggle('light-theme');
            localStorage.setItem(THEME_KEY, isLight ? 'light' : 'dark');

            // Update Toggle Icon
            this.updateThemeIcon();

            // Fade out
            setTimeout(() => {
                overlay.style.opacity = '0';
                overlay.style.transition = 'opacity 0.4s ease';
                setTimeout(() => {
                    overlay.remove();
                    this.isToggling = false;
                }, 400);
            }, 200);
        }, 600);
    },

    updateThemeIcon() {
        // Update Global Toggle
        const globalBtn = document.getElementById('header-theme-toggle');
        if (globalBtn) {
            const isLight = document.body.classList.contains('light-theme');
            globalBtn.innerHTML = isLight ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
            globalBtn.title = isLight ? "Switch to Dark Mode" : "Switch to Light Mode";
        }

        // Update Profile Page Toggle (if exists)
        const profileIcon = document.getElementById('theme-status-icon');
        if (profileIcon) {
            const isDark = !document.body.classList.contains('light-theme');
            profileIcon.className = isDark ? 'fas fa-toggle-on' : 'fas fa-toggle-off';
            profileIcon.style.color = isDark ? 'var(--app-primary, #f59e0b)' : '#cbd5e1';
        }
    },

    // --- Theme Toggle UI (Floating) ---
    // --- Header Theme Toggle ---
    initHeaderThemeToggle() {
        if (document.getElementById('header-theme-toggle')) return;

        // Target The Header Actions Container
        const actionsContainer = document.querySelector('.top-actions');
        if (!actionsContainer) return; // Wait for header

        const btn = document.createElement('div');
        btn.id = 'header-theme-toggle';
        btn.className = 'action-link'; // Match existing header style

        // Initial Icon
        const isLight = document.body.classList.contains('light-theme');
        btn.innerHTML = isLight ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
        btn.title = isLight ? "Switch to Dark Mode" : "Switch to Light Mode";

        Object.assign(btn.style, {
            cursor: 'pointer',
            fontSize: '1.2rem',
            color: 'var(--text-muted, #94a3b8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            transition: 'all 0.2s',
            marginLeft: '10px' // Space from other items
        });

        btn.onmouseover = () => { btn.style.background = 'rgba(255,255,255,0.1)'; };
        btn.onmouseout = () => { btn.style.background = 'transparent'; };

        btn.onclick = (e) => this.toggleTheme(e);

        // Prepends to be the first item (or append based on preference)
        // User asked "next to notification". Notifications are usually inside .top-actions.
        // Let's prepend it so it's on the far left of the actions group (or right in RTL).
        actionsContainer.insertBefore(btn, actionsContainer.firstChild);
    },

    // --- Controls Injection (Legacy & Profile) ---
    injectControls() {
        // 1. Header Theme Toggle (Global)
        this.initHeaderThemeToggle();

        // 2. Handle Profile Page Toggle Row (if exists)
        const toggleRow = document.getElementById('theme-toggle-row');
        if (toggleRow) {
            // ... existing profile logic ...
            const icon = document.getElementById('theme-status-icon');
            const updateIcon = () => {
                const isDark = !document.body.classList.contains('light-theme');
                if (icon) {
                    icon.className = isDark ? 'fas fa-toggle-on' : 'fas fa-toggle-off';
                    icon.style.color = isDark ? 'var(--app-primary, #f59e0b)' : '#cbd5e1';
                }
            };

            // Init
            updateIcon();

            toggleRow.onclick = (e) => {
                this.toggleTheme(e);
                updateIcon();
            };
        }

        // --- Desktop Sidebar Logic ---
        this.initDesktopSidebar();
    },

    // --- Mobile/Tablet Sidebar Logic ---
    initMobileNav() {
        // Use EXISTING Button in Header (#open-sidebar)
        const btn = document.getElementById('open-sidebar');

        if (btn) {
            // Use addEventListener to play nice with others
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Target sidebar
                const sidebar = document.getElementById('sidebar');
                if (sidebar) {
                    sidebar.classList.toggle('open');
                }
            });
        }

        // Close on outside click
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('sidebar');
            const openBtn = document.getElementById('open-sidebar');

            if (sidebar && sidebar.classList.contains('open')) {
                // If click is outside sidebar AND outside the button
                if (!sidebar.contains(e.target) && (!openBtn || !openBtn.contains(e.target))) {
                    sidebar.classList.remove('open');
                }
            }
        });
    },

    // --- Desktop Sidebar Logic ---
    initDesktopSidebar() {
        // User Request: Sidebar should NOT be open by default on desktop (behaves like mobile)
        const nav = document.querySelector('.bottom-nav'); // Sidebar container
        if (nav) {
            // Force closed on load
            nav.classList.remove('sidebar-open');
        }
    }
};

// Auto-Init: Check if DOM is already ready (common in Modules)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => GlobalUI.init());
} else {
    GlobalUI.init();
}

// Ensure Global Access
window.GlobalUI = GlobalUI;
