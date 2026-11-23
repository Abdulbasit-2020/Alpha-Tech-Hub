import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut, sendEmailVerification, updateProfile } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { ref, get, set, onValue } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const statusBox=document.getElementById("dashboardStatus");
const userName=document.getElementById("userName");
const profileName=document.getElementById("profileName");
const profileEmail=document.getElementById("profileEmail");
const verificationStatus=document.getElementById("verificationStatus");
const resendButton=document.getElementById("resendVerification");
const logoutButton=document.getElementById("logoutButton");
const diagSdk=document.getElementById("diagSdk");
const diagAuth=document.getElementById("diagAuth");
const diagDb=document.getElementById("diagDb");
const diagProfile=document.getElementById("diagProfile");
const recoveryCard=document.getElementById("profileRecovery");
const recoveryForm=document.getElementById("profileRecoveryForm");
const recoveryName=document.getElementById("recoveryName");
const saveRecoveryProfile=document.getElementById("saveRecoveryProfile");
let currentUser=null;

const clientProjects=document.getElementById("clientProjects");
function escapeProjectText(v){return String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
function showClientProjects(projectData,uid){
  const mine=Object.entries(projectData||{}).filter(([id,p])=>p&&p.clientUid===uid).map(([id,p])=>({id,...p}));
  if(!clientProjects)return;
  if(!mine.length){clientProjects.innerHTML='<div class="client-project-empty">No projects are currently assigned to your account. When a project is created for you, it will appear here.</div>';return;}
  clientProjects.innerHTML=mine.map(p=>{
    const progress=Math.max(0,Math.min(100,Number(p.progress)||0));
    return '<article class="client-project"><div class="client-project-head"><strong class="client-project-title">'+escapeProjectText(p.name||"Untitled project")+'</strong><span class="client-project-status">'+escapeProjectText(p.status||"Planning")+'</span></div><p style="margin-top:8px;color:var(--muted)">'+escapeProjectText(p.description||"No project description has been provided.")+'</p><div class="client-project-meta"><span>Deadline: '+escapeProjectText(p.deadline||"Not set")+'</span><span>Progress: '+progress+'%</span></div><div class="client-project-progress" role="progressbar" aria-label="Project progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+progress+'"><span style="width:'+progress+'%"></span></div></article>';
  }).join("");
}
function subscribeToClientProjects(uid){
  if(!clientProjects)return;
  clientProjects.innerHTML='<p class="client-project-empty">Loading your projects…</p>';
  onValue(ref(db,"projects"),snap=>{
    showClientProjects(snap.exists()?snap.val():{},uid);
  },error=>{
    console.error("Client projects read failed",error);
    clientProjects.innerHTML='<p class="client-project-empty">Unable to load projects. Please refresh or contact Alpha Tech Hub.</p>';
  });
}


function showStatus(text,type=""){statusBox.textContent=text;statusBox.className="dash-status"+(type?" "+type:"");}
function diagnostic(el,text,color){el.textContent=text;if(color)el.style.color=color;}
function showProfile(name,email){
  userName.textContent=name||"Member";
  profileName.textContent=name||"Name not found in profile";
  profileEmail.textContent=email||"Email not available";
}
function showRecovery(name=""){
  recoveryCard.style.display="block";
  recoveryName.value=name;
}
diagnostic(diagSdk,"Loaded ✓","#63e7b1");
showStatus("Firebase modules loaded. Checking authentication…");

logoutButton.addEventListener("click",async()=>{
  logoutButton.disabled=true;
  try{await signOut(auth);window.location.href="account.html";}
  catch(error){showStatus("Sign-out failed: "+error.message,"error");logoutButton.disabled=false;}
});
resendButton.addEventListener("click",async()=>{
  if(!auth.currentUser)return;
  resendButton.disabled=true;
  try{await sendEmailVerification(auth.currentUser);showStatus("Verification email sent. Check inbox and spam.","success");}
  catch(error){showStatus("Could not send verification email: "+error.message,"error");}
  finally{resendButton.disabled=false;}
});

recoveryForm.addEventListener("submit",async(event)=>{
  event.preventDefault();
  if(!currentUser)return;
  const name=recoveryName.value.trim();
  if(!name){showStatus("Please enter your full name.","error");return;}
  saveRecoveryProfile.disabled=true;
  showStatus("Saving your profile to Firebase Realtime Database…");
  const profile={
    uid:currentUser.uid,
    fullName:name,
    email:currentUser.email||"",
    createdAt:currentUser.metadata.creationTime?new Date(currentUser.metadata.creationTime).getTime():Date.now(),
    emailVerified:currentUser.emailVerified,
    profileRecoveredAt:Date.now()
  };
  try{
    await set(ref(db,"users/"+currentUser.uid),profile);
    try{await updateProfile(currentUser,{displayName:name});}catch(profileUpdateError){console.warn("Auth display-name update failed:",profileUpdateError);}
    showProfile(name,profile.email);
    recoveryCard.style.display="none";
    diagnostic(diagProfile,"Profile created ✓","#63e7b1");
    showStatus("Your profile was successfully saved to Realtime Database.","success");
  }catch(error){
    diagnostic(diagProfile,"Profile save failed: "+error.message,"#ff8a8a");
    showStatus("Could not save profile. Check database rules and connection: "+error.message,"error");
  }finally{saveRecoveryProfile.disabled=false;}
});

// Realtime Database connection status
try{
  onValue(ref(db,".info/connected"),snap=>{
    diagnostic(diagDb,snap.val()===true?"Connected ✓":"Disconnected",snap.val()===true?"#63e7b1":"#ff8a8a");
  },error=>diagnostic(diagDb,"Connection listener failed: "+error.message,"#ff8a8a"));
}catch(error){diagnostic(diagDb,"Could not start: "+error.message,"#ff8a8a");}

onAuthStateChanged(auth,async(user)=>{
  if(!user){diagnostic(diagAuth,"No signed-in user","#ff8a8a");showStatus("No active session. Redirecting to sign-in…","error");setTimeout(()=>window.location.replace("account.html"),900);return;}
  currentUser=user;
  subscribeToClientProjects(user.uid);
  diagnostic(diagAuth,"Signed in ✓","#63e7b1");
  verificationStatus.textContent=user.emailVerified?"Verified ✓":"Not verified";
  resendButton.hidden=user.emailVerified;
  showStatus("Authentication succeeded. Checking your Realtime Database profile…");
  try{
    const snap=await get(ref(db,"users/"+user.uid));
    if(snap.exists()){
      const profile=snap.val()||{};
      const name=profile.fullName||user.displayName||"";
      showProfile(name,profile.email||user.email||"");
      if(!name)showRecovery(name);
      diagnostic(diagProfile,name?"Found ✓":"Profile exists, but name is missing",name?"#63e7b1":"#ffb86b");
      showStatus("Profile loaded from Realtime Database.","success");
    }else{
      showProfile(user.displayName||"",user.email||"");
      showRecovery(user.displayName||"");
      diagnostic(diagProfile,"Missing. This account's profile record was not saved previously.","#ffb86b");
      showStatus("Your account exists, but its profile record is missing. Complete the form below to restore it.","error");
    }
  }catch(error){
    showProfile(user.displayName||"",user.email||"");
    diagnostic(diagProfile,"Read failed: "+error.message,"#ff8a8a");
    showStatus("Profile lookup failed. Check the database connection and /users/"+user.uid+" rules. "+error.message,"error");
  }
});
