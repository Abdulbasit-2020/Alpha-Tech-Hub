# Alpha Tech Hub — Firebase backend deployment

This repository's public website is hosted on GitHub Pages. Firebase is used for Authentication, Cloud Firestore and callable Cloud Functions.

## Before deploying

1. Open the Firebase project `alpha-tech-hub-8d863` in the Firebase Console.
2. Enable **Cloud Firestore** and create its database. Choose a location close to your users and keep that location consistent with your project requirements. Existing Realtime Database data is not automatically moved.
3. Make sure **Authentication → Sign-in method → Email/Password** is enabled.
4. Link a billing account and upgrade to the **Blaze** plan if Firebase requires it for Cloud Functions deployment. Review Google Cloud costs and set budget alerts first.
5. Install Node.js 22 and the Firebase CLI on a computer.

## Deploy

From the repository root, run:

```bash
npm install -g firebase-tools
firebase login
firebase use alpha-tech-hub-8d863
cd functions
npm install
npm run lint
cd ..
firebase deploy --only firestore:rules,functions
```

The deployment publishes the Firestore security rules and these callable functions in `europe-west1`:

- `createServiceRequest` — securely saves website enquiries.
- `ensureClientProfile` — creates/updates the signed-in user's basic Firestore profile and client record. It does not allow a client to assign themselves admin privileges or change an existing client status.

## After deployment: test

1. Open `account.html` on the published website.
2. Register with an email address you can access.
3. Confirm that the verification email arrives, then verify the address.
4. Sign in again. The account page should send you to `firestore-client.html`.
5. In Firebase Console → Firestore, confirm that `users/{uid}` and `clients/{uid}` exist.
6. Submit a test enquiry through `contact.html` and confirm a new document appears in `serviceRequests`.

## Important

- Do not paste service-account keys or private credentials into GitHub or browser JavaScript.
- The Firebase web config in the frontend identifies the project; Firestore security rules and server-side validation protect data.
- The old Realtime Database remains in place until its data has been reviewed and the separate migration tool is deliberately run. Do not delete the old database during this deployment.
- The Firestore admin page also requires an administrator custom claim (`admin: true`) to be assigned securely using the Firebase Admin SDK. A normal user must never be able to grant themselves this claim.
- GitHub Pages deployment does not deploy Cloud Functions. Firebase deployment is a separate step.
