import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut, getIdTokenResult } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

const status=document.getElementById("adminStatus");
const logout=document.getElementById("adminLogout");
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
    showStatus("Administrator access confirmed. Admin modules are currently under development.");
  }catch(error){
    showStatus("Unable to verify administrator permissions. Access denied.");
    setTimeout(()=>window.location.replace("dashboard.html"),1500);
  }
});
