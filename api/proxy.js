export default async function handler(req, res) {
    // 1. Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-auth');

    // 2. Handle Preflight Options Request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const { target, auth_key } = req.query;

        if (!target) {
            return res.status(400).json({ error: "Missing 'target' query parameter" });
        }

        // 3. Construct Headers for the Outgoing Request
        // Priority: Query Param (Best for bypassing stripping) > Custom Header > Std Header
        let token = auth_key;
        if (!token) token = req.headers['x-auth'];
        if (!token) token = req.headers['authorization'];

        const contentType = req.headers['content-type'] || 'application/json';

        const outputHeaders = {
            'Content-Type': contentType,
            'Authorization': token // Forward the token explicitly
        };

        // 4. Forward to OneSignal
        const response = await fetch(target, {
            method: req.method,
            headers: outputHeaders,
            body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
        });

        const data = await response.json();

        // 5. Return the result
        // 5. Return the result
        if (response.status !== 200) {
            // DEBUG: Return what we sent to help diagnose
            res.status(response.status).json({
                ...data,
                debug_used_token: token ? "Token Present (Starts with " + token.substring(0, 10) + ")" : "Token Missing/Undefined",
                debug_received_query_key: auth_key ? "Yes" : "No"
            });
        } else {
            res.status(response.status).json(data);
        }

    } catch (error) {
        console.error("Proxy Error:", error);
        res.status(500).json({ error: "Proxy Failed", details: error.message });
    }
}
