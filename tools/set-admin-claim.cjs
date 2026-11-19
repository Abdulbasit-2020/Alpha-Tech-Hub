// One-time admin provisioning utility. Run ONLY in a trusted Google Cloud Shell session.
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const readline = require("node:readline/promises");

const PROJECT_ID = "alpha-tech-hub-8d863";

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const email = (await rl.question("Email address to grant admin access: ")).trim().toLowerCase();
    if (!email || !email.includes("@")) throw new Error("Please enter a valid email.");
    const confirm = (await rl.question(`Grant ADMIN privileges to ${email}? Type YES to confirm: `)).trim();
    if (confirm !== "YES") { console.log("Cancelled."); return; }

    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
    const auth = getAuth();
    const user = await auth.getUserByEmail(email);
    await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin: true });
    console.log(`Admin claim set for ${email}. Ask the user to sign out and sign in again to refresh their token.`);
  } finally {
    rl.close();
  }
}
main().catch(error => { console.error("Admin provisioning failed:", error.message); process.exitCode = 1; });
