// manager.js
console.log("manager.js loaded");

// ---------- Firebase v9 (modular) imports via CDN ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  collection,
  addDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ---------- Firebase Config (same as script.js) ----------
const firebaseConfig = {
  apiKey: "AIzaSyAWqJku7XdMjOQhSetRn2nKNcbH7rcwm_M",
  authDomain: "fwc-hrms-ai.firebaseapp.com",
  projectId: "fwc-hrms-ai",
  storageBucket: "fwc-hrms-ai.firebasestorage.app",
  messagingSenderId: "1005230658978",
  appId: "1:1005230658978:web:e6c2a127c740cd77b5cefb",
  measurementId: "G-JLSCK49Y0D",
};

// ---------- Initialize Firebase ----------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------- DOM elements ----------
const userNameEl = document.getElementById("user-name");
const userRoleEl = document.getElementById("user-role");

const hrListEl = document.getElementById("hrList");
const employeeListEl = document.getElementById("employeeList");

const taskForm = document.getElementById("assignTaskForm");
const taskTitleInput = document.getElementById("taskTitle");
const taskAssigneeSelect = document.getElementById("taskAssignee");

const tasksListEl = document.getElementById("tasksList");

// Map of uid -> { name, email, role }
const assigneeMap = {};

// =============== LOGOUT (global for onclick) ===============
window.logoutUser = async function logoutUser() {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (err) {
    console.error("Logout error:", err);
    alert("Logout failed: " + err.message);
  }
};

// =============== AUTH GUARD ===============
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Not logged in -> back to main login page
    window.location.href = "index.html";
    return;
  }

  // Fetch role from Firestore
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const data = snap.data() || {};
  const role = data.role || "employee";
  const name = data.name || user.email;

  if (userNameEl) userNameEl.textContent = name;
  if (userRoleEl) userRoleEl.textContent = role;

  // Only managers can see this page
  if (role !== "manager") {
    alert("You are not authorized to view the Manager dashboard.");
    window.location.href = "index.html";
    return;
  }

  // After manager verified: load data
  await loadUsers();
  await loadTasks(user.uid);
  setupAssignTaskHandler(user.uid);
});

// =============== LOAD HR + EMPLOYEES ===============
async function loadUsers() {
  try {
    // Clear initial rows
    if (hrListEl) hrListEl.innerHTML = "";
    if (employeeListEl) employeeListEl.innerHTML = "";
    if (taskAssigneeSelect) {
      taskAssigneeSelect.innerHTML =
        '<option value="">Select HR or Employee</option>';
    }

    // HRs
    const hrQuery = query(collection(db, "users"), where("role", "==", "hr"));
    const hrSnap = await getDocs(hrQuery);

    if (hrSnap.empty && hrListEl) {
      hrListEl.innerHTML =
        '<tr><td colspan="3">No HR users found.</td></tr>';
    } else {
      hrSnap.forEach((docSnap) => {
        const u = docSnap.data();
        const uid = docSnap.id;
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${u.name || u.email}</td>
          <td>${u.email}</td>
          <td>${u.role}</td>
        `;
        if (hrListEl) hrListEl.appendChild(row);

        assigneeMap[uid] = {
          name: u.name || u.email,
          email: u.email,
          role: u.role,
        };

        if (taskAssigneeSelect) {
          const opt = document.createElement("option");
          opt.value = uid;
          opt.textContent = `${u.name || u.email} (HR)`;
          taskAssigneeSelect.appendChild(opt);
        }
      });
    }

    // Employees
    const empQuery = query(
      collection(db, "users"),
      where("role", "==", "employee")
    );
    const empSnap = await getDocs(empQuery);

    if (empSnap.empty && employeeListEl) {
      employeeListEl.innerHTML =
        '<tr><td colspan="3">No employees found.</td></tr>';
    } else {
      empSnap.forEach((docSnap) => {
        const u = docSnap.data();
        const uid = docSnap.id;
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${u.name || u.email}</td>
          <td>${u.email}</td>
          <td>${u.role}</td>
        `;
        if (employeeListEl) employeeListEl.appendChild(row);

        assigneeMap[uid] = {
          name: u.name || u.email,
          email: u.email,
          role: u.role,
        };

        if (taskAssigneeSelect) {
          const opt = document.createElement("option");
          opt.value = uid;
          opt.textContent = `${u.name || u.email} (Employee)`;
          taskAssigneeSelect.appendChild(opt);
        }
      });
    }
  } catch (err) {
    console.error("Error loading users:", err);
    if (hrListEl)
      hrListEl.innerHTML =
        '<tr><td colspan="3">Error loading HR users.</td></tr>';
    if (employeeListEl)
      employeeListEl.innerHTML =
        '<tr><td colspan="3">Error loading employees.</td></tr>';
  }
}

// =============== ASSIGN TASK HANDLER ===============
function setupAssignTaskHandler(managerUid) {
  if (!taskForm) return;

  taskForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = taskTitleInput.value.trim();
    const assigneeUid = taskAssigneeSelect.value;

    if (!title || !assigneeUid) {
      alert("Please fill task title and assignee.");
      return;
    }

    const assignee = assigneeMap[assigneeUid];
    if (!assignee) {
      alert("Invalid assignee.");
      return;
    }

    try {
      await addDoc(collection(db, "tasks"), {
        title,
        assigneeUid,
        assigneeEmail: assignee.email,
        assigneeName: assignee.name,
        assigneeRole: assignee.role,
        status: "Assigned",
        createdByUid: managerUid,
        createdAt: serverTimestamp(),
      });

      taskTitleInput.value = "";
      taskAssigneeSelect.value = "";
      await loadTasks(managerUid);
      alert("Task assigned successfully.");
    } catch (err) {
      console.error("Error assigning task:", err);
      alert("Error assigning task: " + err.message);
    }
  });
}

// =============== LOAD TASKS (for this manager) ===============
async function loadTasks(managerUid) {
  try {
    if (tasksListEl) {
      tasksListEl.innerHTML =
        '<tr><td colspan="4">Loading tasks...</td></tr>';
    }

    const qTasks = query(
      collection(db, "tasks"),
      where("createdByUid", "==", managerUid)
    );
    const snap = await getDocs(qTasks);

    if (!tasksListEl) return;

    tasksListEl.innerHTML = "";

    if (snap.empty) {
      tasksListEl.innerHTML =
        '<tr><td colspan="4">No tasks assigned yet.</td></tr>';
      return;
    }

    snap.forEach((docSnap) => {
      const t = docSnap.data();
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${t.title}</td>
        <td>${t.assigneeName || t.assigneeEmail} (${t.assigneeRole})</td>
        <td>${t.status || "Assigned"}</td>
        <td>
          <button class="drop-btn" data-task-id="${docSnap.id}">
            Drop
          </button>
        </td>
      `;

      tasksListEl.appendChild(row);
    });

    // Attach click handlers for "Drop" buttons
    tasksListEl.querySelectorAll(".drop-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const taskId = e.currentTarget.getAttribute("data-task-id");
        if (!taskId) return;

        const confirmDrop = confirm("Are you sure you want to drop this task?");
        if (!confirmDrop) return;

        try {
          await deleteDoc(doc(db, "tasks", taskId));
          await loadTasks(managerUid); // refresh list
        } catch (err) {
          console.error("Error dropping task:", err);
          alert("Error dropping task: " + err.message);
        }
      });
    });
  } catch (err) {
    console.error("Error loading tasks:", err);
    if (tasksListEl)
      tasksListEl.innerHTML =
        '<tr><td colspan="4">Error loading tasks.</td></tr>';
  }
}
