import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut, getIdTokenResult } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const status=document.getElementById("adminStatus");
const logout=document.getElementById("adminLogout");
const adminName=document.getElementById("adminName");
function showStatus(message){status.textContent=message;}

logout.addEventListener("click",async()=>{
  logout.disabled=true;
  try{await signOut(auth);window.location.replace("account.html");}
  catch(error){showStatus("Sign-out failed. Please retry.");logout.disabled=false;}
});

onAuthStateChanged(auth,async(user)=>{
  if(!user){window.location.replace("account.html");return;}
  if(!user.emailVerified){showStatus("Email verification is required. Redirecting…");window.location.replace("account.html");return;}
  try{
    const tokenResult=await getIdTokenResult(user,true);
    if(tokenResult.claims.admin!==true){
      showStatus("Access denied: administrator privileges are required. Redirecting…");
      setTimeout(()=>window.location.replace("dashboard.html"),1500);
      return;
    }
    let name=user.displayName||user.email||"Administrator";
    try{
      const profileSnap=await get(ref(db,"users/"+user.uid));
      if(profileSnap.exists()){
        const profile=profileSnap.val();
        name=profile.fullName||user.displayName||user.email||"Administrator";
      }
    }catch(profileError){console.warn("Could not read admin profile",profileError);}
    adminName.textContent=name;
    showStatus("Administrator access confirmed. Welcome to your management workspace.");
  }catch(error){
    showStatus("Unable to verify administrator permissions. Access denied.");
    setTimeout(()=>window.location.replace("dashboard.html"),1500);
  }
});