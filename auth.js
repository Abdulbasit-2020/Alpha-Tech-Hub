import { auth, db } from "./firestore.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const form = document.getElementById("authForm");
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const nameField = document.getElementById("nameField");
const fullName = document.getElementById("fullName");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const resetLink = document.getElementById("resetLink");
const submitButton = document.getElementById("submitButton");
const statusBox = document.getElementById("authStatus");
const intro = document.getElementById("authIntro");

let mode = "login";

function setStatus(message, type = "") {
  statusBox.textContent = message;
  statusBox.className = "auth-status" + (type ? " " + type : "");
}

function setMode(nextMode) {
  mode = nextMode;
  const isRegister = mode === "register";
  loginTab.classList.toggle("active", !isRegister);
  registerTab.classList.toggle("active", isRegister);
  nameField.hidden = !isRegister;
  fullName.required = isRegister;
  passwordInput.autocomplete = isRegister ? "new-password" : "current-password";
  submitButton.textContent = isRegister ? "Create account" : "Sign in";
  resetLink.hidden = isRegister;
  intro.textContent = isRegister
    ? "Create your account to get started with Alpha Tech Hub."
    : "Sign in to your Alpha Tech Hub account.";
  setStatus("");
}

async function saveClientProfile(user, name, createClient = false) {
  const uid = user.uid;
  const cleanName = String(name || user.displayName || user.email?.split("@")[0] || "Client").trim().slice(0, 80);
  const userRef = doc(db, "users", uid);
  const clientRef = doc(db, "clients", uid);
  const clientSnap = await getDoc(clientRef);
  await setDoc(userRef, {
    uid,
    fullName: cleanName,
    email: user.email,
    emailVerified: user.emailVerified,
    updatedAt: serverTimestamp()
  }, { merge: true });

  // Create the initial client record if it does not exist. The rules permit
  // each signed-in user to read their own document by UID, including when absent.
  if (!clientSnap.exists()) {
    await setDoc(clientRef, {
      uid,
      fullName: cleanName,
      email: user.email,
      status: "Pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
}

resetLink.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  if (!email) {
    setStatus("Enter your email address above, then tap Forgot password again.", "error");
    emailInput.focus();
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    setStatus("Password-reset email sent. Check your inbox and spam folder.", "success");
  } catch (error) {
    setStatus(error.message || "Could not send reset email. Please try again.", "error");
  }
});

loginTab.addEventListener("click", () => setMode("login"));
registerTab.addEventListener("click", () => setMode("register"));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  submitButton.disabled = true;
  setStatus(mode === "register" ? "Creating your account…" : "Signing you in…");

  try {
    if (mode === "register") {
      const name = fullName.value.trim();
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await saveClientProfile(credential.user, name);
      await sendEmailVerification(credential.user);
      await signOut(auth);
      form.reset();
      setMode("login");
      setStatus("Account created! A verification email has been sent. Verify your email before signing in.", "success");
    } else {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      if (!credential.user.emailVerified) {
        await sendEmailVerification(credential.user);
        await signOut(auth);
        setStatus("Your email is not verified yet. We sent a fresh verification link; check your inbox.", "error");
        return;
      }
      await saveClientProfile(credential.user);
      setStatus("Signed in successfully. Opening your client portal…", "success");
      window.location.href = "firestore-client.html";
    }
  } catch (error) {
    const messages = {
      "auth/email-already-in-use": "This email already has an account. Try signing in.",
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/weak-password": "Your password must be at least 6 characters.",
      "auth/invalid-credential": "Email or password is incorrect.",
      "auth/too-many-requests": "Too many attempts. Please wait and try again."
    };
    setStatus((messages[error.code] || error.message || "Something went wrong. Please try again.") + (error.code ? " (" + error.code + ")" : ""), "error");
  } finally {
    submitButton.disabled = false;
  }
});

setMode("login");
