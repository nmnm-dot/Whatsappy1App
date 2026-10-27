const admin = require("firebase-admin");
const algoliasearch = require("algoliasearch");
// Download your own service account key from the Firebase console. NEVER commit it.
const serviceAccount = require("./serviceAccountKey.json");

// Algolia admin credentials come from the environment (see .env.example).
const client = algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_ADMIN_KEY);
const index = client.initIndex("whatsappy-app");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL || "https://whatsappy-app.firebaseio.com",
});

const db = admin.firestore();
const db2 = admin.database();

// FCM "data" payload values must all be strings.
function toStringMap(data) {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)])
  );
}

async function handleNotification(change) {
  if (change.type !== "added") return;
  const data = change.doc.data();
  if (!data) return;
  console.log("\nnotification was found");
  console.log(data);
  try {
    if (!data.token) throw new Error("notification has no token");
    const response = await admin.messaging().send({
      data: toStringMap(data),
      token: data.token,
    });
    console.log("notification successfully sent ", response);
  } catch (error) {
    console.log("error sending notification ", error);
  } finally {
    // Delete only after the send attempt so a crash can't silently drop a notification.
    try {
      await db.collection("notifications").doc(change.doc.id).delete();
      console.log("notification deleted from database");
    } catch (error) {
      console.log("error deleting notification ", error);
    }
  }
}

let listening = false;
db.collection("notifications").onSnapshot(
  (snap) => {
    if (!listening) {
      console.log("listening for notifications...");
      listening = true;
    }
    snap.docChanges().forEach((change) => handleNotification(change));
  },
  (error) => console.log("notifications listener error: ", error)
);

db.collection("users").onSnapshot(
  (snap) => handleSnap(snap, true),
  (error) => console.log("users listener error: ", error)
);
db.collection("rooms")
  .orderBy("timestamp")
  .onSnapshot(
    (snap) => handleSnap(snap, false),
    (error) => console.log("rooms listener error: ", error)
  );
db2.ref("/status/").on("child_added", (data) => handleOnlineStatus(data, "child_added"));
db2.ref("/status/").on("child_changed", (data) => handleOnlineStatus(data, "child_changed"));

function handleSnap(snap, update) {
  snap.docChanges().forEach(async (change) => {
    try {
      if (change.type === "added" || (change.type === "modified" && update)) {
        console.log("document added or modified\n");
        const data = change.doc.data();
        data.objectID = change.doc.id;
        if (!update) {
          data.lastMessage = "";
        }
        console.log("document: ", data);
        await index.saveObject(data);
        console.log("object successfully saved !!!");
      } else if (change.type === "removed") {
        console.log("document was deleted\n");
        console.log("document: ", change.doc.data());
        await index.deleteObject(change.doc.id);
        console.log("object successfully deleted !!!");
      }
    } catch (error) {
      console.log("error syncing document with Algolia: ", error);
    }
  });
}

async function handleOnlineStatus(data, event) {
  try {
    console.log("setting online status with event: ", event);
    // Data written to the Realtime Database
    const eventStatus = data.val();
    console.log("eventStatus: ", eventStatus);
    if (!eventStatus || !eventStatus.id) return;
    // Matching Firestore document
    const userStatusFirestoreRef = db.doc(`users/${eventStatus.id}`);

    // The change that triggered this event may already be overwritten by a faster
    // online/offline change, so re-read the current value and compare timestamps.
    const statusSnapshot = await data.ref.once("value");
    const status = statusSnapshot.val();
    console.log(status, eventStatus);
    if (!status) return;
    // Only write if nothing newer has arrived.
    if (status.last_changed <= eventStatus.last_changed) {
      eventStatus.last_changed = new Date(eventStatus.last_changed);
      await userStatusFirestoreRef.set(eventStatus, { merge: true });
      console.log("user: " + eventStatus.id + " online status was successfully updated !!!");
    } else {
      console.log("next status timestamp is newer for user: ", eventStatus.id);
    }
  } catch (error) {
    console.log("error updating online status: ", error);
  }
}
