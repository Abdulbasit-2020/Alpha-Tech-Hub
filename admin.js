import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut, getIdTokenResult } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { ref, get, push, set, update } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const status=document.getElementById("adminStatus");
const logout=document.getElementById("adminLogout");
const adminName=document.getElementById("adminName");
const clientList=document.getElementById("clientList");
const clientCount=document.getElementById("clientCount");
const clientSearch=document.getElementById("clientSearch");
const refreshClients=document.getElementById("refreshClients");
const totalClients=document.getElementById("totalClients");
const profileModal=document.getElementById("profileModal");
const profileFields=document.getElementById("profileFields");
const closeProfile=document.getElementById("closeProfile");
const copyClientUid=document.getElementById("copyClientUid");
const profileCopyStatus=document.getElementById("profileCopyStatus");
let selectedClientUid="";
let clients=[];
function showStatus(message){status.textContent=message;}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
function renderClients(){
 const q=clientSearch.value.trim().toLowerCase();
 const filtered=clients.filter(c=>(c.name+" "+c.email).toLowerCase().includes(q));
 clientCount.textContent=filtered.length+" of "+clients.length+" clients";
 if(!filtered.length){clientList.innerHTML='<div class="client-empty">'+(clients.length?'No matching clients found.':'No registered client profiles found.')+'</div>';return;}
 clientList.innerHTML=filtered.map(c=>'<article class="client-row"><div><strong>'+escapeHtml(c.name)+'</strong><small>'+escapeHtml(c.email)+'</small></div><div class="client-actions"><small>Joined: '+escapeHtml(c.createdAt)+'</small><button class="btn btn-outline profile-view" type="button" data-uid="'+escapeHtml(c.uid)+'">View profile</button></div></article>').join("");
}
async function loadClients(){
 clientList.innerHTML='<div class="client-empty">Loading client records…</div>';
 try{
  const snap=await get(ref(db,"users"));
  const data=snap.exists()?snap.val():{};
  clients=Object.entries(data).map(([uid,p])=>({uid,profile:p||{},name:p.fullName||"Unnamed user",email:p.email||"No email",createdAt:p.createdAt?new Date(p.createdAt).toLocaleDateString():"Unknown"}));
  totalClients.textContent=clients.length;
  updateProjectClientOptions();
  renderClients();
  await loadProjects();
 }catch(error){
  clientCount.textContent="Unable to load";
  totalClients.textContent="—";
  clientList.innerHTML='<div class="client-empty">Client data access is blocked by database rules. Update the Realtime Database rules to allow verified admins to read /users, then refresh.</div>';
  console.error(error);
 }
}
function closeModal(){profileModal.classList.remove("open");}
clientSearch.addEventListener("input",renderClients);
refreshClients.addEventListener("click",loadClients);
clientList.addEventListener("click",event=>{
 const button=event.target.closest(".profile-view");
 if(!button)return;
 const client=clients.find(c=>c.uid===button.dataset.uid);
 if(!client)return;
 const p=client.profile;
 selectedClientUid=client.uid;
 profileCopyStatus.textContent="";
 const fields=[["Full name",p.fullName||"Not provided"],["Email",p.email||"Not provided"],["User ID (UID)",client.uid],["Registered",client.createdAt],["Email verification","Not available in the database profile"]];
 profileFields.innerHTML=fields.map(([label,value])=>'<div class="profile-field"><small>'+escapeHtml(label)+'</small><div>'+escapeHtml(value)+'</div></div>').join("");
 profileModal.classList.add("open");
});
copyClientUid.addEventListener("click",async()=>{
 if(!selectedClientUid)return; try{await navigator.clipboard.writeText(selectedClientUid);profileCopyStatus.textContent="UID copied to clipboard.";}catch(error){profileCopyStatus.textContent="Clipboard unavailable. UID: "+selectedClientUid;}
});
closeProfile.addEventListener("click",closeModal);
profileModal.addEventListener("click",event=>{if(event.target===profileModal)closeModal();});
document.addEventListener("keydown",event=>{if(event.key==="Escape")closeModal();});
logout.addEventListener("click",async()=>{logout.disabled=true;try{await signOut(auth);window.location.replace("account.html");}catch(error){showStatus("Sign-out failed. Please retry.");logout.disabled=false;}});

const projectForm=document.getElementById("projectForm");
const projectList=document.getElementById("projectList");
const projectFormStatus=document.getElementById("projectFormStatus");
const projectClient=document.getElementById("projectClient");
const refreshProjects=document.getElementById("refreshProjects");
let projectRecords=[];
function updateProjectClientOptions(){
 projectClient.innerHTML='<option value="">Select a client</option>'+clients.map(c=>'<option value="'+escapeHtml(c.uid)+'">'+escapeHtml(c.name)+' — '+escapeHtml(c.email)+'</option>').join("");
}
function renderProjects(){
 if(!projectRecords.length){projectList.innerHTML='<div class="client-empty">No projects found yet.</div>';return;}
 projectList.innerHTML=projectRecords.map(p=>'<article class="client-row"><div><strong>'+escapeHtml(p.name||"Untitled project")+'</strong><small>Client: '+escapeHtml(p.clientName||"Unknown client")+' • Status: '+escapeHtml(p.status||"Planning")+'</small><small>Deadline: '+escapeHtml(p.deadline||"Not set")+' • Progress: '+escapeHtml(String(p.progress??0))+'%</small><div style="height:8px;background:var(--border);border-radius:20px;overflow:hidden;margin-top:10px"><div style="height:100%;width:'+Math.max(0,Math.min(100,Number(p.progress)||0))+'%;background:linear-gradient(90deg,#6d5dfc,#20c5ef)"></div></div><small>'+escapeHtml(p.description||"No description")+'</small></div><button class="btn btn-outline project-edit" type="button" data-project-id="'+escapeHtml(p.id)+'">Edit project</button></article>').join("");
}
projectList.addEventListener("click",async event=>{
 const button=event.target.closest(".project-edit");if(!button)return;
 const p=projectRecords.find(item=>item.id===button.dataset.projectId);if(!p)return;
 const name=prompt("Project name:",p.name||"");if(name===null)return;
 const description=prompt("Project description:",p.description||"");if(description===null)return;
 const statusOptions=["Planning","In progress","On hold","Completed"];
 const status=prompt("Status (Planning, In progress, On hold, Completed):",p.status||"Planning");if(status===null)return;
 if(!statusOptions.includes(status)){projectFormStatus.textContent="Invalid status. Use Planning, In progress, On hold, or Completed.";return;}
 const progressInput=prompt("Progress percentage (0–100):",String(p.progress??0));if(progressInput===null)return;
 const progress=Number(progressInput);if(!Number.isFinite(progress)||progress<0||progress>100){projectFormStatus.textContent="Progress must be between 0 and 100.";return;}
 const deadline=prompt("Deadline (YYYY-MM-DD; leave blank to clear):",p.deadline||"");if(deadline===null)return;
 projectFormStatus.textContent="Updating project…";
 try{await update(ref(db,"projects/"+p.id),{name:name.trim(),description:description.trim(),status,progress,deadline:deadline.trim()});projectFormStatus.textContent="Project updated successfully.";await loadProjects();}
 catch(error){console.error(error);projectFormStatus.textContent="Update blocked. Check admin write access to /projects in database rules.";}
});
async function loadProjects(){
 projectList.innerHTML='<div class="client-empty">Loading projects…</div>';
 try{const snap=await get(ref(db,"projects"));const data=snap.exists()?snap.val():{};projectRecords=Object.entries(data).map(([id,p])=>({id,...p}));renderProjects();}
 catch(error){projectList.innerHTML='<div class="client-empty">Unable to read projects. Database rules must allow admins to read /projects.</div>';console.error("Project load failed",error);}
}
refreshProjects.addEventListener("click",loadProjects);
projectForm.addEventListener("submit",async event=>{
 event.preventDefault();projectFormStatus.textContent="Saving project…";
 const client=clients.find(c=>c.uid===projectClient.value);
 if(!client){projectFormStatus.textContent="Select a client first.";return;}
 const progress=Number(document.getElementById("projectProgress").value);
 if(!Number.isFinite(progress)||progress<0||progress>100){projectFormStatus.textContent="Progress must be between 0 and 100.";return;}
 const record={name:document.getElementById("projectName").value.trim(),clientUid:client.uid,clientName:client.name,clientEmail:client.email,description:document.getElementById("projectDescription").value.trim(),status:document.getElementById("projectStatus").value,progress,deadline:document.getElementById("projectDeadline").value||"",createdAt:Date.now(),createdBy:auth.currentUser.uid};
 try{await set(push(ref(db,"projects")),record);projectForm.reset();document.getElementById("projectProgress").value="0";projectFormStatus.textContent="Project created successfully.";await loadProjects();}
 catch(error){console.error(error);projectFormStatus.textContent="Save blocked. Check Realtime Database rules for admin write access to /projects.";}
});

// Orders & service request management
const requestList=document.getElementById("requestList"),requestSearch=document.getElementById("requestSearch"),requestStatusFilter=document.getElementById("requestStatusFilter"),requestStatusMessage=document.getElementById("requestStatus"),refreshRequests=document.getElementById("refreshRequests");
let serviceRequests=[];
function renderRequests(){
 const q=requestSearch.value.trim().toLowerCase(),filter=requestStatusFilter.value;
 const filtered=serviceRequests.filter(r=>[r.name,r.email,r.service,r.message].join(" ").toLowerCase().includes(q)&&(!filter||r.status===filter));
 if(!filtered.length){requestList.innerHTML='<div class="client-empty">'+(serviceRequests.length?'No matching requests.':'No service requests submitted yet.')+'</div>';return;}
 requestList.innerHTML=filtered.map(r=>'<article class="client-row"><div style="flex:1;min-width:220px"><strong>'+escapeHtml(r.name||"Unnamed requester")+'</strong><small>'+escapeHtml(r.email||"No email")+' • '+escapeHtml(r.service||"Other project")+'</small><small>Budget: '+escapeHtml(r.budget||"Not specified")+' • Submitted: '+escapeHtml(r.createdAt?new Date(r.createdAt).toLocaleString():"Unknown")+'</small><p style="white-space:pre-wrap;overflow-wrap:anywhere;margin:10px 0">'+escapeHtml(r.message||"No details")+'</p><small>Status: <strong>'+escapeHtml(r.status||"New")+'</strong> • Quote: '+escapeHtml(r.quote||"Not set")+'</small><small>Admin notes: '+escapeHtml(r.adminNotes||"None")+'</small></div><button class="btn btn-outline request-edit" type="button" data-request-id="'+escapeHtml(r.id)+'">Review / Update</button></article>').join("");
}
async function loadRequests(){
 requestList.innerHTML='<div class="client-empty">Loading service requests…</div>';
 try{const snap=await get(ref(db,"serviceRequests"));const data=snap.exists()?snap.val():{};serviceRequests=Object.entries(data).map(([id,r])=>({id,...r})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));renderRequests();}
 catch(error){console.error("Requests loading failed",error);requestList.innerHTML='<div class="client-empty">Cannot read requests. Check database rules for admin read access to /serviceRequests.</div>';}
}
requestList.addEventListener("click",async event=>{
 const button=event.target.closest(".request-edit");if(!button)return;
 const r=serviceRequests.find(item=>item.id===button.dataset.requestId);if(!r)return;
 const allowed=["New","Reviewing","Quoted","Accepted","In progress","Completed","Rejected"];
 const statusValue=prompt("Request status (New, Reviewing, Quoted, Accepted, In progress, Completed, Rejected):",r.status||"New");if(statusValue===null)return;
 if(!allowed.includes(statusValue)){requestStatusMessage.textContent="Invalid status. Choose one of the listed status values.";return;}
 const quote=prompt("Estimated quote / price:",r.quote||"");if(quote===null)return;
 const notes=prompt("Private admin notes:",r.adminNotes||"");if(notes===null)return;
 requestStatusMessage.textContent="Updating request…";
 try{await update(ref(db,"serviceRequests/"+r.id),{status:statusValue,quote:quote.trim(),adminNotes:notes.trim(),updatedAt:Date.now(),updatedBy:auth.currentUser.uid});requestStatusMessage.textContent="Request updated.";await loadRequests();}
 catch(error){console.error(error);requestStatusMessage.textContent="Update blocked. Check admin write access to /serviceRequests.";}
});
requestSearch.addEventListener("input",renderRequests);requestStatusFilter.addEventListener("change",renderRequests);refreshRequests.addEventListener("click",loadRequests);

onAuthStateChanged(auth,async(user)=>{
 if(!user){window.location.replace("account.html");return;}
 if(!user.emailVerified){showStatus("Email verification is required. Redirecting…");window.location.replace("account.html");return;}
 try{
  const tokenResult=await getIdTokenResult(user,true);
  if(tokenResult.claims.admin!==true){showStatus("Access denied: administrator privileges are required. Redirecting…");setTimeout(()=>window.location.replace("dashboard.html"),1500);return;}
  let name=user.displayName||user.email||"Administrator";
  try{const profileSnap=await get(ref(db,"users/"+user.uid));if(profileSnap.exists())name=profileSnap.val().fullName||name;}catch(e){console.warn("Profile read failed",e);}
  adminName.textContent=name;
  showStatus("Administrator access confirmed. Welcome to your management workspace.");
  await loadClients();
  await loadRequests();
 }catch(error){showStatus("Unable to verify administrator permissions. Access denied.");setTimeout(()=>window.location.replace("dashboard.html"),1500);}
});
