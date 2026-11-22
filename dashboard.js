import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut, sendEmailVerification } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { ref, get, onValue } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

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

function showStatus(text,type=""){statusBox.textContent=text;statusBox.className="dash-status"+(type?" "+type:"");}
function diagnostic(el,text,color){el.textContent=text;if(color)el.style.color=color;}
function showProfile(name,email){
  userName.textContent=name||"Member";
  profileName.textContent=name||"Name not found in profile";
  profileEmail.textContent=email||"Email not available";
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

// RTDB connectivity indicator uses Firebase's reserved connection-status path.
try{
  onValue(ref(db,".info/connected"),snap=>{
    diagnostic(diagDb,snap.val()===true?"Connected ✓":"Disconnected",snap.val()===true?"#63e7b1":"#ff8a8a");
  },error=>{
    diagnostic(diagDb,"Connection listener failed: "+error.message,"#ff8a8a");
  });
}catch(error){
  diagnostic(diagDb,"Could not start: "+error.message,"#ff8a8a");
}

onAuthStateChanged(auth,async(user)=>{
  if(!user){
    diagnostic(diagAuth,"No signed-in user","#ff8a8a");
    showStatus("No active session. Redirecting to sign-in…","error");
    window.setTimeout(()=>window.location.replace("account.html"),900);
    return;
  }
  diagnostic(diagAuth,"Signed in ✓","#63e7b1");
  verificationStatus.textContent=user.emailVerified?"Verified ✓":"Not verified";
  resendButton.hidden=user.emailVerified;
  showStatus("Authentication succeeded. Checking your Realtime Database profile…");
  try{
    const profilePromise=get(ref(db,"users/"+user.uid));
    const timeoutPromise=new Promise((_,reject)=>setTimeout(()=>reject(new Error("Profile read timed out after 10 seconds. Database may be unreachable or rules may block access.")),10000));
    const snap=await Promise.race([profilePromise,timeoutPromise]);
    if(snap.exists()){
      const profile=snap.val()||{};
      showProfile(profile.fullName||user.displayName||"",profile.email||user.email||"");
      diagnostic(diagProfile,"Found ✓","#63e7b1");
      showStatus(user.emailVerified?"Profile loaded from Realtime Database.":"Profile loaded, but verify your email.","success");
    }else{
      showProfile(user.displayName||"",user.email||"");
      diagnostic(diagProfile,"Record not found at /users/"+user.uid,"#ffb86b");
      showStatus("Firebase connected, but this account has no profile record at the expected path.","error");
    }
  }catch(error){
    showProfile(user.displayName||"",user.email||"");
    diagnostic(diagProfile,"Read failed: "+error.message,"#ff8a8a");
    showStatus("Profile lookup failed. See the diagnostics above for the exact failure.","error");
  }
});
