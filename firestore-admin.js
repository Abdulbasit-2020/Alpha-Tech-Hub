import { auth, db } from "./firestore.js";
import { onAuthStateChanged, getIdTokenResult, signOut } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const $ = id => document.getElementById(id);
const gateStatus = $("gateStatus");
const notice = $("adminNotice");
const views = [...document.querySelectorAll(".view")];
const nav = [...document.querySelectorAll(".sidebar nav button")];
let clients = [], projects = [], requests = [];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function showView(view) {
  views.forEach(el => el.hidden = el.id !== view);
  nav.forEach(btn => btn.classList.toggle("selected", btn.dataset.view === view));
  $("heading").textContent = view.charAt(0).toUpperCase() + view.slice(1);
}
nav.forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.view)));

async function fetchCollection(name) {
  const snapshot = await getDocs(collection(db, name));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function renderClients() {
  const term = $("clientSearch").value.trim().toLowerCase();
  const filtered = clients.filter(c => String(c.fullName || c.name || "").toLowerCase().includes(term) || String(c.email || "").toLowerCase().includes(term));
  $("clientsList").innerHTML = filtered.length ? filtered.map(c =>
    '<article><div><strong>' + esc(c.fullName || c.name || "Unnamed client") + '</strong><small>' + esc(c.email || "No email") + '</small><small>UID: ' + esc(c.uid || c.id) + '</small></div></article>'
  ).join("") : '<article>No client records found in Firestore.</article>';
}
function renderProjects() {
  $("projectsList").innerHTML = projects.length ? projects.map(p =>
    '<article><div><strong>' + esc(p.name || "Unnamed project") + '</strong><small>' + esc(p.clientName || p.clientUid || "Client not assigned") + ' · ' + esc(p.status || "Planning") + ' · ' + esc(p.progress ?? 0) + '% · ' + esc(p.deadline || "No deadline") + '</small></div></article>'
  ).join("") : '<article>No Firestore projects yet.</article>';
}
function renderRequests() {
  $("requestsList").innerHTML = requests.length ? requests.map(r =>
    '<article><div><strong>' + esc(r.name || r.clientName || "Request") + '</strong><small>' + esc(r.email || "") + ' · ' + esc(r.service || "Service") + ' · ' + esc(r.status || "New") + '</small><p>' + esc(r.message || "") + '</p></div></article>'
  ).join("") : '<article>No Firestore requests yet.</article>';
}
async function refresh() {
  notice.textContent = "Loading Firestore records…";
  try {
    [clients, projects, requests] = await Promise.all([fetchCollection("clients"), fetchCollection("projects"), fetchCollection("serviceRequests")]);
    $("clientCount").textContent = clients.length;
    $("projectCount").textContent = projects.length;
    $("activeCount").textContent = projects.filter(p => p.status !== "Completed").length;
    $("requestCount").textContent = requests.length;
    renderClients(); renderProjects(); renderRequests();
    notice.textContent = "Firestore data loaded successfully.";
  } catch (error) {
    console.error(error);
    notice.textContent = "Firestore load failed: " + error.message + " — check database setup and rules.";
  }
}
$("clientSearch").addEventListener("input", renderClients);
$("refreshClients").addEventListener("click", refresh);
$("projectForm").addEventListener("submit", async event => {
  event.preventDefault();
  const progress = Number($("pProgress").value);
  if (progress < 0 || progress > 100) { $("projectMessage").textContent = "Progress must be between 0 and 100."; return; }
  try {
    await addDoc(collection(db, "projects"), {
      name: $("pName").value.trim(), clientUid: $("pClientUid").value.trim(),
      clientName: $("pClientName").value.trim(), description: $("pDesc").value.trim(),
      status: $("pStatus").value, progress, deadline: $("pDeadline").value,
      createdAt: Date.now(), createdBy: auth.currentUser.uid
    });
    $("projectMessage").textContent = "Project created.";
    event.target.reset(); $("pProgress").value = 0;
    await refresh();
  } catch (error) { $("projectMessage").textContent = "Project creation failed: " + error.message; }
});
$("logout").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async user => {
  if (!user) { gateStatus.textContent = "Sign in first. Redirecting…"; setTimeout(() => location.replace("account.html"), 1800); return; }
  if (!user.emailVerified) { gateStatus.textContent = "Verify your email before admin access."; setTimeout(() => location.replace("account.html"), 2500); return; }
  try {
    const token = await getIdTokenResult(user, true);
    if (token.claims.admin !== true) { gateStatus.textContent = "Access denied: this account has no admin claim."; return; }
    gateStatus.textContent = "Admin verified.";
    $("app").hidden = false; $("gate").hidden = true; $("adminEmail").textContent = user.email || "";
    await refresh();
  } catch (error) { gateStatus.textContent = "Admin verification failed: " + error.message; }
});
