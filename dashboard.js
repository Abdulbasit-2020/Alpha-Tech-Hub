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
function showProfile(name,email){
  const displayName=name||"Member";
  userName.textContent=displayName;
  profileName.textContent=name||"Name not found in profile";
  profileEmail.textContent=email||"Email not available";
}

logoutButton.addEventListener("click",async()=>{
  logoutButton.disabled=true;
  try{await signOut(auth);window.location.href="account.html";}
  catch(error){showStatus("Sign-out failed: "+error.message,"error");logoutButton.disabled=false;}
});

resendButton.addEventListener("click",async()=>{
  if(!auth.currentUser)return;
  resendButton.disabled=true;
  try{await sendEmailVerification(auth.currentUser);showStatus("Verification email sent. Check your inbox and spam folder.","success");}
  catch(error){showStatus("Could not send verification email: "+error.message,"error");}
  finally{resendButton.disabled=false;}
});

onAuthStateChanged(auth,async(user)=>{
  if(!user){window.location.replace("account.html");return;}
  verificationStatus.textContent=user.emailVerified?"Verified ✓":"Not verified";
  resendButton.hidden=user.emailVerified;
  // Fetch the profile from Firebase Realtime Database regardless of verification status.
  try{
    const snap=await get(ref(db,"users/"+user.uid));
    const profile=snap.exists()?snap.val():{};
    showProfile(profile.fullName||user.displayName||"",profile.email||user.email||"");
    if(!snap.exists()){
      showStatus("Signed in, but no Realtime Database profile record was found for this account.","error");
    }else if(!user.emailVerified){
      showStatus("Your email is not verified yet. Verify it to unlock your account.","error");
    }else{
      showStatus("Profile loaded from Firebase Realtime Database.","success");
    }
  }catch(error){
    showProfile(user.displayName||"",user.email||"");
    showStatus("Could not read your Firebase Realtime Database profile. Check the /users/"+user.uid+" read rule. "+error.message,"error");
  }
});
