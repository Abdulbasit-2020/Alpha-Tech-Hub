import { auth, db } from "./firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { collection, doc, getDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
const $ = id => document.getElementById(id);
const message = $("portalMessage");
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function empty(text){return '<p class="muted">'+esc(text)+'</p>';}
function money(amount,currency){const n=Number(amount);return esc(currency||"NGN")+" "+(Number.isFinite(n)?n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}):"—");}
async function loadPortal(user){
  $("portalName").textContent=user.displayName||"Client";
  $("portalEmail").textContent=user.email||"";
  const [profileSnap,clientSnap,projectSnap,paymentSnap]=await Promise.all([
    getDoc(doc(db,"users",user.uid)),
    getDoc(doc(db,"clients",user.uid)),
    getDocs(query(collection(db,"projects"),where("clientUid","==",user.uid))),
    getDocs(query(collection(db,"payments"),where("clientUid","==",user.uid)))
  ]);
  const profile=profileSnap.exists()?profileSnap.data():{};
  const client=clientSnap.exists()?clientSnap.data():{};
  $("portalName").textContent=profile.fullName||client.fullName||user.displayName||"Client";
  $("portalProfile").innerHTML='<div><small class="muted">Name</small><strong>'+esc(profile.fullName||client.fullName||user.displayName||"Not provided")+'</strong></div><div><small class="muted">Email</small><strong>'+esc(user.email||"—")+'</strong></div><div><small class="muted">Account status</small><strong>'+esc(client.status||"Active")+'</strong></div><div><small class="muted">Email verification</small><strong>'+(user.emailVerified?"Verified":"Not verified")+'</strong></div>';
  const projects=projectSnap.docs.map(d=>({id:d.id,...d.data()}));
  $("portalProjects").innerHTML=projects.length?projects.map(p=>{const progress=Math.max(0,Math.min(100,Number(p.progress)||0));return '<article class="portal-item"><strong>'+esc(p.name||"Project")+'</strong><span class="portal-status">'+esc(p.status||"Planning")+'</span><p class="muted">'+esc(p.description||"No description provided.")+'</p><small>Deadline: '+esc(p.deadline||"Not set")+' · '+progress+'% complete</small><div class="bar"><span style="width:'+progress+'%"></span></div></article>';}).join(""):empty("No projects have been assigned to your account yet.");
  const payments=paymentSnap.docs.map(d=>({id:d.id,...d.data()}));
  $("portalPayments").innerHTML=payments.length?payments.map(p=>'<article class="portal-item"><strong>'+money(p.amount,p.currency)+'</strong><span class="portal-status">'+esc(p.status||"Pending")+'</span><p class="muted">'+esc(p.description||"Project payment")+'</p></article>').join(""):empty("No payment records are available yet.");
  message.textContent="Your account data was loaded securely from Firestore.";
}
$("portalLogout").addEventListener("click",async()=>{await signOut(auth);location.replace("account.html");});
onAuthStateChanged(auth,async user=>{
  if(!user){message.textContent="Please sign in to access your client portal.";setTimeout(()=>location.replace("account.html"),1200);return;}
  if(!user.emailVerified){message.textContent="Please verify your email address before accessing the client portal.";return;}
  try{await loadPortal(user);}catch(error){console.error(error);message.textContent="Unable to load your portal: "+error.message+" Check that Firestore is enabled and its security rules are published.";}
});