// ---------- Firebase v9 (modular) imports via CDN ----------
console.log("script.js loaded");

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ---------- 1. Firebase Config (YOUR PROJECT) ----------
const firebaseConfig = {
  apiKey: "AIzaSyAWqJku7XdMjOQhSetRn2nKNcbH7rcwm_M",
  authDomain: "fwc-hrms-ai.firebaseapp.com",
  projectId: "fwc-hrms-ai",
  storageBucket: "fwc-hrms-ai.firebasestorage.app",
  messagingSenderId: "1005230658978",
  appId: "1:1005230658978:web:e6c2a127c740cd77b5cefb",
  measurementId: "G-JLSCK49Y0D",
};

// ---------- 2. Initialize Firebase ----------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ======================================================
//      DOM ELEMENTS (may or may not exist on a page)
// ======================================================

const authSection = document.getElementById("auth-section");
const dashboardSection = document.getElementById("dashboard-section");

// login
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");
const authMessage = document.getElementById("authMessage");

// register
const registerCard = document.getElementById("register-card");
const regEmail = document.getElementById("regEmail");
const regPassword = document.getElementById("regPassword");
const regRole = document.getElementById("regRole");
const registerBtn = document.getElementById("registerBtn");
const registerMessage = document.getElementById("registerMessage");

const showRegister = document.getElementById("showRegister");
const showLogin = document.getElementById("showLogin");

// top bar
const logoutBtn = document.getElementById("logoutBtn");
const welcomeTitle = document.getElementById("welcomeTitle");
const userRoleText = document.getElementById("userRoleText");

// dashboards (single-page mode only on index.html)
const adminDashboard = document.getElementById("admin-dashboard");
const hrDashboard = document.getElementById("hr-dashboard");
const employeeDashboard = document.getElementById("employee-dashboard");

// admin stats (single-page mode)
const refreshStatsBtn = document.getElementById("refreshStatsBtn");
const adminStats = document.getElementById("adminStats");

// HR – AI
const jobDescriptionEl = document.getElementById("jobDescription");
const resumeTextEl = document.getElementById("resumeText");
const analyzeBtn = document.getElementById("analyzeBtn");
const analysisOutput = document.getElementById("analysisOutput");

// Employee – attendance
const markAttendanceBtn = document.getElementById("markAttendanceBtn");
const attendanceMessage = document.getElementById("attendanceMessage");

// ======================================================
//          AUTH UI SWITCH (LOGIN <-> REGISTER)
// ======================================================

if (showRegister) {
  showRegister.addEventListener("click", () => {
    const loginCard = document.querySelector(".auth-card");
    if (loginCard) loginCard.classList.add("hidden");
    if (registerCard) registerCard.classList.remove("hidden");
    if (authMessage) authMessage.textContent = "";
  });
}

if (showLogin) {
  showLogin.addEventListener("click", () => {
    if (registerCard) registerCard.classList.add("hidden");
    const loginCard = document.querySelector(".auth-card");
    if (loginCard) loginCard.classList.remove("hidden");
    if (registerMessage) registerMessage.textContent = "";
  });
}

// ======================================================
//                      REGISTER
// ======================================================

if (registerBtn) {
  registerBtn.addEventListener("click", async () => {
    if (!regEmail || !regPassword || !regRole) return;

    registerMessage.textContent = "";

    const email = regEmail.value.trim();
    const password = regPassword.value.trim();
    const role = regRole.value; // "admin" | "manager" | "hr" | "employee"

    if (!email || !password) {
      registerMessage.textContent = "Email and password required.";
      return;
    }

    try {
      registerBtn.disabled = true;

      const cred = await createUserWithEmailAndPassword(auth, email, password);

      await setDoc(doc(db, "users", cred.user.uid), {
        email,
        role,
        createdAt: serverTimestamp(),
      });

      registerMessage.textContent = "Registered successfully. You can login now.";
    } catch (err) {
      console.error(err);
      registerMessage.textContent = err.message;
    } finally {
      registerBtn.disabled = false;
    }
  });
}

// ======================================================
//                        LOGIN
// ======================================================

if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    if (!loginEmail || !loginPassword) return;

    authMessage.textContent = "";

    const email = loginEmail.value.trim();
    const password = loginPassword.value.trim();

    if (!email || !password) {
      authMessage.textContent = "Email and password required.";
      return;
    }

    try {
      loginBtn.disabled = true;
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged handles redirect / UI update
    } catch (err) {
      console.error(err);
      authMessage.textContent = err.message;
    } finally {
      loginBtn.disabled = false;
    }
  });
}

// ======================================================
//                       LOGOUT
// ======================================================

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "index.html";
    } catch (err) {
      console.error("Logout error:", err);
    }
  });
}

// ======================================================
//      AUTH STATE LISTENER (MAIN LOGIC + REDIRECT)
// ======================================================

onAuthStateChanged(auth, async (user) => {
  const currentPage =
    window.location.pathname.split("/").pop() || "index.html";

  // ---------- NOT LOGGED IN ----------
  if (!user) {
    // index.html -> show auth UI
    if (currentPage === "" || currentPage === "index.html") {
      if (authSection && dashboardSection) {
        authSection.classList.remove("hidden");
        dashboardSection.classList.add("hidden");
      }
      if (logoutBtn) logoutBtn.classList.add("hidden");
      if (welcomeTitle) welcomeTitle.textContent = "Dashboard";
      if (userRoleText) userRoleText.textContent = "";
    }

    // protect admin, manager & hr pages when not logged in
    if (
      currentPage === "admin.html" ||
      currentPage === "manager.html" ||
      currentPage === "hr.html"
    ) {
      window.location.href = "index.html";
    }

    return;
  }

  // ---------- LOGGED IN ----------
  if (logoutBtn) logoutBtn.classList.remove("hidden");

  // fetch user role
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const data = snap.data() || {};
  const role = data.role || "employee";

  // ---------- REDIRECTS FROM index.html ----------
  if (currentPage === "" || currentPage === "index.html") {
    if (role === "admin") {
      window.location.href = "admin.html";
      return;
    }
    if (role === "manager") {
      window.location.href = "manager.html";
      return;
    }
    if (role === "hr") {
      window.location.href = "hr.html";
      return;
    }
    // employee stays on index.html (single-page dashboard)
  }

  // ---------- PROTECT DASHBOARD PAGES BY ROLE ----------
  if (currentPage === "admin.html" && role !== "admin") {
    window.location.href = "index.html";
    return;
  }

  if (currentPage === "manager.html" && role !== "manager") {
    window.location.href = "index.html";
    return;
  }

  if (currentPage === "hr.html" && role !== "hr") {
    window.location.href = "index.html";
    return;
  }

  // ---------- Single-page dashboard behavior (index.html only) ----------
  if (currentPage === "" || currentPage === "index.html") {
    if (authSection && dashboardSection) {
      authSection.classList.add("hidden");
      dashboardSection.classList.remove("hidden");
    }

    if (welcomeTitle) welcomeTitle.textContent = `Welcome, ${user.email}`;
    if (userRoleText) userRoleText.textContent = `Role: ${role}`;

    if (adminDashboard) adminDashboard.classList.add("hidden");
    if (hrDashboard) hrDashboard.classList.add("hidden");
    if (employeeDashboard) employeeDashboard.classList.add("hidden");

    if (role === "admin" && adminDashboard) adminDashboard.classList.remove("hidden");
    if (role === "hr" && hrDashboard) hrDashboard.classList.remove("hidden");
    if ((role === "employee" || role === "admin") && employeeDashboard) {
      employeeDashboard.classList.remove("hidden");
    }
  }
});

// ======================================================
//                    ADMIN – STATS (index page only)
// ======================================================

if (refreshStatsBtn && adminStats) {
  refreshStatsBtn.addEventListener("click", async () => {
    adminStats.textContent = "Loading...";

    try {
      const snap = await getDocs(collection(db, "users"));

      let total = 0;
      const counts = { admin: 0, hr: 0, employee: 0, manager: 0 };

      snap.forEach((docSnap) => {
        total++;
        const r = docSnap.data().role || "employee";
        if (!counts[r]) counts[r] = 0;
        counts[r]++;
      });

      adminStats.textContent =
        `Total users: ${total}\n\n` +
        `Admins: ${counts.admin || 0}\n` +
        `HRs: ${counts.hr || 0}\n` +
        `Managers: ${counts.manager || 0}\n` +
        `Employees: ${counts.employee || 0}\n`;
    } catch (err) {
      console.error(err);
      adminStats.textContent = "Error loading stats: " + err.message;
    }
  });
}

// ======================================================
//          HR – AI RESUME ANALYSIS (OpenRouter)
// ======================================================

if (analyzeBtn && analysisOutput) {
  analyzeBtn.addEventListener("click", async () => {
    const jd = jobDescriptionEl ? jobDescriptionEl.value.trim() : "";
    const resume = resumeTextEl ? resumeTextEl.value.trim() : "";

    if (!jd || !resume) {
      analysisOutput.textContent =
        "Please fill both Job Description and Resume text.";
      return;
    }

    try {
      analyzeBtn.disabled = true;
      analysisOutput.textContent = "Thinking with AI...";

      const res = await fetch("/api/analyze-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: jd, resumeText: resume }),
      });

      const data = await res.json();

      if (!res.ok) {
        analysisOutput.textContent =
          "Error from server: " + (data.error || "Unknown error");
        return;
      }

      analysisOutput.textContent = data.analysis;
    } catch (err) {
      console.error(err);
      analysisOutput.textContent = "Request failed: " + err.message;
    } finally {
      analyzeBtn.disabled = false;
    }
  });
}

// ======================================================
//             EMPLOYEE – ATTENDANCE (Firestore)
// ======================================================

if (markAttendanceBtn && attendanceMessage) {
  markAttendanceBtn.addEventListener("click", async () => {
    attendanceMessage.textContent = "";

    const user = auth.currentUser;
    if (!user) {
      attendanceMessage.textContent = "You must be logged in.";
      return;
    }

    try {
      markAttendanceBtn.disabled = true;

      // Local YYYY-MM-DD (to avoid UTC date shifting)
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;

      await addDoc(collection(db, "attendance"), {
        uid: user.uid,
        email: user.email,
        date: dateStr,
        markedAt: serverTimestamp(),
      });

      attendanceMessage.textContent = `Attendance marked for ${dateStr}.`;
    } catch (err) {
      console.error(err);
      attendanceMessage.textContent = "Error: " + err.message;
    } finally {
      markAttendanceBtn.disabled = false;
    }
  });
}
