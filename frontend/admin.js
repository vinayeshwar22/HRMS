// admin.js – Admin Dashboard Logic (Firebase v9 via CDN)

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
  updateDoc,
  collection,
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------- DOM ELEMENTS ----------
const userNameSpan = document.getElementById("userName");
const userRoleSpan = document.getElementById("userRole");

const statsUsersSpan = document.getElementById("stats-users");
const statsJobsSpan = document.getElementById("stats-jobs");
const statsAttendanceSpan = document.getElementById("stats-attendance");

const userListBody = document.getElementById("userList");

// Make logout button in HTML work
window.logoutUser = function () {
  signOut(auth).then(() => {
    window.location.href = "index.html";
  });
};

// ---------- AUTH GUARD ----------
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Not logged in -> back to login
    window.location.href = "index.html";
    return;
  }

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const data = snap.data() || {};
  const role = data.role || "employee";

  if (role !== "admin") {
    // Not an admin -> throw them out
    alert("Access denied. Admins only.");
    window.location.href = "index.html";
    return;
  }

  // Show admin header info
  userNameSpan.textContent = data.name || user.email;
  userRoleSpan.textContent = role;

  // Load dashboard data
  await Promise.all([loadStats(), loadUsersTable(user.uid)]);
});

// ---------- Load Stats ----------
async function loadStats() {
  try {
    // Users stats
    const userSnap = await getDocs(collection(db, "users"));
    let totalUsers = 0;
    userSnap.forEach(() => (totalUsers += 1));
    statsUsersSpan.textContent = `Users: ${totalUsers}`;

    // Jobs stats (if you don't have jobs collection yet, it will be 0)
    let totalJobs = 0;
    try {
      const jobSnap = await getDocs(collection(db, "jobs"));
      jobSnap.forEach(() => (totalJobs += 1));
    } catch (e) {
      // If collection doesn't exist yet, keep 0
    }
    statsJobsSpan.textContent = `Jobs: ${totalJobs}`;

    // Attendance stats
    let totalAttendance = 0;
    try {
      const attSnap = await getDocs(collection(db, "attendance"));
      attSnap.forEach(() => (totalAttendance += 1));
    } catch (e) {
      // collection may be empty
    }
    statsAttendanceSpan.textContent = `Attendance records: ${totalAttendance}`;
  } catch (err) {
    console.error("Error loading stats:", err);
    statsUsersSpan.textContent = "Users: error";
    statsJobsSpan.textContent = "Jobs: error";
    statsAttendanceSpan.textContent = "Attendance records: error";
  }
}

// ---------- Load Users Table ----------
async function loadUsersTable(currentAdminUid) {
  userListBody.innerHTML = `
    <tr>
      <td colspan="4" align="center">Loading users...</td>
    </tr>
  `;

  try {
    const snap = await getDocs(collection(db, "users"));

    if (snap.empty) {
      userListBody.innerHTML = `
        <tr><td colspan="4" align="center">No users found.</td></tr>
      `;
      return;
    }

    userListBody.innerHTML = "";

    snap.forEach((userDoc) => {
      const data = userDoc.data();
      const uid = userDoc.id;

      const name = data.name || data.email?.split("@")[0] || "No Name";
      const email = data.email || "No Email";
      const role = data.role || "employee";

      const tr = document.createElement("tr");

      // Name
      const nameTd = document.createElement("td");
      nameTd.textContent = name;
      tr.appendChild(nameTd);

      // Email
      const emailTd = document.createElement("td");
      emailTd.textContent = email;
      tr.appendChild(emailTd);

      // Role (select)
      const roleTd = document.createElement("td");
      const select = document.createElement("select");

      const roles = ["admin", "manager", "hr", "employee"];
      roles.forEach((r) => {
        const opt = document.createElement("option");
        opt.value = r;
        opt.textContent = r.charAt(0).toUpperCase() + r.slice(1);
        if (r === role) opt.selected = true;
        select.appendChild(opt);
      });

      // 🔴 Admin cannot change his own role
      if (uid === currentAdminUid) {
        select.disabled = true;
      } else {
        // On change -> immediate update in Firestore
        select.addEventListener("change", async () => {
          const newRole = select.value;
          try {
            await updateDoc(doc(db, "users", uid), { role: newRole });
            console.log(`Updated role of ${email} to ${newRole}`);
          } catch (err) {
            console.error("Error updating role:", err);
            alert("Failed to update role. Check console for details.");
          }
        });
      }

      roleTd.appendChild(select);
      tr.appendChild(roleTd);

      // Actions
      const actionsTd = document.createElement("td");

      if (uid === currentAdminUid) {
        // 🔴 No actions on self
        actionsTd.textContent = "This is you";
      } else {
        // Example: Delete from Firestore (not from Auth)
        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete";
        deleteBtn.classList.add("delete-btn", "action-btn");

        deleteBtn.addEventListener("click", async () => {
          const sure = confirm(
            `Remove user "${email}" from users collection?`
          );
          if (!sure) return;

          try {
            await deleteUserRecord(uid);
            tr.remove();
          } catch (err) {
            console.error("Error deleting user:", err);
            alert("Failed to delete user record.");
          }
        });

        actionsTd.appendChild(deleteBtn);
      }

      tr.appendChild(actionsTd);
      userListBody.appendChild(tr);
    });
  } catch (err) {
    console.error("Error loading users:", err);
    userListBody.innerHTML = `
      <tr><td colspan="4" align="center">Error loading users.</td></tr>
    `;
  }
}

// Delete only Firestore user doc (not auth account)
async function deleteUserRecord(uid) {
  const userRef = doc(db, "users", uid);
  await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js")
    .then((mod) => mod.deleteDoc(userRef))
    .catch((err) => {
      throw err;
    });
}
