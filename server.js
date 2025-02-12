require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// AI-Based Visitor Analysis
async function analyzeVisitor(data) {
    try {
        const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: "gpt-4",
                messages: [
                    { role: "system", content: "You are an AI bot detector. Analyze the visitor data and determine if this is a bot or a human. Respond with 'bot' or 'human'." },
                    { role: "user", content: `Analyze this visitor data: ${JSON.stringify(data)}. Classify as 'bot' or 'human'.` }
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
        console.error("OpenAI API Error:", error);
        return "unknown";
    }
}

// API Endpoint
app.post("/analyze", async (req, res) => {
    const visitorData = req.body;
    const decision = await analyzeVisitor(visitorData);

    console.log(`Visitor (${visitorData.ip}) classified as: ${decision}`);
    res.json({ result: decision });
});

app.get("/", (req, res) => {
    res.send("AI Bot Detection Server is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
