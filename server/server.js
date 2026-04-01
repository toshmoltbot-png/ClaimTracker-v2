const path = require("path");
const crypto = require("crypto");
const express = require("express");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;
const RATE_LIMIT = 200;
const WINDOW_MS = 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 60000;
const UPSTREAM_CONCURRENCY = 2;
const UPSTREAM_MAX_WAIT_MS = 10000;
const ENRICH_RATE_LIMIT = 10;
const ENRICH_RATE_WINDOW_MS = 60 * 1000;
// Required env vars:
// OPENAI_API_KEY — OpenAI API key
// FIREBASE_SERVICE_ACCOUNT_JSON — Firebase service account JSON (stringified), used for Firestore REST auth
// EBAY_CLIENT_ID — eBay developer app client ID (free account at developer.ebay.com)
// EBAY_CLIENT_SECRET — eBay developer app client secret

const VISION_UPSTREAM_PROVIDER = "OpenAI";
const VISION_UPSTREAM_ENDPOINT = "chat.completions";

// Warn once at startup if Firestore auth is unavailable
let _firestoreAuthUnavailableWarned = false;
if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    console.warn("[startup] FIREBASE_SERVICE_ACCOUNT_JSON not set — enrichment idempotency will use in-memory cache only (not persistent)");
    _firestoreAuthUnavailableWarned = true;
}

function scrubHeaders(headers) {
    if (!headers || typeof headers !== "object") return {};
    const safe = { ...headers };
    const lower = (s) => String(s).toLowerCase();
    ["authorization", "x-api-key", "api-key", "cookie"].forEach((k) => {
        Object.keys(safe).forEach((h) => { if (lower(h) === lower(k)) delete safe[h]; });
    });
    return safe;
}

/** Classify upstream error into status, body, and whether status was inferred from message. Only inferred=true when upstream had no status. */
function classifyUpstreamError(err) {
    const msg = err.message || "Vision analysis failed";
    let upstreamStatus = err.status ?? err.statusCode ?? err.httpStatus ?? err.response?.status;
    let upstreamBodyRaw = msg;
    let upstreamBodyIsJson = false;

    if (err.response) {
        upstreamStatus = err.response.status ?? upstreamStatus;
        const d = err.response.data;
        if (d !== undefined && d !== null) {
            upstreamBodyIsJson = typeof d === "object";
            upstreamBodyRaw = upstreamBodyIsJson ? JSON.stringify(d) : String(d);
        } else if (err.response.statusText) {
            upstreamBodyRaw = String(err.response.statusText);
        }
    }
    if (err.code !== undefined) {
        upstreamBodyRaw = typeof err.errors !== "undefined" ? JSON.stringify({ code: err.code, errors: err.errors }) : String(err.code);
        upstreamBodyIsJson = Array.isArray(err.errors);
        if (err.response?.status) upstreamStatus = err.response.status;
        if (err.response?.data) {
            const d = err.response.data;
            upstreamBodyRaw = typeof d === "object" ? JSON.stringify(d) : String(d);
            upstreamBodyIsJson = typeof d === "object";
        }
    }

    let inferred = false;
    let inferenceReason = null;
    if (upstreamStatus == null && /429|too many|resource exhausted|quota|rate limit/i.test(msg)) {
        upstreamStatus = 429;
        inferred = true;
        inferenceReason = "message_match_rate_limit";
    }
    if (upstreamStatus == null && /503|unavailable|overloaded|backend error/i.test(msg)) {
        upstreamStatus = 503;
        inferred = true;
        inferenceReason = "message_match_unavailable";
    }
    if (upstreamStatus == null && /401|unauthorized|invalid.*api.*key|api key not valid/i.test(msg)) {
        upstreamStatus = 401;
        inferred = true;
        inferenceReason = "message_match_auth";
    }
    if (upstreamStatus == null && /403|forbidden|permission|quota.*exceeded/i.test(msg)) {
        upstreamStatus = 403;
        inferred = true;
        inferenceReason = "message_match_forbidden";
    }
    if (msg === "Upstream timeout") {
        upstreamStatus = 504;
        inferred = true;
        inferenceReason = "server_timeout";
    }

    return { upstreamStatus, upstreamBodyRaw, upstreamBodyIsJson, inferred, inferenceReason };
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const FIRESTORE_BASE = "https://firestore.googleapis.com/v1/projects/claim-tracker-54d78/databases/(default)/documents";

// Firestore rules should be:
// match /enrichments/{docId} {
//   allow read, write: if request.auth.uid == "server" || request.auth.token.iss == "<service_account_email>";
// }
// Or simply: allow read, write: if request.auth != null;
// (Service account tokens always satisfy request.auth != null in Firestore rules)

// Cache: { token: string, expiresAt: number }
let _gcloudTokenCache = null;

let _ebayToken = null;
let _ebayTokenExpiry = 0;

async function getEbayToken() {
    if (_ebayToken && Date.now() < _ebayTokenExpiry - 60_000) return _ebayToken;
    const clientId = process.env.EBAY_CLIENT_ID;
    const clientSecret = process.env.EBAY_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    try {
        const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
            method: "POST",
            headers: {
                Authorization: `Basic ${creds}`,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
            signal: AbortSignal.timeout(8000)
        });
        if (!res.ok) return null;
        const data = await res.json();
        _ebayToken = data.access_token;
        _ebayTokenExpiry = Date.now() + (data.expires_in || 7200) * 1000;
        return _ebayToken;
    } catch (err) {
        console.warn("eBay token error:", err.message);
        return null;
    }
}

async function fetchEbayComps(brand, model, category) {
    const token = await getEbayToken();
    if (!token) return [];
    const query = [brand, model].filter(Boolean).join(" ").trim();
    if (!query) return [];
    try {
        const params = new URLSearchParams({
            q: query,
            limit: "8",
            sort: "price",
            filter: "buyingOptions:{FIXED_PRICE},itemLocationCountry:US"
        });
        const res = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`, {
            headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" },
            signal: AbortSignal.timeout(8000)
        });
        if (!res.ok) return [];
        const data = await res.json();
        const items = (data.itemSummaries || []).map(item => ({
            title: item.title,
            price: parseFloat(item.price?.value || 0),
            currency: item.price?.currency || "USD",
            condition: item.condition || "Unknown",
            url: item.itemWebUrl
        })).filter(i => i.price > 0);
        return items;
    } catch (err) {
        console.warn("eBay comps error:", err.message);
        return [];
    }
}
function warnFirestoreAuthOnce(message) {
    if (_firestoreAuthUnavailableWarned) return;
    console.warn(message);
    _firestoreAuthUnavailableWarned = true;
}

function base64urlEncode(buf) {
    return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function mintServiceAccountJwt(serviceAccount) {
    const now = Math.floor(Date.now() / 1000);
    const header = base64urlEncode(Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })));
    const payload = base64urlEncode(Buffer.from(JSON.stringify({
        iss: serviceAccount.client_email,
        sub: serviceAccount.client_email,
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
        scope: "https://www.googleapis.com/auth/datastore"
    })));
    const signingInput = `${header}.${payload}`;
    const sign = crypto.createSign("RSA-SHA256");
    sign.update(signingInput);
    const sig = base64urlEncode(sign.sign(serviceAccount.private_key));
    return `${signingInput}.${sig}`;
}

async function getFirestoreToken() {
    const now = Date.now();
    if (_gcloudTokenCache && _gcloudTokenCache.expiresAt > now + 60_000) {
        return _gcloudTokenCache.token;
    }
    const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!svcJson) {
        return null;
    }
    let serviceAccount;
    try {
        serviceAccount = JSON.parse(svcJson);
    } catch (e) {
        warnFirestoreAuthOnce(`[startup] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: ${e.message}`);
        return null;
    }
    const jwt = mintServiceAccountJwt(serviceAccount);
    try {
        const res = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
            signal: AbortSignal.timeout(8000)
        });
        if (!res.ok) {
            const text = await res.text();
            warnFirestoreAuthOnce(`[startup] Firestore token exchange failed: ${res.status} ${text}`);
            return null;
        }
        const data = await res.json();
        _gcloudTokenCache = {
            token: data.access_token,
            expiresAt: now + (data.expires_in || 3600) * 1000
        };
        return _gcloudTokenCache.token;
    } catch (err) {
        warnFirestoreAuthOnce(`[startup] getFirestoreToken error: ${err.message || err}`);
        return null;
    }
}

function firestoreSerializeValue(value) {
    if (value === null) return { nullValue: null };
    if (typeof value === "string") return { stringValue: value };
    if (typeof value === "number") {
        if (Number.isInteger(value)) return { integerValue: String(value) };
        return { doubleValue: value };
    }
    if (typeof value === "boolean") return { booleanValue: value };
    if (Array.isArray(value)) {
        return { arrayValue: { values: value.map((entry) => firestoreSerializeValue(entry)) } };
    }
    if (typeof value === "object") {
        const fields = {};
        Object.entries(value).forEach(([key, val]) => {
            if (typeof val === "undefined") return;
            fields[key] = firestoreSerializeValue(val);
        });
        return { mapValue: { fields } };
    }
    return { nullValue: null };
}

function firestoreSerialize(obj) {
    if (!obj || typeof obj !== "object") return {};
    const fields = {};
    Object.entries(obj).forEach(([key, val]) => {
        if (typeof val === "undefined") return;
        fields[key] = firestoreSerializeValue(val);
    });
    return fields;
}

function firestoreDeserializeValue(value) {
    if (!value || typeof value !== "object") return null;
    if (Object.prototype.hasOwnProperty.call(value, "stringValue")) return value.stringValue;
    if (Object.prototype.hasOwnProperty.call(value, "doubleValue")) return Number(value.doubleValue);
    if (Object.prototype.hasOwnProperty.call(value, "integerValue")) return Number(value.integerValue);
    if (Object.prototype.hasOwnProperty.call(value, "booleanValue")) return Boolean(value.booleanValue);
    if (Object.prototype.hasOwnProperty.call(value, "nullValue")) return null;
    if (Object.prototype.hasOwnProperty.call(value, "timestampValue")) return value.timestampValue;
    if (Object.prototype.hasOwnProperty.call(value, "mapValue")) {
        const mapFields = value.mapValue?.fields || {};
        const result = {};
        Object.entries(mapFields).forEach(([key, val]) => {
            result[key] = firestoreDeserializeValue(val);
        });
        return result;
    }
    if (Object.prototype.hasOwnProperty.call(value, "arrayValue")) {
        const values = value.arrayValue?.values || [];
        return values.map((entry) => firestoreDeserializeValue(entry));
    }
    return null;
}

function firestoreDeserialize(doc) {
    if (!doc || typeof doc !== "object") return null;
    const fields = doc.fields || (doc.mapValue?.fields ? doc.mapValue.fields : null);
    if (!fields || typeof fields !== "object") return null;
    const result = {};
    Object.entries(fields).forEach(([key, val]) => {
        result[key] = firestoreDeserializeValue(val);
    });
    return result;
}

async function firestoreGetEnrichment(docId) {
    // docId = `${itemId}_${enrichmentAttemptId}`
    const token = await getFirestoreToken();
    if (!token) return null;
    const url = `${FIRESTORE_BASE}/enrichments/${encodeURIComponent(docId)}`;
    try {
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(5000)
        });
        if (!res.ok) return null;
        const body = await res.json();
        // Firestore REST returns { fields: { ... } } - deserialize it
        return firestoreDeserialize(body);
    } catch (err) {
        console.warn("firestoreGetEnrichment failed", err.message || err);
        return null;
    }
}

async function firestoreSetEnrichment(docId, data) {
    const token = await getFirestoreToken();
    if (!token) return;
    const url = `${FIRESTORE_BASE}/enrichments/${encodeURIComponent(docId)}`;
    try {
        const body = { fields: firestoreSerialize(data) };
        const res = await fetch(url, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(5000)
        });
        if (!res.ok) {
            const text = await res.text();
            console.warn("firestoreSetEnrichment failed", res.status, text);
        }
    } catch (err) {
        console.warn("firestoreSetEnrichment error", err.message || err);
    }
}

function buildReceiptPrompt() {
    return [
        "STRICT IMAGE SCOPE",
        "You are stateless. Use ONLY the provided image. Do not use memory or prior images.",
        "",
        "TASK",
        "Extract receipt details.",
        "",
        "OUTPUT",
        "Return ONLY valid JSON. No markdown. No commentary.",
        "",
        "OUTPUT SCHEMA",
        "{",
        '  "store": "string_or_empty",',
        '  "date": "string_or_empty",',
        '  "items": [ { "name": "string", "quantity": 1, "unitPrice": 0, "totalPrice": 0 } ],',
        '  "receiptTotal": 0',
        "}"
    ].join("\n");
}

function buildEnrichPrompt({ baseline, userInput, ebaySection }) {
    const lines = [
        "Return ONLY valid JSON. No markdown. No commentary.",
        "",
        "CONTEXT",
        `Baseline estimate: $${Number(baseline?.value || 0).toFixed(2)} (confidence ${Number(baseline?.confidence || 0).toFixed(2)}).`,
        "",
        "USER-CONFIRMED DETAILS (AUTHORITATIVE — these override visual assumptions)",
        "The homeowner has confirmed the following details. These are GROUND TRUTH and must take priority over any visual inferences from the photos.",
        "If the homeowner states the item was new or in perfect condition, do NOT claim signs of wear unless damage from the covered loss is visible.",
        `Brand: ${userInput?.brand || "Unknown"}`,
        `Model: ${userInput?.model || "Unknown"}`,
        `Reference/SKU: ${userInput?.sku || "Not provided"}`,
        `Material: ${userInput?.material || "Not provided"}`,
        `Condition (pre-loss): ${userInput?.condition || "Unknown"}`,
        `Box/Papers Included: ${userInput?.hasBox ? "Yes" : "No"}`,
        `Serial Visible: ${userInput?.serialVisible ? "Yes" : "No"}`,
        `Owner Notes: ${userInput?.notes || "None"}`,
        "IMPORTANT: Owner Notes contain critical context. Factor them directly into your valuation and justification. If notes state the item was new/pristine/unused, value it at full retail replacement cost with NO depreciation for wear."
    ];
    if (ebaySection) {
        lines.push("", ebaySection);
    }
    lines.push(
        "",
        "OUTPUT SCHEMA",
        "{",
        '  "revised": {',
        '    "identification": "Specific item name with brand/model (e.g., Apple iPhone 14 Pro 256GB Space Black)",',
        '    "value": 0,',
        '    "valueLow": 0,',
        '    "valueHigh": 0,',
        '    "confidence": 0.0,',
        '    "justification": "string",',
        '    "contaminationJustification": "IICRC S500 contamination disposition — describe material porosity, exposure pathway (direct contact, airborne, airflow through ventilation), and sanitation feasibility conclusion",',
        '    "timestamp": "ISO-8601 string",',
        '    "source": "ai"',
        "  }",
        "}"
    );
    return lines.join("\n");
}

function buildJustifyPrompt({ fixedPrice, replacementLink, userInput, baseline, ebaySection }) {
    const fixed = Number(fixedPrice);
    const fixedDisplay = Number.isFinite(fixed) ? fixed.toFixed(2) : "0.00";
    const lines = [
        "Return ONLY valid JSON. No markdown. No commentary.",
        "",
        "CONTEXT",
        `The replacement cost is FIXED at $${fixedDisplay}. Do NOT change this price.`,
        "Write a justification explaining why this price is appropriate for replacing this item with a new item of like kind and quality.",
        "Include the specific product, retailer, and price in your justification.",
        `Baseline estimate (for reference only): $${Number(baseline?.value || 0).toFixed(2)} (confidence ${Number(baseline?.confidence || 0).toFixed(2)}).`,
        "",
        "USER-CONFIRMED DETAILS (AUTHORITATIVE — these override visual assumptions)",
        "The homeowner has confirmed the following details. These are GROUND TRUTH and must take priority over any visual inferences from the photos.",
        "If the homeowner states the item was new or in perfect condition, do NOT claim signs of wear unless damage from the covered loss is visible.",
        `Brand: ${userInput?.brand || "Unknown"}`,
        `Model: ${userInput?.model || "Unknown"}`,
        `Reference/SKU: ${userInput?.sku || "Not provided"}`,
        `Material: ${userInput?.material || "Not provided"}`,
        `Condition (pre-loss): ${userInput?.condition || "Unknown"}`,
        `Box/Papers Included: ${userInput?.hasBox ? "Yes" : "No"}`,
        `Serial Visible: ${userInput?.serialVisible ? "Yes" : "No"}`,
        `Owner Notes: ${userInput?.notes || "None"}`,
        "IMPORTANT: Owner Notes contain critical context. Factor them directly into your justification. If notes state the item was new/pristine/unused, justify full retail replacement cost with NO depreciation for wear."
    ];
    if (replacementLink) {
        lines.push("", `Replacement source: ${replacementLink}`);
    }
    if (ebaySection) {
        lines.push("", ebaySection);
    }
    lines.push(
        "",
        "OUTPUT SCHEMA",
        "{",
        '  "revised": {',
        '    "identification": "Specific item name with brand/model (e.g., Apple iPhone 14 Pro 256GB Space Black)",',
        '    "value": 0,',
        '    "valueLow": 0,',
        '    "valueHigh": 0,',
        '    "confidence": 0.0,',
        '    "justification": "string",',
        '    "contaminationJustification": "IICRC S500 contamination disposition — describe material porosity, exposure pathway (direct contact, airborne, airflow through ventilation), and sanitation feasibility conclusion",',
        '    "timestamp": "ISO-8601 string",',
        '    "source": "ai"',
        "  }",
        "}",
        "",
        `CRITICAL: revised.value MUST equal $${fixedDisplay}.`
    );
    return lines.join("\n");
}

function validateEnrichPayload(payload) {
    return payload && typeof payload === "object" && payload.revised && typeof payload.revised === "object";
}


function validateReceiptPayload(payload) {
    return payload && typeof payload === "object" && Array.isArray(payload.items);
}

function validateContractorReportPayload(payload) {
    return payload && typeof payload === "object" && typeof payload.companyName === "string";
}

function normalizePrescreenResult(payload) {
    const rawType = String(payload.type || "").toLowerCase().trim().replace(/\s+/g, "_");
    const type = rawType === "room_scan" ? "room_scan" : "focus_item";
    let subject = typeof payload.subject === "string" ? payload.subject.trim() : "";
    if (!subject) subject = type === "room_scan" ? "room overview" : "item";
    subject = subject.split(/\s+/).slice(0, 6).join(" ");
    let confidence = Number(payload.confidence);
    if (!Number.isFinite(confidence)) confidence = 0.5;
    confidence = Math.min(1, Math.max(0, confidence));
    return { type, subject, confidence };
}

function normalizeEnrichResult(payload, baseline, enrichmentAttemptId, ebayMeta = {}) {
    const revised = payload?.revised && typeof payload.revised === "object" ? payload.revised : payload;
    const toNumber = (val, fallback) => {
        const num = Number(val);
        return Number.isFinite(num) ? num : fallback;
    };
    const baseVal = toNumber(baseline?.value, 0);
    const value = toNumber(revised?.value, baseVal);
    const valueLow = toNumber(revised?.valueLow, Math.max(0, value * 0.9));
    const valueHigh = toNumber(revised?.valueHigh, Math.max(valueLow, value * 1.1));
    let confidence = toNumber(revised?.confidence, toNumber(baseline?.confidence, 0.5));
    confidence = Math.min(1, Math.max(0, confidence));
    const justification = String(revised?.justification || "").trim() || "Estimate refined using owner-confirmed details and photos.";
    const timestamp = revised?.timestamp && !isNaN(Date.parse(revised.timestamp)) ? revised.timestamp : new Date().toISOString();
    const source = revised?.source === "ai" ? "ai" : "ai";
    const flagged = baseVal > 0 ? value > baseVal * 5 : false;
    // Preserve identification if AI returned a more specific name
    const identification = typeof revised?.identification === "string" && revised.identification.trim().length > 2
        ? revised.identification.trim()
        : null;
    
    return {
        revised: {
            identification,
            value,
            valueLow,
            valueHigh,
            confidence,
            justification,
            timestamp,
            source
        },
        flagged,
        enrichmentAttemptId,
        comps: Array.isArray(ebayMeta.comps) ? ebayMeta.comps : [],
        ebayMedian: Number.isFinite(ebayMeta.ebayMedian) ? ebayMeta.ebayMedian : null,
        ebayLow: Number.isFinite(ebayMeta.ebayLow) ? ebayMeta.ebayLow : null,
        ebayHigh: Number.isFinite(ebayMeta.ebayHigh) ? ebayMeta.ebayHigh : null
    };
}

async function requestOpenAIJson({ messages, maxTokens, temperature, log, purpose, validate }) {
    let lastErr;
    for (let attempt = 1; attempt <= 2; attempt++) {
        const upstreamPromise = openai.chat.completions.create({
            model: "gpt-4o",
            temperature,
            max_tokens: maxTokens,
            response_format: { type: "json_object" },
            messages
        });
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Upstream timeout")), UPSTREAM_TIMEOUT_MS)
        );
        const result = await Promise.race([upstreamPromise, timeoutPromise]);
        const text = result?.choices?.[0]?.message?.content || "";
        log({ event: "openai_raw_response", purpose, attempt, chars: text.length, preview: text.slice(0, 1200) });
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (err) {
            lastErr = new Error("Invalid JSON from OpenAI");
            lastErr.isInvalidJson = true;
            lastErr.raw = text;
            if (attempt < 2) continue;
            throw lastErr;
        }
        if (validate && !validate(parsed)) {
            lastErr = new Error("Invalid JSON schema from OpenAI");
            lastErr.isInvalidJson = true;
            lastErr.raw = text;
            if (attempt < 2) continue;
            throw lastErr;
        }
        return parsed;
    }
    throw lastErr;
}

app.use(express.json({ limit: "12mb" }));

// CORS for cross-origin requests (e.g. rich-archer.com embedding, Render app)
app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowed = [
        'https://www.rich-archer.com',
        'https://rich-archer.com',
        'https://claimtracker-ra-web.onrender.com',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5173'
    ];
    if (origin && allowed.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// In production, serve the Vite-built client
const clientDistPath = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDistPath));

const rateState = new Map();
const enrichRateState = new Map();
const metricsRateState = new Map();
const enrichCache = new Map();

/** In-memory semaphore: at most UPSTREAM_CONCURRENCY generateContent calls at once. Wait up to UPSTREAM_MAX_WAIT_MS or reject with server_busy_try_again. */
const upstreamSemaphore = {
    inFlight: 0,
    queue: [],
    acquire() {
        return new Promise((resolve, reject) => {
            if (this.inFlight < UPSTREAM_CONCURRENCY) {
                this.inFlight += 1;
                resolve();
                return;
            }
            const entry = { resolve, reject };
            this.queue.push(entry);
            entry.timer = setTimeout(() => {
                const i = this.queue.indexOf(entry);
                if (i !== -1) {
                    this.queue.splice(i, 1);
                    const err = new Error("server_busy_try_again");
                    err.statusCode = 503;
                    reject(err);
                }
            }, UPSTREAM_MAX_WAIT_MS);
        });
    },
    release() {
        this.inFlight = Math.max(0, this.inFlight - 1);
        while (this.queue.length > 0 && this.inFlight < UPSTREAM_CONCURRENCY) {
            const entry = this.queue.shift();
            if (entry.timer) clearTimeout(entry.timer);
            this.inFlight += 1;
            entry.resolve();
        }
    }
};

function rateLimiter(req, res, next) {
    const now = Date.now();
    const ip = req.ip || req.connection?.remoteAddress || "unknown";
    const entry = rateState.get(ip) || { count: 0, resetAt: now + WINDOW_MS };
    if (now > entry.resetAt) {
        entry.count = 0;
        entry.resetAt = now + WINDOW_MS;
    }
    entry.count += 1;
    rateState.set(ip, entry);
    if (entry.count > RATE_LIMIT) {
        return res.status(429).json({ error: "Rate limit exceeded. Try again soon." });
    }
    return next();
}

function maximizerMetricsRateLimiter(req, res, next) {
    const now = Date.now();
    const token = String(req.body?.sessionToken || "").slice(0, 64) || (req.ip || req.connection?.remoteAddress || "unknown");
    const entry = metricsRateState.get(token) || { count: 0, resetAt: now + 60000 };
    if (now > entry.resetAt) {
        entry.count = 0;
        entry.resetAt = now + 60000;
    }
    entry.count += 1;
    metricsRateState.set(token, entry);
    if (entry.count > 10) {
        return res.status(429).json({ error: "Rate limit exceeded. Try again soon." });
    }
    return next();
}

function checkEnrichRateLimit(itemId) {
    const now = Date.now();
    const key = String(itemId || "unknown");
    const entry = enrichRateState.get(key) || { count: 0, resetAt: now + ENRICH_RATE_WINDOW_MS };
    if (now > entry.resetAt) {
        entry.count = 0;
        entry.resetAt = now + ENRICH_RATE_WINDOW_MS;
    }
    entry.count += 1;
    enrichRateState.set(key, entry);
    if (entry.count > ENRICH_RATE_LIMIT) {
        const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
        return { allowed: false, retryAfter };
    }
    return { allowed: true };
}

app.post("/api/enrich-item", rateLimiter, async (req, res) => {
    const requestId = crypto.randomUUID();
    const startMs = Date.now();
    const log = (obj) => console.log(JSON.stringify({ ...obj, requestId, endpoint: "enrich_item" }));

    const rawBody = req.body || {};
    const itemId = rawBody.itemId;
    const enrichmentAttemptId = rawBody.enrichmentAttemptId;
    const baseline = rawBody.baseline || {};
    const userInput = rawBody.userInput || {};
    const justifyMode = rawBody.justifyMode === true;
    const fixedPrice = Number(rawBody.fixedPrice);
    const replacementLink = typeof rawBody.replacementLink === "string" ? rawBody.replacementLink.trim() : "";
    // images[] is optional when itemId is present — server resolves stored images from imageUrls[]
    const images = Array.isArray(rawBody.images) ? rawBody.images : [];
    // imageUrls[] = Firebase Storage URLs the client passes for stored item photos (no re-upload needed)
    const imageUrls = Array.isArray(rawBody.imageUrls) ? rawBody.imageUrls : [];

    if (!itemId || !enrichmentAttemptId) {
        log({ event: "enrich_item", status: 400, error: "missing itemId or enrichmentAttemptId" });
        return res.status(400).json({ error: "itemId and enrichmentAttemptId are required", requestId });
    }
    if (justifyMode && !Number.isFinite(fixedPrice)) {
        log({ event: "enrich_item", status: 400, error: "justifyMode requires fixedPrice", itemId });
        return res.status(400).json({ error: "fixedPrice is required when justifyMode is true", requestId });
    }

    const rate = checkEnrichRateLimit(itemId);
    if (!rate.allowed) {
        res.setHeader("Retry-After", String(rate.retryAfter || 30));
        log({ event: "enrich_item_rate_limited", status: 429, itemId, retryAfter: rate.retryAfter });
        return res.status(429).json({ error: "Rate limit exceeded for item", requestId, retryAfter: rate.retryAfter });
    }

    const docId = `${itemId}_${enrichmentAttemptId}`;
    if (enrichCache.has(docId)) {
        const cached = enrichCache.get(docId);
        log({ event: "enrich_item_cache_hit", status: 200, itemId, cached: true });
        return res.status(200).json(cached);
    }

    const stored = await firestoreGetEnrichment(docId);
    if (stored) {
        enrichCache.set(docId, stored);
        log({ event: "enrich_item_firestore_cache_hit", status: 200, itemId, cached: true });
        return res.status(200).json(stored);
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        log({ event: "enrich_item", status: 500, error: "OPENAI_API_KEY is not set" });
        return res.status(500).json({ error: "OPENAI_API_KEY is not set", requestId });
    }

    const ebayCompsPromise = fetchEbayComps(userInput.brand, userInput.model, userInput.category);

    // Resolve images: priority = passed base64 images[] → fetch imageUrls[] from storage
    let resolvedImages = images.map((img) => {
        if (typeof img !== "string") return null;
        const trimmed = img.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith("data:")) return trimmed;
        return `data:image/jpeg;base64,${trimmed}`;
    }).filter(Boolean);

    // If no base64 images passed, fetch from imageUrls[] (Firebase Storage or any HTTPS URL)
    if (!resolvedImages.length && imageUrls.length) {
        log({ event: "enrich_item_fetch_stored_images", itemId, count: imageUrls.length });
        const fetched = await Promise.all(imageUrls.map(async (url) => {
            if (!url || typeof url !== "string") return null;
            // If already a data URL, use as-is
            if (url.startsWith("data:")) return url;
            try {
                const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
                if (!res.ok) return null;
                const contentType = res.headers.get("content-type") || "image/jpeg";
                const buf = await res.arrayBuffer();
                const b64 = Buffer.from(buf).toString("base64");
                return `data:${contentType};base64,${b64}`;
            } catch (err) {
                log({ event: "enrich_item_image_fetch_error", url: url.substring(0, 80), error: err.message });
                return null;
            }
        }));
        resolvedImages = fetched.filter(Boolean);
    }

    // Validation: require itemId (already checked) OR at least one image
    // If itemId present but no images could be resolved, proceed text-only (eBay comps + userInput still valid)
    if (!resolvedImages.length && !images.length && !imageUrls.length) {
        log({ event: "enrich_item", status: 400, error: "provide images[] or imageUrls[] — or itemId alone for text-only repricing" });
        // Don't hard-fail — allow text-only enrichment if itemId is present
        log({ event: "enrich_item_text_only_mode", itemId });
    }

    const ebayComps = await ebayCompsPromise;
    const ebayPrices = ebayComps.map(c => c.price).filter(p => p > 0);
    const ebayMedian = ebayPrices.length ? ebayPrices.sort((a, b) => a - b)[Math.floor(ebayPrices.length / 2)] : null;
    const ebayLow = ebayPrices.length ? Math.min(...ebayPrices) : null;
    const ebayHigh = ebayPrices.length ? Math.max(...ebayPrices) : null;
    const ebayQueryLabel = [userInput.brand, userInput.model].filter(Boolean).join(" ").trim() || "item";
    const ebaySection = ebayComps.length > 0
        ? `eBay Market Comparables (current US listings for "${ebayQueryLabel}"):\n` +
          ebayComps.slice(0, 5).map(c => `- ${c.title}: $${c.price.toFixed(2)} (${c.condition})`).join("\n") +
          `\nMedian eBay price: $${ebayMedian?.toFixed(2) || "N/A"} | Range: $${ebayLow?.toFixed(2) || "N/A"} - $${ebayHigh?.toFixed(2) || "N/A"}\n` +
          "Use these real market prices to calibrate your replacement cost estimate. Replacement cost should reflect new/retail price, not resale — but use these comps to validate your estimate is in a realistic range."
        : "";

    const promptText = justifyMode
        ? buildJustifyPrompt({ fixedPrice, replacementLink, userInput, baseline, ebaySection })
        : buildEnrichPrompt({ baseline, userInput, ebaySection });

    const messages = [
        {
            role: "system",
            content: "You are a replacement cost valuation expert operating under a Replacement Cost (RCV) homeowners insurance policy framework. You have been given images of an item plus structured details confirmed by the owner. Determine the full retail cost today to purchase a NEW item of like kind and quality from a major U.S. retailer or authorized manufacturer source. Ignore resale, auction, liquidation, refurbished, or used-market listings unless the item is discontinued and unavailable new. Use standard retail pricing, not temporary sale, clearance, or promotional pricing unless that pricing is consistently available. If multiple models exist, select the closest current-generation equivalent at equal or superior specifications. Do not downgrade features, materials, capacity, or performance tier. If the exact item is discontinued, identify the closest modern equivalent that meets or exceeds original specifications. Include shipping and applicable sales tax. If the owner confirms the item was new, pristine, or unused prior to loss, value at full retail with no discounting. Do NOT average down using lower-tier variants. Return a precise, specific replacement valuation.\n\nAdditionally, generate a contamination disposition justification for insurance adjuster review based on IICRC S500 standards for Category 3 sewage.\n\nCRITICAL: Be FACTUAL ONLY. State only what is known: the item was in a room affected by Category 3 sewage backup, its material type, and the applicable IICRC S500 standard. Do NOT fabricate details like whether a device was 'operating', 'plugged in', or had specific contamination pathways. Do NOT claim items were on specific surfaces. Keep it simple and honest.\n\nClassify the item by material type:\n- POROUS (fabric, paper, cardboard, leather, carpet, mattresses, upholstery, stuffed items): \"Porous item in [room] affected by Category 3 sewage backup. Located in contaminated environment per IICRC S500.\"\n- ELECTRONICS (any device with fans, vents, motors, or internal circuits): \"Electronic device in [room] affected by Category 3 sewage backup. Located in contaminated environment per IICRC S500.\"\n- SEMI-POROUS (wood, some plastics with textured surfaces, rubber): \"Semi-porous item in [room] affected by Category 3 sewage backup. Located in contaminated environment per IICRC S500.\"\n- NON-POROUS (glass, metal, hard plastic): \"Non-porous item in [room] affected by Category 3 sewage backup. Located in contaminated environment per IICRC S500.\"\nInclude the item's room location if known. Do NOT speculate about operational state, specific contact surfaces, or contamination pathways."
        },
        {
            role: "user",
            content: [
                { type: "text", text: promptText },
                ...resolvedImages.map((url) => ({ type: "image_url", image_url: { url } }))
            ]
        }
    ];

    try {
        await upstreamSemaphore.acquire();
    } catch (acquireErr) {
        if (acquireErr.message === "server_busy_try_again") {
            const elapsedMs = Date.now() - startMs;
            const inFlight = upstreamSemaphore.inFlight;
            const queueDepth = upstreamSemaphore.queue.length;
            const retryAfter = Math.min(10, Math.max(1, queueDepth + 1));
            res.set("Retry-After", String(retryAfter));
            log({ event: "enrich_item_error", status: 503, error: "server_busy_try_again", responseTimeMS: elapsedMs, inFlight, queueDepth });
            return res.status(503).json({ error: "server_busy_try_again", requestId, inFlight, queueDepth });
        }
        throw acquireErr;
    }

    try {
        const result = await requestOpenAIJson({
            messages,
            maxTokens: 1024,
            temperature: 0.2,
            log,
            purpose: "enrich_item",
            validate: validateEnrichPayload
        });
        const normalized = normalizeEnrichResult(result, baseline, enrichmentAttemptId, {
            comps: ebayComps.slice(0, 5),
            ebayMedian,
            ebayLow,
            ebayHigh
        });
        if (justifyMode && Number.isFinite(fixedPrice)) {
            normalized.revised.value = fixedPrice;
            normalized.revised.valueLow = fixedPrice;
            normalized.revised.valueHigh = fixedPrice;
        }
        log({
            event: "enrich_item_complete",
            status: 200,
            itemId,
            baselineValue: Number(baseline?.value || 0),
            revisedValue: Number(normalized?.revised?.value || 0)
        });

        enrichCache.set(docId, normalized);
        await firestoreSetEnrichment(docId, normalized);
        return res.status(200).json(normalized);
    } catch (err) {
        const { upstreamStatus, upstreamBodyRaw } = classifyUpstreamError(err);
        const status = upstreamStatus || 500;
        log({ event: "enrich_item_error", status, error: err.message, upstreamBodyRaw });
        return res.status(status).json({ error: "ENRICHMENT_FAILED", requestId, upstreamBodyRaw });
    } finally {
        upstreamSemaphore.release();
    }
});

app.post("/api/analyze-receipt", rateLimiter, async (req, res) => {
    try {
        const { imageBase64, mimeType, text } = req.body || {};
        if (!imageBase64 && !text) {
            return res.status(400).json({ success: false, error: "imageBase64 or text is required" });
        }
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ success: false, error: "OPENAI_API_KEY is not set" });
        }

        const requestId = crypto.randomUUID();
        const log = (obj) => console.log(JSON.stringify({ ...obj, requestId, provider: VISION_UPSTREAM_PROVIDER, endpoint: VISION_UPSTREAM_ENDPOINT }));
        const prompt = buildReceiptPrompt();
        
        let content = [{ type: "text", text: prompt }];
        if (text) {
            content.push({ type: "text", text: "\n\nDOCUMENT TEXT:\n" + text });
        } else if (imageBase64 && mimeType) {
            content.push({ type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } });
        }

        const messages = [
            { role: "system", content: "You are a receipt extraction assistant. Follow instructions exactly." },
            { role: "user", content }
        ];
        const parsed = await requestOpenAIJson({
            messages,
            maxTokens: 2048,
            temperature: 0.2,
            log,
            purpose: "analyze_receipt",
            validate: validateReceiptPayload
        });

        return res.json({
            success: true,
            store: parsed.store || "",
            date: parsed.date || "",
            items: Array.isArray(parsed.items) ? parsed.items : [],
            receiptTotal: Number(parsed.receiptTotal) || 0
        });
    } catch (err) {
        if (err && err.isInvalidJson) {
            return res.status(502).json({ success: false, error: "invalid_json_from_model" });
        }
        return res.status(500).json({ success: false, error: err.message || "Receipt analysis failed" });
    }
});

app.post("/api/analyze-contractor-report", rateLimiter, async (req, res) => {
    try {
        const text = typeof req.body?.text === "string" ? req.body.text : "";
        if (!text.trim()) {
            return res.status(400).json({ error: "text is required" });
        }
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "OPENAI_API_KEY is not set" });
        }

        const requestId = crypto.randomUUID();
        const log = (obj) => console.log(JSON.stringify({ ...obj, requestId, provider: VISION_UPSTREAM_PROVIDER, endpoint: VISION_UPSTREAM_ENDPOINT }));
        const prompt = [
            "TASK",
            "Extract ALL structured data from this contractor/service document. This may be a mitigation report, restoration estimate, HVAC invoice, plumber report, mold remediation report, equipment log, drying log, moisture reading report, or any other contractor document related to property damage.",
            "",
            "OUTPUT",
            "Return ONLY valid JSON. No markdown. No commentary.",
            "",
            "OUTPUT SCHEMA",
            "{",
            '  "companyName": "string — the contractor/company name (look for letterhead, logo text, header, footer, prepared by, from, business name)",',
            '  "contactName": "string — technician, representative, inspector, or contact person name",',
            '  "serviceStartDate": "YYYY-MM-DD — when work/service STARTED (earliest date mentioned in context of work performed, inspection date, or service date)",',
            '  "serviceEndDate": "YYYY-MM-DD — when work/service ENDED or report was completed (latest date in context of work completion). Must be >= serviceStartDate.",',
            '  "totalAmount": "number — total cost, invoice amount, estimate total, or grand total. Look for: total, amount due, grand total, subtotal, estimate total.",',
            '  "damageCategory": "string — water damage category (Cat 1/2/3, Class 1-4) or type of damage (mold, fire, smoke, sewage, etc.)",',
            '  "affectedSqFt": "number — total affected square footage. Look for: sq ft, square feet, SF, area affected.",',
            '  "affectedRooms": ["string — list EVERY room/area mentioned: basement, kitchen, bathroom, bedroom, hallway, laundry, garage, crawl space, etc."],',
            '  "equipment": ["string — ALL equipment mentioned: dehumidifiers, air movers, fans, air scrubbers, HEPA filters, moisture meters, thermal cameras, etc."],',
            '  "workDescription": "string — 2-3 sentence summary of ALL work described: demolition, drying, cleaning, reconstruction, testing, inspection, etc.",',
            '  "lineItemCount": "number — count of individual line items, services, or tasks listed",',
            '  "keyLineItems": ["string — up to 15 most important line items, services performed, or charges. Include amounts where visible."]',
            "}",
            "",
            "EXTRACTION RULES",
            "- Extract AGGRESSIVELY. Partial data is better than empty fields.",
            "- Look everywhere: headers, footers, tables, line items, notes, signatures, letterhead.",
            "- For company name: check top of document, letterhead, logo area, from field, footer.",
            "- For amounts: look for dollar signs, totals, subtotals, line item prices. Sum if needed.",
            "- For rooms: any mention of a room or area counts — even in passing.",
            "- For equipment: any tool, machine, or device mentioned counts.",
            "- For dates: distinguish between document date, service/inspection date, start date, completion date. serviceStartDate = earliest work date, serviceEndDate = latest work/completion date.",
            "- IMPORTANT: serviceStartDate must be BEFORE or EQUAL to serviceEndDate. If only one date found, put it in serviceStartDate.",
            "- Use empty string, 0, or [] ONLY when truly not present anywhere in the text.",
            "- Dates must be YYYY-MM-DD.",
            "- Numbers must be numeric (no currency symbols).",
            "",
            "REPORT TEXT",
            text
        ].join("\n");
        const messages = [
            { role: "system", content: "You are a property damage claim assistant. Extract structured data from contractor mitigation and restoration reports. Return only valid JSON." },
            { role: "user", content: prompt }
        ];
        const parsed = await requestOpenAIJson({
            messages,
            maxTokens: 2048,
            temperature: 0.2,
            log,
            purpose: "analyze_contractor_report",
            validate: validateContractorReportPayload
        });

        const cleanString = (value) => (typeof value === "string" ? value.trim() : "");
        const cleanArray = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()) : [];
        const payload = {
            companyName: cleanString(parsed.companyName),
            contactName: cleanString(parsed.contactName),
            serviceStartDate: cleanString(parsed.serviceStartDate),
            serviceEndDate: cleanString(parsed.serviceEndDate),
            totalAmount: Number(parsed.totalAmount) || 0,
            damageCategory: cleanString(parsed.damageCategory),
            affectedSqFt: Number(parsed.affectedSqFt) || 0,
            affectedRooms: cleanArray(parsed.affectedRooms),
            equipment: cleanArray(parsed.equipment),
            workDescription: cleanString(parsed.workDescription),
            lineItemCount: Number(parsed.lineItemCount) || 0,
            keyLineItems: cleanArray(parsed.keyLineItems)
        };

        return res.json(payload);
    } catch (err) {
        if (err && err.isInvalidJson) {
            return res.status(502).json({ error: "invalid_json_from_model" });
        }
        return res.status(500).json({ error: err.message || "Contractor report analysis failed" });
    }
});

// Proxy for Firebase Storage images — bypasses CORS when ClaimTracker is embedded in GSD
// Frontend calls: /api/storage-proxy?url=<encodedFirebaseUrl>
// Backend fetches from Firebase (no CORS restriction server-side) and streams back as image
app.get("/api/storage-proxy", async (req, res) => {
    const { url } = req.query;
    if (!url || !url.startsWith("https://firebasestorage.googleapis.com/")) {
        return res.status(400).json({ error: "Invalid or missing url parameter" });
    }
    try {
        const fetch = (await import("node-fetch")).default;
        const upstream = await fetch(url, { headers: { "Accept": "image/*,*/*" } });
        if (!upstream.ok) {
            return res.status(upstream.status).json({ error: `Upstream fetch failed: ${upstream.status}` });
        }
        const contentType = upstream.headers.get("content-type") || "image/jpeg";
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "private, max-age=3600");
        res.setHeader("Access-Control-Allow-Origin", "*");
        upstream.body.pipe(res);
    } catch (err) {
        console.error("storage-proxy error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// CLAIM MAXIMIZER — Interview Chat Endpoint (v2 with JSON schema)
// ══════════════════════════════════════════════════════════════════════════════
app.post("/api/maximizer/chat", rateLimiter, async (req, res) => {
    const requestId = crypto.randomUUID();
    const log = (obj) => console.log(JSON.stringify({ ...obj, requestId, endpoint: "maximizer_chat" }));
    log({ event: "maximizer_chat", action: "start" });
    
    try {
        const { messages, sessionToken } = req.body;
        
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: "messages array required", requestId });
        }
        
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            log({ event: "maximizer_chat", status: 500, error: "OPENAI_API_KEY is not set" });
            return res.status(500).json({ error: "OPENAI_API_KEY is not set", requestId });
        }
        
        // Force JSON output for structured communication
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: messages,
            temperature: 0.4,  // Lower for more consistent structured output
            max_tokens: 1500,
            response_format: { type: "json_object" }  // Force JSON mode
        });
        
        const assistantMessage = completion.choices[0]?.message?.content || "{}";
        
        // Validate it's valid JSON
        let parsed;
        try {
            parsed = JSON.parse(assistantMessage);
        } catch (e) {
            log({ event: "maximizer_chat", requestId, status: "json_parse_error", raw: assistantMessage.slice(0, 500) });
            // Return a safe fallback
            return res.json({
                message: JSON.stringify({
                    display_text: "I had trouble formatting my response. Could you repeat that?",
                    quick_buttons: ["Yes", "No", "Skip this question"]
                }),
                requestId
            });
        }
        
        // Log structured response for metrics
        log({ 
            event: "maximizer_chat", 
            requestId, 
            status: "success",
            hasLogValue: !!parsed.log_value,
            hasAction: !!parsed.request_action,
            questionNum: messages.filter(m => m.role === "user").length,
            sessionToken: sessionToken?.slice(0, 8)
        });
        
        return res.json({
            message: assistantMessage,
            requestId
        });
        
    } catch (err) {
        log({ event: "maximizer_chat", requestId, status: "error", error: err.message });
        return res.status(500).json({ error: err.message || "Chat failed", requestId });
    }
});

// Metrics endpoint for Claim Maximizer sessions
app.post("/api/maximizer/metrics", maximizerMetricsRateLimiter, (req, res) => {
    const requestId = crypto.randomUUID();
    const payload = req.body || {};
    console.log(JSON.stringify({
        event: "maximizer_metrics",
        requestId,
        receivedAt: new Date().toISOString(),
        ...payload
    }));
    return res.json({ ok: true, requestId });
});

// Health check endpoint for keep-alive pings
app.get("/health", (req, res) => {
    res.json({ ok: true, uptime: process.uptime() });
});

app.get("/api/ping", (req, res) => {
    const requestId = crypto.randomUUID();
    console.log(JSON.stringify({ event: "ping", requestId }));
    return res.json({ ok: true, requestId });
});

// SPA fallback — serve the Vite-built index.html for all non-API routes (must be LAST)
app.get("*", (req, res) => {
    const indexPath = path.join(__dirname, "..", "client", "dist", "index.html");
    res.sendFile(indexPath, (err) => {
        if (err) {
            res.status(404).send("Not found");
        }
    });
});


app.listen(PORT, () => {
    console.log(`ClaimTracker server running on port ${PORT}`);
});
