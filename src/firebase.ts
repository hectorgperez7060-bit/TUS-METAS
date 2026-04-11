import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Rebuilding Firebase instance from scratch
console.log('Firebase: Initializing with config:', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  databaseId: firebaseConfig.firestoreDatabaseId
});

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

console.log('Firebase: Auth and Firestore initialized.');

// Validate Connection to Firestore
async function testConnection() {
  console.log('Firestore: Testing connection...');
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firestore: Connection established successfully.');
  } catch (error) {
    console.warn('Firestore: Connection test failed (expected if doc missing):', error);
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
  }
}
testConnection();
