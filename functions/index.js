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
