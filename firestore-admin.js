import { auth, db } from "./firestore.js";
import { onAuthStateChanged, getIdTokenResult, signOut } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { collection, getDocs, addDoc, updateDoc, doc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const $ = id => document.getElementById(id);
const gateStatus = $("gateStatus");
const notice = $("adminNotice");
const views = [...document.querySelectorAll(".view")];
const nav = [...document.querySelectorAll(".sidebar nav button")];
let clients = [], projects = [], requests = [], payments = [];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function showView(view) {
  views.forEach(el => el.hidden = el.id !== view);
  nav.forEach(btn => btn.classList.toggle("selected", btn.dataset.view === view));
  $("heading").textContent = view.charAt(0).toUpperCase() + view.slice(1);
}
nav.forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.view)));

async function fetchCollection(name) {
  const snapshot = await getDocs(collection(db, name));
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
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
    '<article><div><strong>' + esc(p.name || "Unnamed project") + '</strong><small>' + esc(p.clientName || p.clientUid || "Client not assigned") + ' · ' + esc(p.status || "Planning") + ' · ' + esc(p.progress ?? 0) + '% · ' + esc(p.deadline || "No deadline") + '</small></div><button data-edit-project="' + esc(p.id) + '">Edit</button></article>'
  ).join("") : '<article>No Firestore projects yet.</article>';
}
function renderRequests() {
  $("requestsList").innerHTML = requests.length ? requests.map(r =>
    '<article><div><strong>' + esc(r.name || r.clientName || "Request") + '</strong><small>' + esc(r.email || "") + ' · ' + esc(r.service || "Service") + '</small><p>' + esc(r.message || "") + '</p><label>Status<select data-request-status="' + esc(r.id) + '">' + ["New","Contacted","In progress","Completed","Cancelled"].map(s => '<option' + (s === (r.status || "New") ? " selected" : "") + '>' + s + '</option>').join("") + '</select></label><button data-save-request="' + esc(r.id) + '">Update status</button></div></article>'
  ).join("") : '<article>No Firestore requests yet.</article>';
}
function renderPayments() {
  $("paymentsList").innerHTML = payments.length ? payments.map(p =>
    '<article><div><strong>' + esc(p.amount ?? "—") + ' ' + esc(p.currency || "NGN") + ' · ' + esc(p.status || "Pending") + '</strong><small>Client: ' + esc(p.clientUid || "—") + ' · Project: ' + esc(p.projectId || "—") + '</small><p>' + esc(p.description || "") + '</p></div></article>'
  ).join("") : '<article>No payments recorded.</article>';
}
async function refresh() {
  notice.textContent = "Loading Firestore records…";
  try {
    [clients, projects, requests, payments] = await Promise.all([fetchCollection("clients"), fetchCollection("projects"), fetchCollection("serviceRequests"), fetchCollection("payments")]);
    $("clientCount").textContent = clients.length;
    $("projectCount").textContent = projects.length;
    $("activeCount").textContent = projects.filter(p => p.status !== "Completed").length;
    $("requestCount").textContent = requests.length;
    renderClients(); renderProjects(); renderRequests(); renderPayments();
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
$("projectsList").addEventListener("click", event => {
  const button = event.target.closest("[data-edit-project]");
  if (!button) return;
  const project = projects.find(p => p.id === button.dataset.editProject);
  if (!project) return;
  $("editProjectId").value = project.id;
  $("editProjectName").value = project.name || "";
  $("editClientUid").value = project.clientUid || "";
  $("editClientName").value = project.clientName || "";
  $("editProjectDesc").value = project.description || "";
  $("editProjectStatus").value = project.status || "Planning";
  $("editProjectProgress").value = project.progress ?? 0;
  $("editProjectDeadline").value = project.deadline || "";
  $("projectEditMessage").textContent = "";
  $("projectEditForm").hidden = false;
  $("projectEditForm").scrollIntoView({behavior:"smooth",block:"start"});
});
$("cancelProjectEdit").addEventListener("click", () => { $("projectEditForm").hidden = true; });
$("projectEditForm").addEventListener("submit", async event => {
  event.preventDefault();
  const progress = Number($("editProjectProgress").value);
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) { $("projectEditMessage").textContent = "Progress must be between 0 and 100."; return; }
  try {
    await updateDoc(doc(db, "projects", $("editProjectId").value), {
      name: $("editProjectName").value.trim(), clientUid: $("editClientUid").value.trim(),
      clientName: $("editClientName").value.trim(), description: $("editProjectDesc").value.trim(),
      status: $("editProjectStatus").value, progress, deadline: $("editProjectDeadline").value,
      updatedAt: Date.now(), updatedBy: auth.currentUser.uid
    });
    $("projectEditMessage").textContent = "Project updated successfully.";
    $("projectEditForm").hidden = true;
    await refresh();
  } catch (error) { $("projectEditMessage").textContent = "Update failed: " + error.message; }
});
\n$("requestsList").addEventListener("click", async event => {
  const btn = event.target.closest("[data-save-request]");
  if (!btn) return;
  const id = btn.dataset.saveRequest;
  const select = $("requestsList").querySelector('[data-request-status="' + id + '"]');
  try {
    await updateDoc(doc(db, "serviceRequests", id), { status: select.value, updatedAt: Date.now(), updatedBy: auth.currentUser.uid });
    notice.textContent = "Request status updated.";
    requests = await fetchCollection("serviceRequests"); renderRequests();
  } catch (error) { notice.textContent = "Status update failed: " + error.message; }
});
$("paymentForm").addEventListener("submit", async event => {
  event.preventDefault();
  try {
    const amount = Number($("payAmount").value);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a positive amount.");
    await addDoc(collection(db, "payments"), {
      clientUid: $("payClientUid").value.trim(), projectId: $("payProjectId").value.trim() || null,
      amount, currency: $("payCurrency").value.trim().toUpperCase(), status: $("payStatus").value,
      description: $("payDescription").value.trim(), createdAt: Date.now(), createdBy: auth.currentUser.uid
    });
    $("paymentMessage").textContent = "Payment record saved.";
    event.target.reset(); $("payCurrency").value = "NGN";
    payments = await fetchCollection("payments"); renderPayments();
  } catch (error) { $("paymentMessage").textContent = "Save failed: " + error.message; }
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
