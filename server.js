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

const botASNs = ["15169", "14618", "8075", "32934", "54113", "13335", "396982"];

const adNetworkUserAgents = [
    "googlebot", "facebookexternalhit", "Facebot", "Twitterbot", "LinkedInBot", "TikTokBot"
];

// ✅ Fetch ASN for the given IP
async function getASN(ip) {
    try {
        console.log(`Fetching ASN for IP: ${ip}`);

        const ipInfoResponse = await axios.get(`https://ipinfo.io/${ip}/json?token=c180f76ac7988c`);
        console.log("ipinfo.io response:", ipInfoResponse.data);

        if (ipInfoResponse.data.asn && typeof ipInfoResponse.data.asn === "string") {
            return ipInfoResponse.data.asn.replace("AS", "").trim();
        }

        const ipApiResponse = await axios.get(`http://ip-api.com/json/${ip}?fields=as`);
        console.log("ip-api.com response:", ipApiResponse.data);

        if (ipApiResponse.data.as && typeof ipApiResponse.data.as === "string") {
            return ipApiResponse.data.as.replace("AS", "").trim();
        }

        return "Unknown";
    } catch (error) {
        console.error("❌ Error fetching ASN:", error.message);
        return "Unknown";
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
        return res.status(403).json({ error: "Access Denied", reason: "Bot Detected", ip: visitorData.ip });
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
