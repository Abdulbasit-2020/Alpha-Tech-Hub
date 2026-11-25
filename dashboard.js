import { auth, db } from "./firestore.js";
import {
  onAuthStateChanged,
  signOut,
  sendEmailVerification,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const $ = id => document.getElementById(id);
const statusBox = $("dashboardStatus");
const userName = $("userName");
const profileName = $("profileName");
const profileEmail = $("profileEmail");
const verificationStatus = $("verificationStatus");
const resendButton = $("resendVerification");
const logoutButton = $("logoutButton");
const diagSdk = $("diagSdk");
const diagAuth = $("diagAuth");
const diagDb = $("diagDb");
const diagProfile = $("diagProfile");
const recoveryCard = $("profileRecovery");
const recoveryForm = $("profileRecoveryForm");
const recoveryName = $("recoveryName");
const saveRecoveryProfile = $("saveRecoveryProfile");
const clientProjects = $("clientProjects");
let currentUser = null;

function showStatus(message, type = "") {
  statusBox.textContent = message;
  statusBox.className = "dash-status" + (type ? " " + type : "");
}
function diagnostic(el, message, color) {
  if (!el) return;
  el.textContent = message;
  if (color) el.style.color = color;
}
function escapeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}
function showProfile(name, email) {
  userName.textContent = name || "Member";
  profileName.textContent = name || "Name not found in profile";
  profileEmail.textContent = email || "Email not available";
}
function showRecovery(name = "") {
  recoveryCard.style.display = "block";
  recoveryName.value = name;
}
function renderProjects(projects) {
  if (!clientProjects) return;
  if (!projects.length) {
    clientProjects.innerHTML = '<div class="client-project-empty">No projects are currently assigned to your account. When a project is created for you, it will appear here.</div>';
    return;
  }
  clientProjects.innerHTML = projects.map(project => {
    const progress = Math.max(0, Math.min(100, Number(project.progress) || 0));
    return '<article class="client-project"><div class="client-project-head"><strong class="client-project-title">' +
      escapeText(project.name || "Untitled project") +
      '</strong><span class="client-project-status">' + escapeText(project.status || "Planning") +
      '</span></div><p style="margin-top:8px;color:var(--muted)">' +
      escapeText(project.description || "No project description has been provided.") +
      '</p><div class="client-project-meta"><span>Deadline: ' + escapeText(project.deadline || "Not set") +
      '</span><span>Progress: ' + progress +
      '%</span></div><div class="client-project-progress" role="progressbar" aria-label="Project progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
      progress + '"><span style="width:' + progress + '%"></span></div></article>';
  }).join("");
}
async function loadClientProjects(uid) {
  if (!clientProjects) return;
  clientProjects.innerHTML = '<p class="client-project-empty">Loading your projects…</p>';
  try {
    const q = query(collection(db, "projects"), where("clientUid", "==", uid));
    const snapshot = await getDocs(q);
    renderProjects(snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
  } catch (error) {
    console.error("Firestore project read failed:", error);
    clientProjects.innerHTML = '<p class="client-project-empty">Unable to load projects. Please refresh or contact Alpha Tech Hub.</p>';
  }
}

diagnostic(diagSdk, "Loaded ✓", "#63e7b1");
diagnostic(diagDb, "Firestore ready", "#63e7b1");
showStatus("Firebase modules loaded. Checking authentication…");

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  try {
    await signOut(auth);
    window.location.href = "account.html";
  } catch (error) {
    showStatus("Sign-out failed: " + error.message, "error");
    logoutButton.disabled = false;
  }
});

resendButton.addEventListener("click", async () => {
  if (!auth.currentUser) return;
  resendButton.disabled = true;
  try {
    await sendEmailVerification(auth.currentUser);
    showStatus("Verification email sent. Check your inbox and spam folder.", "success");
  } catch (error) {
    showStatus("Could not send verification email: " + error.message, "error");
  } finally {
    resendButton.disabled = false;
  }
});

recoveryForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentUser) return;
  const fullName = recoveryName.value.trim();
  if (!fullName) {
    showStatus("Please enter your full name.", "error");
    return;
  }
  saveRecoveryProfile.disabled = true;
  showStatus("Saving your profile to Cloud Firestore…");
  try {
    await currentUser.reload();
    const freshUser = auth.currentUser;
    await setDoc(doc(db, "users", freshUser.uid), {
      uid: freshUser.uid,
      fullName,
      email: freshUser.email || "",
      emailVerified: freshUser.emailVerified,
      updatedAt: serverTimestamp()
    }, { merge: true });
    try {
      await updateProfile(freshUser, { displayName: fullName });
    } catch (profileError) {
      console.warn("Auth display-name update failed:", profileError);
    }
    currentUser = freshUser;
    showProfile(fullName, freshUser.email);
    recoveryCard.style.display = "none";
    diagnostic(diagProfile, "Profile saved ✓", "#63e7b1");
    showStatus("Your profile was successfully saved to Cloud Firestore.", "success");
  } catch (error) {
    console.error("Profile recovery failed:", error);
    diagnostic(diagProfile, "Profile save failed: " + error.message, "#ff8a8a");
    showStatus("Could not save profile. Check the published Firestore rules: " + error.message, "error");
  } finally {
    saveRecoveryProfile.disabled = false;
  }
});

onAuthStateChanged(auth, async user => {
  if (!user) {
    diagnostic(diagAuth, "No signed-in user", "#ff8a8a");
    showStatus("No active session. Redirecting to sign-in…", "error");
    setTimeout(() => window.location.replace("account.html"), 900);
    return;
  }

  currentUser = user;
  diagnostic(diagAuth, "Signed in ✓", "#63e7b1");
  verificationStatus.textContent = user.emailVerified ? "Verified ✓" : "Not verified";
  resendButton.hidden = user.emailVerified;
  showStatus("Authentication succeeded. Checking your Firestore profile…");

  try {
    const profileSnapshot = await getDoc(doc(db, "users", user.uid));
    const profile = profileSnapshot.exists() ? profileSnapshot.data() : {};
    const name = profile.fullName || user.displayName || "";
    showProfile(name, profile.email || user.email || "");
    if (!name) showRecovery(name);
    diagnostic(
      diagProfile,
      profileSnapshot.exists() ? (name ? "Found ✓" : "Name missing") : "Profile record not found",
      profileSnapshot.exists() && name ? "#63e7b1" : "#ffb86b"
    );
    showStatus(
      profileSnapshot.exists()
        ? "Profile loaded from Cloud Firestore."
        : "Your account exists, but its Firestore profile is missing. Complete the form below to restore it.",
      profileSnapshot.exists() ? "success" : "error"
    );
    await loadClientProjects(user.uid);
  } catch (error) {
    console.error("Firestore profile lookup failed:", error);
    showProfile(user.displayName || "", user.email || "");
    diagnostic(diagProfile, "Read failed: " + error.message, "#ff8a8a");
    showStatus("Profile lookup failed. Check that the latest firestore.rules have been published. " + error.message, "error");
  }
});
