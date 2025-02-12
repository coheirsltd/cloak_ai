require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(express.json());
app.use(cors());

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const PROXYCHECK_API_KEY = "h73598-98g0t8-10p24j-i8z670";

const BLOCKED_IPS_FILE = "blocked_ips.json";

// Load blocked IPs from file
let blockedIPs = {};
if (fs.existsSync(BLOCKED_IPS_FILE)) {
    blockedIPs = JSON.parse(fs.readFileSync(BLOCKED_IPS_FILE));
}

// 🚀 Known bot organizations (Google, AWS, Azure, Cloudflare, etc.)
const botOrganizations = [
    "Amazon AWS",
    "Amazon Technologies Inc.",
    "AWS EC2",
    "Google LLC",
    "Google Cloud",
    "Meta Platforms, Inc.",
    "Facebook, Inc.",
    "Twitter, Inc.",
    "DigitalOcean, LLC",
    "Cloudflare, Inc.",
    "Microsoft Corporation",
    "Microsoft Azure"
];

// 🚀 Known ASNs (Amazon AWS, Google Cloud, Microsoft Azure, Cloudflare)
const botASNs = [
    "AS14618", "AS16509", "AS8987", "AS36459", // AWS
    "AS15169", "AS8075", "AS8068", // Google, Microsoft
    "AS13335", "AS14061", "AS54113" // Cloudflare, DigitalOcean
];

// ✅ Fetch ASN for the given IP
async function getASN(ip) {
    try {
        console.log(`🌐 Checking ASN for IP: ${ip}`);

        const ipInfoResponse = await axios.get(`https://ipinfo.io/${ip}/json?token=c180f76ac7988c`);
        if (ipInfoResponse.data.asn) return ipInfoResponse.data.asn;

        const ipApiResponse = await axios.get(`http://ip-api.com/json/${ip}?fields=as`);
        return ipApiResponse.data.as || "Unknown";
    } catch (error) {
        console.error("❌ Error fetching ASN:", error.message);
        return "Unknown";
    }
}

// ✅ Proxy/VPN Detection using ProxyCheck.io
async function checkProxyVPN(ip) {
    try {
        console.log(`🔍 Checking Proxy/VPN for IP: ${ip}`);
        const response = await axios.get(`https://proxycheck.io/v2/${ip}?key=${PROXYCHECK_API_KEY}&vpn=1&asn=1`);
        const result = response.data[ip];
        
        if (!result) return false; // No data found

        return result.proxy === "yes" || result.vpn === "yes" || result.type === "hosting";
    } catch (error) {
        console.error("❌ Proxy/VPN Check Failed:", error.message);
        return false;
    }
}

// ✅ Local bot detection (before AI analysis)
function isBot(visitorData) {
    return botOrganizations.some(org => visitorData.organization && visitorData.organization.includes(org)) ||
        botASNs.some(asn => visitorData.asn && visitorData.asn.includes(asn)) ||
        visitorData.userAgent.toLowerCase().includes("bot") ||
        visitorData.userAgent.toLowerCase().includes("crawl") ||
        visitorData.userAgent.toLowerCase().includes("spider") ||
        visitorData.userAgent.toLowerCase().includes("slurp") ||
        visitorData.confidenceScore < 0.8;
}

// ✅ AI-Powered Bot Detection (Mistral AI)
async function analyzeVisitor(visitorData) {
    try {
        const response = await axios.post(
            "https://api.mistral.ai/v1/chat/completions",
            {
                model: "mistral-tiny",
                messages: [
                    { role: "system", content: "You are an AI bot detector. Analyze the visitor data and determine if this is a bot or a human. Respond with only 'bot' or 'human'." },
                    { role: "user", content: `Analyze this visitor data: ${JSON.stringify(visitorData)}. Classify as 'bot' or 'human'.` }
                ],
                temperature: 0.1,
                max_tokens: 5
            },
            {
                headers: { Authorization: `Bearer ${MISTRAL_API_KEY}` }
            }
        );

        return response.data.choices[0].message.content.trim().toLowerCase() === "bot" ? "bot" : "human";
    } catch (error) {
        console.error("❌ AI Detection Failed:", error.message);
        return "unknown";
    }
}

// ✅ API Route to Classify Visitors
app.post("/analyze", async (req, res) => {
    const visitorData = req.body;

    // ✅ Check if IP is already blocked
    if (blockedIPs[visitorData.ip]) {
        console.log(`🛑 IP ${visitorData.ip} is BLOCKED (Cached)`);
        return res.json({ result: "bot" });
    }

    // ✅ Fetch ASN and check Proxy/VPN
    visitorData.asn = await getASN(visitorData.ip);
    visitorData.organization = visitorData.organization || "Unknown";
    visitorData.isProxyOrVPN = await checkProxyVPN(visitorData.ip);

    console.log("🔍 Incoming Visitor Data:", visitorData);

    // ✅ 1️⃣ Local bot detection
    const isBotDetected = isBot(visitorData) || visitorData.isProxyOrVPN;

    // ✅ 2️⃣ AI bot detection (Mistral AI)
    const aiResult = await analyzeVisitor(visitorData);

    // ✅ 3️⃣ Final classification
    const finalResult = isBotDetected ? "bot" : aiResult;

    console.log(`🛑 Visitor (${visitorData.ip}) classified as: ${finalResult}`);

    // ✅ Auto-update IP Blacklist
    if (finalResult === "bot") {
        blockedIPs[visitorData.ip] = true;
        fs.writeFileSync(BLOCKED_IPS_FILE, JSON.stringify(blockedIPs, null, 2));
    }

    res.json({ result: finalResult });
});

// ✅ Server Start
app.get("/", (req, res) => {
    res.send("ProxyCheck.io Enhanced Cloaking System is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
