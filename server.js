require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

// 🚀 Improved bot detection rules
const botOrganizations = [
    "Amazon AWS",
    "Amazon Technologies Inc.",
    "AWS EC2",
    "Google LLC",
    "Google Cloud",
    "Meta Platforms, Inc.",
    "Twitter, Inc.",
    "DigitalOcean, LLC",
    "Cloudflare, Inc.",
    "Microsoft Corporation",
    "Microsoft Azure"
];

// 🚀 AWS ASN (Autonomous System Number) list
const awsASNs = [
    "AS14618", // Amazon AWS
    "AS16509", // Amazon EC2
    "AS8987",  // Amazon CloudFront
    "AS36459", // Amazon Data Centers
    "AS14686"  // Amazon Services
];

// ✅ Backup ASN Lookup (if `ipinfo.io` fails)
async function getASN(ip) {
    try {
        // Primary ASN Lookup (ipinfo.io)
        const ipInfoResponse = await axios.get(`https://ipinfo.io/${ip}/json?token=c180f76ac7988c`);
        if (ipInfoResponse.data.asn) return ipInfoResponse.data.asn;

        // Backup ASN Lookup (ip-api.com)
        const ipApiResponse = await axios.get(`http://ip-api.com/json/${ip}?fields=as,isp,org`);
        return ipApiResponse.data.as || "Unknown";
    } catch (error) {
        console.error("❌ Error fetching ASN:", error.message);
        return "Unknown";
    }
}


// ✅ Local bot detection (before AI analysis)
function isBot(visitorData) {
    return botOrganizations.some(org => visitorData.organization && visitorData.organization.includes(org)) ||
        awsASNs.some(asn => visitorData.asn && visitorData.asn.includes(asn)) || // ✅ Detect AWS by ASN
        visitorData.userAgent.toLowerCase().includes("bot") ||
        visitorData.userAgent.toLowerCase().includes("crawl") ||
        visitorData.userAgent.toLowerCase().includes("spider") ||
        visitorData.userAgent.toLowerCase().includes("slurp") ||
        visitorData.confidenceScore < 0.8;
}

// 🚀 AI-Powered Bot Detection (Mistral AI)
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
                temperature: 0.1, // 🔥 Lower temp for accurate results
                max_tokens: 5 // 🔥 Short responses (fixes cut-off responses)
            },
            {
                headers: { Authorization: `Bearer ${MISTRAL_API_KEY}` }
            }
        );

        const result = response.data.choices[0].message.content.trim().toLowerCase();
        return result === "bot" ? "bot" : "human"; // ✅ Forces valid response
    } catch (error) {
        console.error("❌ Mistral API Error:", error.response ? error.response.data : error.message);
        return "unknown";
    }
}

// ✅ API Route to Classify Visitors
app.post("/analyze", async (req, res) => {
    const visitorData = req.body;

    // Fetch ASN (Autonomous System Number)
    visitorData.asn = await getASN(visitorData.ip);
    visitorData.organization = visitorData.organization || "Unknown"; 

    console.log("🔍 Incoming Visitor Data:", visitorData);

    // 1️⃣ Local bot detection
    const isBotDetected = isBot(visitorData);

    // 2️⃣ AI bot detection (Mistral AI)
    const aiResult = await analyzeVisitor(visitorData);

    // 3️⃣ Final classification
    const finalResult = isBotDetected ? "bot" : aiResult;

    console.log(`🛑 Visitor (${visitorData.ip}) classified as: ${finalResult}`);

    res.json({ result: finalResult });
});

// ✅ Server Start
app.get("/", (req, res) => {
    res.send("Mistral AI Bot Detection Server is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
