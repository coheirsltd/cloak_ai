require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const useragent = require("useragent");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

const app = express();
app.use(express.json());
app.use(cors());

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const PROXYCHECK_API_KEY = "h73598-98g0t8-10p24j-i8z670";
const FINGERPRINT_API_KEY = "CQ1BhkeDyE5Rawfb8Y5q";
const BLOCKED_IPS_FILE = "blocked_ips.json";

puppeteer.use(StealthPlugin());

let blockedIPs = {};
if (fs.existsSync(BLOCKED_IPS_FILE)) {
    blockedIPs = JSON.parse(fs.readFileSync(BLOCKED_IPS_FILE));
}

const botOrganizations = [
    "Amazon AWS", "Google LLC", "Meta Platforms, Inc.", "Microsoft Azure", "Facebook, Inc.", "TikTok Pte. Ltd."
];

const botASNs = ["15169", "14618", "8075", "16509", "32934", "54113", "13335", "396982"];

const adNetworkUserAgents = [
    "googlebot", "facebookexternalhit", "Facebot", "Twitterbot", "LinkedInBot", "TikTokBot"
];

// ✅ Fetch ASN for the given IP
async function getASN(ip) {
    try {
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
        const response = await axios.get(`https://proxycheck.io/v2/${ip}?key=${PROXYCHECK_API_KEY}&vpn=1&asn=1`);
        const result = response.data[ip];
        return result && (result.proxy === "yes" || result.vpn === "yes" || result.type === "hosting");
    } catch (error) {
        console.error("❌ Proxy/VPN Check Failed:", error.message);
        return false;
    }
}

// ✅ Ad Cloaking Detection
function isAdReviewer(req) {
    const agent = req.headers["user-agent"]?.toLowerCase() || "";
    return adNetworkUserAgents.some(bot => agent.includes(bot));
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
    visitorData.asn = await getASN(visitorData.ip);
    visitorData.isProxyOrVPN = await checkProxyVPN(visitorData.ip);
    const aiResult = await analyzeVisitor(visitorData);
    const finalResult = visitorData.isProxyOrVPN ? "bot" : aiResult;

    if (finalResult === "bot" || isAdReviewer(req)) {
        blockedIPs[visitorData.ip] = true;
        fs.writeFileSync(BLOCKED_IPS_FILE, JSON.stringify(blockedIPs, null, 2));
        return res.status(403).send("Access Denied");
    }
    res.json({ result: finalResult });
});

app.get("/", (req, res) => {
    if (isAdReviewer(req)) {
        return res.send("Clean Content");
    }
    res.send("Cloaked Content");
});

app.listen(3000, () => console.log("Server running on port 3000"));
