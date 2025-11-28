// backend/server.js
require("dotenv").config();
const express = require("express");
const path = require("path");

// Node 18+ has global fetch – no need for node-fetch import

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Safety check for API key ----
if (!process.env.OPENROUTER_API_KEY) {
  console.warn("WARNING: OPENROUTER_API_KEY is not set in .env");
}

// Parse JSON bodies
app.use(express.json({ limit: "2mb" })); // small limit is enough for text

// Serve frontend (index.html, hr.html, etc.)
app.use(express.static(path.join(__dirname, "../frontend")));

// =============== AI Resume Analysis Route =================
app.post("/api/analyze-resume", async (req, res) => {
  try {
    const { resumeText, jobDescription } = req.body;

    if (!resumeText || !jobDescription) {
      return res
        .status(400)
        .json({ error: "resumeText and jobDescription are required" });
    }

    // Truncate very long inputs to avoid token / credit issues
    const MAX_CHARS = 8000;
    const safeResume = resumeText.slice(0, MAX_CHARS);
    const safeJD = jobDescription.slice(0, 2000);

    const prompt = `
You are an expert ATS + HR assistant.
Given a JOB DESCRIPTION and a CANDIDATE RESUME (as plain text),
ALWAYS respond in EXACTLY these 5 sections, in plain text (no JSON):

1) Short Candidate Summary
   • 3–5 bullet points.
2) Match Score (0–100)
   • Single line: "Score: X/100 – <one-line explanation>"
3) 5 Key Strengths
   • Bullet list.
4) 5 Major Gaps or Risks
   • Bullet list.
5) Hiring Recommendation
   • One of: Strong Yes / Yes / Borderline / No, with 2–3 lines of explanation.

JOB DESCRIPTION:
${safeJD}

CANDIDATE RESUME:
${safeResume}
`;

    // ---- Call OpenRouter ----
    const response = await fetch("https://openrouter.ai/api/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000", // any URL, used for analytics
        "X-Title": "FWC HRMS Hackathon App",
      },
      body: JSON.stringify({
        model: "openai/o4-mini",   // ✅ working model
        input: prompt,             // simple string
        max_output_tokens: 500,    // keep small to save credits
      }),
    });

    if (!response.ok) {
      const txt = await response.text();
      console.error("AI ERROR:", txt);
      return res.status(500).json({ error: "AI API error", details: txt });
    }

    const data = await response.json();

    // --- Debug (optional, helps if something breaks) ---
    console.log(
      "AI raw (first 400 chars):",
      JSON.stringify(data).slice(0, 400)
    );

    // ======== Always extract a plain text 'analysis' =========
    const firstOutput = data.output?.[0];

    // Try all likely places where text can be
    let messageFromModel =
      firstOutput?.summary?.[0]?.text ||      // reasoning-style (what you're seeing)
      firstOutput?.content?.[0]?.text ||      // normal chat completion
      data.output_text ||                     // direct text
      "";

    if (typeof messageFromModel !== "string") {
      messageFromModel = "";
    }

    messageFromModel = messageFromModel.trim();

    let analysis = "";

    if (messageFromModel) {
      analysis = messageFromModel;
    } else {
      // Fallback: don't spam UI with giant JSON, just short debug text
      analysis =
        "AI response format not recognized.\n\n(Ask the developer to check server logs.)";
    }

    return res.json({ analysis });   // 👈 ALWAYS this shape
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// =============== Start server =================
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
