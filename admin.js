import { auth, db } from "./firestore.js";
import { onAuthStateChanged, signOut, getIdTokenResult } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const $ = id => document.getElementById(id);
const status = $("adminStatus");
const sections = [...document.querySelectorAll(".ad-section")];
const nav = [...document.querySelectorAll(".ad-nav button")];
const titles = {
  overview: "Overview", clients: "Clients", projects: "Projects",
  requests: "Orders & Requests", messages: "Messages",
  files: "Files & Deliverables", settings: "Settings"
};

function msg(value) { status.textContent = value; }
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function dateValue(value, options = {}) {
  if (!value) return "Unknown";
  let date;
  if (typeof value?.toDate === "function") date = value.toDate();
  else if (typeof value === "number" || typeof value === "string") date = new Date(value);
  else if (typeof value?.seconds === "number") date = new Date(value.seconds * 1000);
  if (!date || Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString(undefined, options);
}

function openSection(key) {
  sections.forEach(section => section.classList.toggle("active", section.id === key));
  nav.forEach(button => button.classList.toggle("active", button.dataset.section === key));
  $("pageTitle").textContent = titles[key] || key;
}
nav.forEach(button => button.addEventListener("click", () => openSection(button.dataset.section)));
document.querySelectorAll("[data-goto]").forEach(button =>
  button.addEventListener("click", () => openSection(button.dataset.goto))
);

$("adminLogout").addEventListener("click", async () => {
  try {
    await signOut(auth);
    location.replace("account.html");
  } catch (error) {
    console.error(error);
    msg("Sign out failed. Try again.");
  }
});

let clients = [];
let projects = [];
let requests = [];

function renderClients() {
  const queryText = $("clientSearch").value.trim().toLowerCase();
  const filtered = clients.filter(client =>
    (client.name + " " + client.email).toLowerCase().includes(queryText)
  );
  $("clientCount").textContent = filtered.length + " of " + clients.length;
  $("clientList").innerHTML = filtered.length
    ? filtered.map(client => `<article class="ad-row"><div><strong>${esc(client.name)}</strong><small>${esc(client.email)}</small><small>Joined ${esc(client.joined)}</small></div><button class="ad-btn client-details" data-uid="${esc(client.uid)}">View details</button></article>`).join("")
    : '<div class="ad-empty">' + (clients.length ? "No matches found." : "No client profiles found.") + "</div>";
}

function clientOptions() {
  $("projectClient").innerHTML = '<option value="">Select a client</option>' +
    clients.map(client => `<option value="${esc(client.uid)}">${esc(client.name)} — ${esc(client.email)}</option>`).join("");
}

async function loadClients() {
  $("clientList").innerHTML = '<div class="ad-empty">Loading…</div>';
  try {
    const snapshot = await getDocs(collection(db, "users"));
    clients = snapshot.docs.map(item => {
      const profile = item.data();
      return {
        uid: item.id,
        name: profile.fullName || profile.name || "Unnamed client",
        email: profile.email || "No email",
        joined: dateValue(profile.createdAt, { dateStyle: "medium" }),
        profile
      };
    });
    $("totalClients").textContent = clients.length;
    renderClients();
    clientOptions();
  } catch (error) {
    console.error("Client list:", error);
    $("totalClients").textContent = "—";
    $("clientList").innerHTML = '<div class="ad-empty">Client list unavailable. Check the published Firestore users read rule.</div>';
  }
}

$("clientSearch").addEventListener("input", renderClients);
$("refreshClients").addEventListener("click", loadClients);

$("clientList").addEventListener("click", event => {
  const button = event.target.closest(".client-details");
  if (!button) return;
  const client = clients.find(item => item.uid === button.dataset.uid);
  if (!client) return;
  const panel = $("clientDetailPanel");
  if (!panel) return;
  const owned = projects.filter(project => project.clientUid === client.uid);
  panel.hidden = false;
  panel.innerHTML = `<div class="ad-heading"><div><span class="ad-label">CLIENT PROFILE</span><h3>${esc(client.name)}</h3></div><button type="button" class="ad-btn" id="closeClientDetails">Close</button></div>
    <div class="detail-grid">
      <div class="detail-cell"><small>Email</small>${esc(client.email)}</div>
      <div class="detail-cell"><small>UID</small>${esc(client.uid)}</div>
      <div class="detail-cell"><small>Registered</small>${esc(client.joined)}</div>
      <div class="detail-cell"><small>Projects assigned</small>${owned.length}</div>
    </div>
    <div style="margin-top:14px"><strong>Projects</strong><div class="ad-list" style="margin-top:8px">${owned.length
      ? owned.map(project => `<div class="ad-row"><div><strong>${esc(project.name || "Untitled project")}</strong><small>${esc(project.status || "Planning")} · ${esc(project.progress ?? 0)}% complete</small></div></div>`).join("")
      : '<div class="ad-empty">No projects assigned to this client yet.</div>'}</div></div>`;
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
});
document.addEventListener("click", event => {
  if (event.target.id === "closeClientDetails") $("clientDetailPanel").hidden = true;
});

function renderProjects() {
  $("projectList").innerHTML = projects.length
    ? projects.map(project => `<article class="ad-row"><div style="flex:1;min-width:220px"><strong>${esc(project.name || "Untitled project")}</strong><small>${esc(project.clientName || "Unknown client")} · ${esc(project.status || "Planning")} · ${esc(project.deadline || "No deadline")}</small><div class="ad-progress"><span style="width:${Math.min(100, Math.max(0, Number(project.progress) || 0))}%"></span></div><small>${esc(project.progress ?? 0)}% complete — ${esc(project.description || "No description")}</small></div><button class="ad-btn project-edit" data-id="${esc(project.id)}">Edit</button></article>`).join("")
    : '<div class="ad-empty">No projects yet.</div>';
  $("totalProjects").textContent = projects.length;
  $("activeProjects").textContent = projects.filter(project => project.status !== "Completed").length;
}

async function loadProjects() {
  try {
    const snapshot = await getDocs(collection(db, "projects"));
    projects = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    renderProjects();
  } catch (error) {
    console.error("Projects:", error);
    $("projectList").innerHTML = '<div class="ad-empty">Projects unavailable. Check the published Firestore projects read rule.</div>';
  }
}
$("refreshProjects").addEventListener("click", loadProjects);

$("projectForm").addEventListener("submit", async event => {
  event.preventDefault();
  $("projectFormStatus").textContent = "Saving…";
  const client = clients.find(item => item.uid === $("projectClient").value);
  const progress = Number($("projectProgress").value);
  if (!client) {
    $("projectFormStatus").textContent = "Choose a client.";
    return;
  }
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
    $("projectFormStatus").textContent = "Progress must be between 0 and 100.";
    return;
  }
  const record = {
    name: $("projectName").value.trim(),
    clientUid: client.uid,
    clientName: client.name,
    clientEmail: client.email,
    description: $("projectDescription").value.trim(),
    status: $("projectStatus").value,
    progress,
    deadline: $("projectDeadline").value || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: auth.currentUser.uid
  };
  try {
    await addDoc(collection(db, "projects"), record);
    event.target.reset();
    $("projectProgress").value = 0;
    $("projectFormStatus").textContent = "Project created.";
    await loadProjects();
  } catch (error) {
    console.error("Create project:", error);
    $("projectFormStatus").textContent = "Creation denied. Check the published Firestore projects admin write rule.";
  }
});

$("projectList").addEventListener("click", event => {
  const button = event.target.closest(".project-edit");
  if (!button) return;
  const project = projects.find(item => item.id === button.dataset.id);
  if (!project) return;
  $("editProjectId").value = project.id;
  $("editProjectName").value = project.name || "";
  $("editProjectDescription").value = project.description || "";
  $("editProjectStatus").value = project.status || "Planning";
  $("editProjectProgress").value = project.progress ?? 0;
  $("editProjectDeadline").value = project.deadline || "";
  $("projectEditStatus").textContent = "";
  $("projectEditForm").hidden = false;
  $("projectEditForm").scrollIntoView({ behavior: "smooth", block: "start" });
});

$("cancelProjectEdit").addEventListener("click", () => {
  $("projectEditForm").hidden = true;
});

$("projectEditForm").addEventListener("submit", async event => {
  event.preventDefault();
  const id = $("editProjectId").value;
  const progress = Number($("editProjectProgress").value);
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
    $("projectEditStatus").textContent = "Progress must be between 0 and 100.";
    return;
  }
  const payload = {
    name: $("editProjectName").value.trim(),
    description: $("editProjectDescription").value.trim(),
    status: $("editProjectStatus").value,
    progress,
    deadline: $("editProjectDeadline").value || "",
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  };
  $("projectEditStatus").textContent = "Saving…";
  try {
    await updateDoc(doc(db, "projects", id), payload);
    $("projectEditStatus").textContent = "Project updated successfully.";
    await loadProjects();
    $("projectEditForm").hidden = true;
  } catch (error) {
    console.error("Update project:", error);
    $("projectEditStatus").textContent = "Update failed. Check the published Firestore admin write rule.";
  }
});

function renderRequests() {
  const queryText = $("requestSearch").value.toLowerCase().trim();
  const selectedStatus = $("requestStatusFilter").value;
  const filtered = requests.filter(request =>
    [request.name, request.email, request.service, request.message].join(" ").toLowerCase().includes(queryText) &&
    (!selectedStatus || request.status === selectedStatus)
  );
  $("requestList").innerHTML = filtered.length
    ? filtered.map(request => `<article class="ad-row"><div style="flex:1;min-width:220px"><strong>${esc(request.name || "Unnamed")}</strong><small>${esc(request.email || "No email")} · ${esc(request.service || "Service")}</small><small>Budget: ${esc(request.budget || "Unspecified")} · ${esc(dateValue(request.createdAt))}</small><p style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(request.message || "No message")}</p><small>Status: ${esc(request.status || "New")} · Quote: ${esc(request.quote || "Not set")}</small></div><button class="ad-btn request-edit" data-id="${esc(request.id)}">Review / edit</button></article>`).join("")
    : '<div class="ad-empty">' + (requests.length ? "No matching requests." : "No requests found. Check Firestore serviceRequests.") + "</div>";
  $("newRequests").textContent = requests.filter(request => !request.status || request.status === "New").length;
  const recent = requests.slice(0, 4);
  $("recentRequests").innerHTML = recent.length
    ? recent.map(request => `<div class="ad-row"><div><strong>${esc(request.name || "Requester")}</strong><small>${esc(request.service || "Service")} · ${esc(request.status || "New")}</small></div><button class="ad-btn" data-goto="requests">View</button></div>`).join("")
    : '<div class="ad-empty">No recent requests.</div>';
  $("recentRequests").querySelectorAll("[data-goto]").forEach(button =>
    button.addEventListener("click", () => openSection(button.dataset.goto))
  );
}

async function loadRequests() {
  $("requestList").innerHTML = '<div class="ad-empty">Loading requests…</div>';
  try {
    const snapshot = await getDocs(collection(db, "serviceRequests"));
    requests = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    requests.sort((a, b) => {
      const time = value => typeof value?.toDate === "function"
        ? value.toDate().getTime()
        : typeof value?.seconds === "number" ? value.seconds * 1000 : Number(value) || new Date(value || 0).getTime() || 0;
      return time(b.createdAt) - time(a.createdAt);
    });
    renderRequests();
  } catch (error) {
    console.error("Service request read:", error);
    requests = [];
    $("requestList").innerHTML = '<div class="ad-empty">Read access denied or unavailable for Firestore serviceRequests. Check the published admin rules and refresh.</div>';
    $("newRequests").textContent = "—";
    $("recentRequests").innerHTML = '<div class="ad-empty">Could not load requests.</div>';
  }
}

$("requestSearch").addEventListener("input", renderRequests);
$("requestStatusFilter").addEventListener("change", renderRequests);
$("refreshRequests").addEventListener("click", loadRequests);

$("requestList").addEventListener("click", async event => {
  const button = event.target.closest(".request-edit");
  if (!button) return;
  const request = requests.find(item => item.id === button.dataset.id);
  if (!request) return;
  const statuses = ["New", "Reviewing", "Quoted", "Accepted", "In progress", "Completed", "Rejected"];
  const nextStatus = prompt("Status: " + statuses.join(", "), request.status || "New");
  if (nextStatus === null) return;
  if (!statuses.includes(nextStatus)) {
    alert("Invalid status.");
    return;
  }
  const quote = prompt("Quote:", request.quote || "");
  if (quote === null) return;
  const notes = prompt("Private admin notes:", request.adminNotes || "");
  if (notes === null) return;
  $("requestStatus").textContent = "Updating…";
  try {
    await updateDoc(doc(db, "serviceRequests", request.id), {
      status: nextStatus,
      quote: quote.trim(),
      adminNotes: notes.trim(),
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.uid
    });
    $("requestStatus").textContent = "Request updated.";
    await loadRequests();
  } catch (error) {
    console.error("Update request:", error);
    $("requestStatus").textContent = "Update denied. Check the published Firestore serviceRequests admin write rule.";
  }
});

onAuthStateChanged(auth, async user => {
  if (!user) {
    msg("You are not signed in. Please sign in to continue.");
    setTimeout(() => location.replace("account.html"), 2500);
    return;
  }
  if (!user.emailVerified) {
    msg("Email verification is required. Please verify your email and sign in again.");
    setTimeout(() => location.replace("account.html"), 3500);
    return;
  }

  try {
    msg("Checking administrator permissions…");
    const token = await getIdTokenResult(user, true);
    const adminRecord = await getDoc(doc(db, "admins", user.uid));
    if (token.claims.admin !== true && !adminRecord.exists()) {
      msg("ACCESS DENIED — this account is not on the administrator allowlist. No administrator data has been loaded.");
      document.querySelector(".admin-shell").innerHTML = `<main style="max-width:680px;margin:10vh auto;padding:24px;font-family:system-ui;color:#17231c;background:#fff;border-radius:18px;box-shadow:0 8px 32px #0001"><h1>Administrator access required</h1><p>Your sign-in succeeded, but this account is not listed as an administrator.</p><p>For security, the admin dashboard data has not been loaded.</p><a href="account.html">Return to sign-in</a></main>`;
      return;
    }

    let name = user.displayName || user.email || "Administrator";
    try {
      const profile = await getDoc(doc(db, "users", user.uid));
      if (profile.exists()) name = profile.data().fullName || name;
    } catch (error) {
      console.warn("Could not load admin profile:", error);
    }
    $("adminName").textContent = name;
    msg("Administrator verified. Secure Firestore workspace ready.");
    await Promise.all([loadClients(), loadProjects(), loadRequests()]);
  } catch (error) {
    console.error("Admin verification:", error);
    msg("Administrator verification failed: " + (error.message || "unknown error") + ". Dashboard data was not loaded.");
  }
});
