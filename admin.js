import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut, getIdTokenResult } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const status=document.getElementById("adminStatus");
const logout=document.getElementById("adminLogout");
const adminName=document.getElementById("adminName");
const clientList=document.getElementById("clientList");
const clientCount=document.getElementById("clientCount");
const clientSearch=document.getElementById("clientSearch");
const refreshClients=document.getElementById("refreshClients");
let clients=[];
function showStatus(message){status.textContent=message;}
function renderClients(){
 const q=clientSearch.value.trim().toLowerCase();
 const filtered=clients.filter(c=>(c.name+" "+c.email).toLowerCase().includes(q));
 clientCount.textContent=filtered.length+" of "+clients.length+" clients";
 if(!filtered.length){clientList.innerHTML='<div class="client-empty">'+(clients.length?'No matching clients found.':'No registered client profiles found.')+'</div>';return;}
 clientList.innerHTML=filtered.map(c=>'<article class="client-row"><div><strong>'+escapeHtml(c.name)+'</strong><small>'+escapeHtml(c.email)+'</small></div><div><small>Joined: '+escapeHtml(c.createdAt)+'</small></div></article>').join("");
}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
async function loadClients(){
 clientList.innerHTML='<div class="client-empty">Loading client records…</div>';
 try{
  const snap=await get(ref(db,"users"));
  const data=snap.exists()?snap.val():{};
  clients=Object.entries(data).map(([uid,p])=>({uid,name:p.fullName||"Unnamed user",email:p.email||"No email",createdAt:p.createdAt?new Date(p.createdAt).toLocaleDateString():"Unknown"}));
  renderClients();
 }catch(error){
  clientCount.textContent="Unable to load";
  clientList.innerHTML='<div class="client-empty">Client data access is blocked by database rules. Update the Realtime Database rules to allow verified admins to read /users, then refresh.</div>';
  console.error(error);
 }
}
clientSearch.addEventListener("input",renderClients);
refreshClients.addEventListener("click",loadClients);
logout.addEventListener("click",async()=>{logout.disabled=true;try{await signOut(auth);window.location.replace("account.html");}catch(error){showStatus("Sign-out failed. Please retry.");logout.disabled=false;}});
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
 }catch(error){showStatus("Unable to verify administrator permissions. Access denied.");setTimeout(()=>window.location.replace("dashboard.html"),1500);}
});