// hr.js – minimal HR dashboard AI resume screening (frontend only)
console.log("hr.js loaded");

// ---------------------------------------------------
//  DOM elements (MUST match ids in hr.html)
// ---------------------------------------------------
const aiJobDescriptionEl = document.getElementById("aiJobDescription");
const resumeUploadInput  = document.getElementById("resumeUpload");
const analyzeResumeBtn   = document.getElementById("analyzeResumeBtn");
const aiResumeResult     = document.getElementById("aiResumeResult");

// Check they exist in the DOM
if (!aiJobDescriptionEl || !resumeUploadInput || !analyzeResumeBtn || !aiResumeResult) {
  console.error(
    "AI Resume Screening elements not found in DOM. " +
    "Check that hr.html has ids: aiJobDescription, resumeUpload, analyzeResumeBtn, aiResumeResult."
  );
}

// ---------------------------------------------------
//  Logout stub (so the Logout button doesn't crash)
// ---------------------------------------------------
window.logoutUser = function () {
  alert("Logout not wired yet in this minimal hr.js");
};

// ---------------------------------------------------
//  PDF → TEXT helper using pdf.js
// ---------------------------------------------------
async function extractTextFromPdf(file) {
  if (!window.pdfjsLib) {
    throw new Error(
      "pdfjsLib not found. Make sure pdf.js script is loaded before hr.js."
    );
  }

  // Recommended: set workerSrc so pdf.js can use a web worker
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.13.216/pdf.worker.min.js";
  } catch (e) {
    console.warn("Could not set pdf.js workerSrc:", e);
  }

  // Read file into ArrayBuffer for pdf.js
  const arrayBuffer = await file.arrayBuffer();

  // Load PDF
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  // Limit pages so we don't send crazy huge prompts
  const MAX_PAGES = Math.min(pdf.numPages, 10); // first 10 pages

  for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ");
    fullText += `\n\n===== Page ${pageNum} =====\n\n` + pageText;
  }

  return fullText.trim();
}

// ---------------------------------------------------
//  AI Resume Screening – OpenRouter backend
// ---------------------------------------------------
if (aiJobDescriptionEl && resumeUploadInput && analyzeResumeBtn && aiResumeResult) {
  analyzeResumeBtn.addEventListener("click", async () => {
    aiResumeResult.textContent = "";

    const jd   = aiJobDescriptionEl.value.trim();
    const file = resumeUploadInput.files[0];

    if (!jd) {
      aiResumeResult.textContent = "Please enter a job description.";
      return;
    }

    if (!file) {
      aiResumeResult.textContent = "Please select a resume file.";
      return;
    }

    try {
      analyzeResumeBtn.disabled = true;
      aiResumeResult.textContent = "Loading...";

      let resumeText = "";
      const fileName = file.name.toLowerCase();

      // Decide how to read based on extension
      if (fileName.endsWith(".pdf")) {
        // Use pdf.js for PDFs
        resumeText = await extractTextFromPdf(file);
      } else if (fileName.endsWith(".txt")) {
        // Simple text read for .txt
        resumeText = await file.text();
      } else {
        aiResumeResult.textContent =
          "Only .txt and .pdf are supported in this demo. Please upload one of those formats.";
        return;
      }

      if (!resumeText) {
        aiResumeResult.textContent =
          "Could not read resume content. Try uploading a .txt version of the resume.";
        return;
      }

      // Safety: limit characters to avoid token/cost issues
      const MAX_CHARS = 8000;
      if (resumeText.length > MAX_CHARS) {
        resumeText = resumeText.slice(0, MAX_CHARS);
      }

      // Call your backend
      const response = await fetch("/api/analyze-resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resumeText,
          jobDescription: jd,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        aiResumeResult.textContent =
          `Server error (${response.status}): ${errText}`;
        return;
      }

      const data = await response.json();

      // ✅ Only use the analysis string from backend
      if (typeof data.analysis === "string" && data.analysis.trim()) {
        aiResumeResult.textContent = data.analysis.trim();
      } else {
        aiResumeResult.textContent = "No analysis text returned from server.";
      }
    } catch (err) {
      console.error("AI analysis error:", err);
      aiResumeResult.textContent =
        "Request failed: " + (err.message || "Unknown error");
    } finally {
      analyzeResumeBtn.disabled = false;
    }
  });
} else {
  console.warn("AI Resume Screening elements not found in DOM.");
}
