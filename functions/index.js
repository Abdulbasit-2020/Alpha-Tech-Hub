const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

if (!getApps().length) initializeApp();
const db = getFirestore();

const clean = (value, max) => String(value ?? "").trim().slice(0, max);

exports.createServiceRequest = onCall(
  { region: "europe-west1" },
  async (request) => {
    const data = request.data || {};
    const name = clean(data.name, 120);
    const email = clean(data.email, 200).toLowerCase();
    const phone = clean(data.phone, 40);
    const service = clean(data.service, 120);
    const message = clean(data.message, 3000);
    const budget = clean(data.budget, 80);

    if (!name || !email || !service || !message) {
      throw new HttpsError("invalid-argument", "Name, email, service and message are required.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpsError("invalid-argument", "Enter a valid email address.");
    }

    const ref = await db.collection("serviceRequests").add({
      name, email, phone, service, budget, message,
      status: "New",
      createdAt: FieldValue.serverTimestamp(),
      submittedBy: request.auth ? request.auth.uid : null,
      source: "website"
    });

    return { success: true, requestId: ref.id };
  }
);


exports.ensureClientProfile = onCall(
  { region: "europe-west1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in before creating a client profile.");
    }

    const uid = request.auth.uid;
    const tokenEmail = clean(request.auth.token.email, 200).toLowerCase();
    const suppliedEmail = clean(request.data?.email, 200).toLowerCase();
    const fullName = clean(request.data?.fullName, 80);

    if (!tokenEmail || suppliedEmail !== tokenEmail) {
      throw new HttpsError("permission-denied", "The profile email must match your signed-in account.");
    }
    if (!fullName) {
      throw new HttpsError("invalid-argument", "Your full name is required.");
    }

    const userRef = db.collection("users").doc(uid);
    const clientRef = db.collection("clients").doc(uid);
    const [userSnap, clientSnap] = await Promise.all([userRef.get(), clientRef.get()]);
    const now = FieldValue.serverTimestamp();
    const status = request.auth.token.email_verified ? "Active" : "Pending";

    await db.runTransaction(async (transaction) => {
      const currentClient = await transaction.get(clientRef);
      transaction.set(userRef, {
        uid,
        fullName,
        email: tokenEmail,
        emailVerified: Boolean(request.auth.token.email_verified),
        ...(userSnap.exists ? {} : { createdAt: now })
      }, { merge: true });

      transaction.set(clientRef, {
        uid,
        fullName,
        email: tokenEmail,
        ...(currentClient.exists ? {} : { status, createdAt: now }),
        updatedAt: now
      }, { merge: true });
    });

    return { success: true, profileCreated: !userSnap.exists || !clientSnap.exists };
  }
);
