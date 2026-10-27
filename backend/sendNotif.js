const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

/* Testing helper. Usage: node sendNotif.js <fcm-token> [user-id] */
const token = process.argv[2] || process.env.TEST_FCM_TOKEN;
if (!token) {
  console.log("Usage: node sendNotif.js <fcm-token> [user-id]");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL || "https://whatsappy-app.firebaseio.com",
});

const db = admin.firestore();

console.log("adding the notif to cloud firestore");
// The listener in index.js watches the "notifications" collection.
db.collection("notifications")
  .add({
    userID: process.argv[3] || "test-user",
    title: "Test notification",
    body: "Hello from sendNotif.js",
    href: process.env.APP_URL || "https://whatsappy-app.web.app/",
    token,
  })
  .then(() => {
    console.log("notif added");
    process.exit(0);
  })
  .catch((e) => {
    console.log(e);
    process.exit(1);
  });
