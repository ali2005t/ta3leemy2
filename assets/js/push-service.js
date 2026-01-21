// assets/js/push-service.js
import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const PushService = {

    /**
     * Helper: Fetch Teacher Credentials
     * @param {string} teacherId 
     */
    async getTeacherKeys(teacherId) {
        try {
            if (!teacherId) throw new Error("Teacher ID missing");
            const snap = await getDoc(doc(db, "teachers", teacherId));
            if (!snap.exists()) throw new Error("Teacher not found");

            const data = snap.data();
            const appId = data.oneSignalAppId ? data.oneSignalAppId.trim() : null;
            let apiKey = data.oneSignalApiKey ? data.oneSignalApiKey.trim() : null;

            if (!appId || !apiKey) {
                console.warn(`Teacher ${teacherId} missing OneSignal keys. Returning null.`);
                return null;
            }

            // Clean API Key
            if (apiKey.startsWith("Basic ")) {
                apiKey = apiKey.replace("Basic ", "").trim();
            }

            return { appId, apiKey };
        } catch (e) {
            console.error("Key Fetch Error:", e);
            return null;
        }
    },

    async sendToUsers(teacherId, userIds, title, message, data = {}) {
        if (!userIds || userIds.length === 0) return { success: false, error: "No users targeted" };

        console.log("🚀 PushService: Using Vercel Proxy v2.0");

        // 1. Get Keys
        const keys = await this.getTeacherKeys(teacherId);
        if (!keys) return { success: false, error: "Missing OneSignal Keys in Teacher Profile" };

        const headers = {
            "Content-Type": "application/json; charset=utf-8"
        };

        const payload = {
            app_id: keys.appId,
            include_player_ids: [], // We use external_user_id (filters)
            filters: userIds.map((uid, index) => {
                const f = { field: "tag", key: "firebase_uid", relation: "=", value: uid };
                return index === 0 ? f : [{ operator: "OR" }, f];
            }).flat(),
            headings: { en: title, ar: title },
            contents: { en: message, ar: message },
            data: data
        };

        try {
            // PROXY WORKAROUND: Pass Key in URL
            const proxyUrl = "https://ta3leemy.vercel.app/api/proxy";
            const targetUrl = "https://onesignal.com/api/v1/notifications";
            const pKey = keys.apiKey.startsWith("Basic ") ? keys.apiKey : `Basic ${keys.apiKey}`;

            const finalUrl = `${proxyUrl}?target=${encodeURIComponent(targetUrl)}&auth_key=${encodeURIComponent(pKey)}`;

            const response = await fetch(finalUrl, {
                method: "POST",
                headers: headers,
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.errors) {
                console.error("Push API Error:", result.errors);
                return { success: false, error: JSON.stringify(result.errors) };
            }

            console.log("Push Result:", result);
            return { success: true, result };

        } catch (error) {
            console.error("Push Network Error:", error);
            return { success: false, error: error.message };
        }
    },

    async sendToTeacherStudents(teacherId, title, message) {
        // 1. Get Keys
        const keys = await this.getTeacherKeys(teacherId);
        if (!keys) return { success: false, error: "Missing OneSignal Keys in Teacher Profile" };

        // DATA INTEGRITY CHECK:
        // Adjusted to support new 'os_v2_app_' keys which are longer (~100 chars).
        // We only reject if it looks like a clear error message.
        if (keys.apiKey.length > 250 || keys.apiKey.includes("Failed to load") || keys.apiKey.includes("firebase")) {
            console.error("CRITICAL: Corrupt API Key detected:", keys.apiKey);
            return { success: false, error: "CORRUPT KEY: Your OneSignal API Key in your profile is invalid (it looks like an error message). Please go to Profile and update it with the correct key." };
        }

        const headers = {
            "Content-Type": "application/json; charset=utf-8"
        };

        const payload = {
            app_id: keys.appId,
            filters: [
                { field: "tag", key: "role", relation: "=", value: "student" } // Broadcast to all students of this APP
            ],
            headings: { en: title, ar: title },
            contents: { en: message, ar: message }
        };

        try {
            // PROXY WORKAROUND: Pass Key in URL to guarantee it reaches the proxy (Header stripping bypass)
            const proxyUrl = "https://ta3leemy.vercel.app/api/proxy";
            const targetUrl = "https://onesignal.com/api/v1/notifications";
            // Check if key already has 'Basic ', if not add it
            const pKey = keys.apiKey.startsWith("Basic ") ? keys.apiKey : `Basic ${keys.apiKey}`;

            const finalUrl = `${proxyUrl}?target=${encodeURIComponent(targetUrl)}&auth_key=${encodeURIComponent(pKey)}`;

            const response = await fetch(finalUrl, {
                method: "POST",
                headers: headers,
                body: JSON.stringify(payload)
            });

            // Note: response.ok check might be needed if proxy fails, but .json() usually handles it
            const result = await response.json();

            if (result.errors || result.debug_used_token) {
                console.error("Broadcast API Error:", JSON.stringify(result, null, 2)); // Stringify for readability
                const debugMsg = result.debug_used_token ? `\n[Debug: ${result.debug_used_token}]` : "";
                return { success: false, error: JSON.stringify(result.errors) + debugMsg };
            }

            console.log("Broadcast Push Result:", result);
            return { success: true, result };

        } catch (error) {
            console.error("Broadcast Push Network Error:", error);
            console.error("Broadcast Push Network Error:", error);
            return { success: false, error: "Network/Proxy Error: " + error.message };
        }
    }
};
