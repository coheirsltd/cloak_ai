require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 🚀 Improved bot detection function
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

// 🚀 Improved AWS ASN detection
const awsASNs = [
    "AS14618", // Amazon AWS
    "AS16509", // Amazon EC2
    "AS8987",  // Amazon CloudFront
    "AS36459", // Amazon Data Centers
    "AS14686"  // Amazon Services
];

function isBot(visitorData) {
    return botOrganizations.some(org => visitorData.organization && visitorData.organization.includes(org)) ||
        awsASNs.some(asn => visitorData.asn && visitorData.asn.includes(asn)) || // ✅ Detect AWS by ASN
        visitorData.userAgent.toLowerCase().includes("bot") ||
        visitorData.userAgent.toLowerCase().includes("crawl") ||
        visitorData.userAgent.toLowerCase().includes("spider") ||
        visitorData.userAgent.toLowerCase().includes("slurp") ||
        visitorData.confidenceScore < 0.8;
}

// 🚀 OpenAI-based AI Bot Detection
async function analyzeVisitor(visitorData) {
    try {
        const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: "gpt-4",
                messages: [
                    { role: "system", content: "You are an AI bot detector. Analyze the visitor data and determine if this is a bot or a human. Respond with 'bot' or 'human'." },
                    { role: "user", content: `Analyze this visitor data: ${JSON.stringify(visitorData)}. Classify as 'bot' or 'human'.` }
                ],
                temperature: 0.3,
                max_tokens: 10
            },
            {
                headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }
            }
        );

        return response.data.choices[0].message.content.toLowerCase();
    } catch (error) {
        console.error("❌ OpenAI API Error:", error.response ? error.response.data : error.message);
        return "unknown";
    }
}

// 🚀 API Endpoint to Classify Users
app.post("/analyze", async (req, res) => {
    const visitorData = req.body;

    // Fetch ASN (Autonomous System Number)
    try {
        const ipResponse = await axios.get(`https://ipinfo.io/${visitorData.ip}/json?token=c180f76ac7988c`);
        visitorData.asn = ipResponse.data.asn || "Unknown";
    } catch (error) {
        console.error("❌ Error fetching ASN data:", error.message);
        visitorData.asn = "Unknown";
    }

    console.log("🔍 Incoming Visitor Data:", visitorData);

    const isBotDetected = isBot(visitorData);
    const aiResult = await analyzeVisitor(visitorData);

    console.log(`🛑 Visitor (${visitorData.ip}) classified as: ${isBotDetected ? "bot" : aiResult}`);

    res.json({ result: isBotDetected ? "bot" : aiResult });
});

// 🚀 Server Start
app.get("/", (req, res) => {
    res.send("AI Bot Detection Server is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
