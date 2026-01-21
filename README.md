# 🎓 Ta3leemy - Advanced LMS Platform (منصتي التعليمية)

Ta3leemy is a state-of-the-art Learning Management System (LMS) designed for teachers and academies to host their courses, manage students, and conduct online exams with a premium, branded experience.

---

## 🌟 Key Features
*   **Multi-Theme System:** 10 Stunning layouts (Sunset, Ocean, Midnight, etc.) configurable by the teacher.
*   **PWA Support:** Installable as a native-like mobile app on Android & iOS.
*   **Subdomain Support:** Teachers get their own subdomains (e.g., `mr-ahmed.ta3leemy.online`).
*   **Code-Based Access:** Secure secure access mechanism using generated codes.
*   **Video Protection:** Advanced measures to prevent screen recording and unauthorized downloads.
*   **Automated Exams:** Auto-grading system with instant results.

---

## 📂 Project Structure

### 1. Student App (`/student-app`)
The frontend interface for students.
*   **`index.html` (Home):** Landing page with teacher's branding, hero section, and features showcase.
*   **`home.html` (Dashboard):** After login, shows enrolled courses and active lectures.
*   **`my-courses.html`:** Grid view of all subscribed courses.
*   **`course-view.html`:** The core learning interface (Video Player + PDF Viewer + Exam Links).
*   **`exam-view.html`:** Interactive exam taker with timer and auto-submit.
*   **`profile.html`:** Student settings (Name, Password, Dark Mode).

### 2. Teacher Dashboard (`/teacher`)
The command center for instructors.
*   **`dashboard.html`:** Overview of stats (Income, Students, Active Sessions).
*   **`students.html`:** Table view of all registered students with actions (Block/Edit/Delete).
*   **`courses.html` / `lectures.html`:** Content management system (Upload Videos, PDFs).
*   **`exams.html`:** Create and manage quizzes and question banks.
*   **`generate-codes.html`:** Bulk generate access codes for students to buy.
*   **`app-settings.html`:** Customize the platform look & feel (Themes, Logos, Colors).

### 3. Admin Panel (`/admin`)
For the platform owner (SaaS Master).
*   **`settings.html`:** Global platform configs.
*   **`domains.html`:** Manage custom domain requests from teachers.

---

## 🚀 Setup & Installation

1.  **Clone the Repo:**
    ```bash
    git clone https://github.com/your-repo/ta3leemy.git
    ```
2.  **Firebase Config:**
    *   Update `assets/js/firebase-config.js` with your Firebase project keys.
3.  **Local Development:**
    *   Open `index.html` with Live Server.
    *   **Note:** Subdomains work best in production. Locally, use `index.html#/teacherId`.

---

## 📱 Mobile App (PWA)
The platform is fully PWA compliant.
*   **Manifest:** `student-app/manifest.json` defines the app identity.
*   **Service Worker:** `student-app/sw.js` handles offline caching and installation.
*   **Install:** Students are prompted to "Add to Home Screen" automatically.

---

## 🎨 Layouts & Themes
Includes 10 unique themes defined in `landing-layouts.css`:
1.  **Luxe (Dark Default)**
2.  **Light (Academic)**
3.  **Bold (Creative)**
4.  **Swiss (Minimal)**
5.  **Cyber (Neon)**
6.  **Pastel (Soft)**
7.  **Sunset (Vibrant)**
8.  **Ocean (Teal/Blue)**
9.  **Forest (Green/Gold)**
10. **Midnight (Black/Gold - Premium)**

---

## 🛠 Tech Stack
*   **Frontend:** HTML5, CSS3 (Variables), Vanilla JavaScript (ES6 Modules).
*   **Backend:** Google Firebase (Firestore, Auth, Storage).
*   **Hosting:** Netlify / Vercel (Recommended).
