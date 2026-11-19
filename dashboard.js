import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut, sendEmailVerification } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const statusBox=document.getElementById("dashboardStatus");
const userName=document.getElementById("userName");
const profileName=document.getElementById("profileName");
const profileEmail=document.getElementById("profileEmail");
const verificationStatus=document.getElementById("verificationStatus");
const resendButton=document.getElementById("resendVerification");
const logoutButton=document.getElementById("logoutButton");

function showStatus(text,type=""){statusBox.textContent=text;statusBox.className="dash-status"+(type?" "+type:"");}

logoutButton.addEventListener("click",async()=>{
  logoutButton.disabled=true;
  try{await signOut(auth);window.location.href="account.html";}
  catch(error){showStatus(error.message,"error");logoutButton.disabled=false;}
});

resendButton.addEventListener("click",async()=>{
  if(!auth.currentUser)return;
  resendButton.disabled=true;
  try{await sendEmailVerification(auth.currentUser);showStatus("Verification email sent. Check your inbox and spam folder.","success");}
  catch(error){showStatus(error.message,"error");}
  finally{resendButton.disabled=false;}
});

onAuthStateChanged(auth,async(user)=>{
  if(!user){window.location.replace("account.html");return;}
  if(!user.emailVerified){showStatus("Your email is not verified. Verify it to access your account.","error");verificationStatus.textContent="Not verified";resendButton.hidden=false;return;}
  try{
    const snap=await get(ref(db,"users/"+user.uid));
    const profile=snap.exists()?snap.val():{};
    const name=profile.fullName||user.displayName||"Member";
    userName.textContent=name;
    profileName.textContent=name;
    profileEmail.textContent=user.email||"Not available";
    verificationStatus.textContent="Verified ✓";
    showStatus("You're signed in. Your account dashboard is ready.","success");
  }catch(error){showStatus("Could not load profile details. "+error.message,"error");}
});
