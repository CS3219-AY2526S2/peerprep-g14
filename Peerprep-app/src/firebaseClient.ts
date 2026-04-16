import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { v4 as uuidv4 } from 'uuid';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

/**
 * Uploads an image to Firebase Storage and returns the public download URL.
 */
export const uploadQuestionImage = async (questionId: string, file: File): Promise<string> => {
  if (!file) throw new Error("No file provided");

  const uuid = uuidv4();
  const ext = file.name.split('.').pop();
  const path = `question-images/${questionId}/${uuid}.${ext}`;

  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      null, // you could add progress tracking here if needed
      (error) => reject(error),
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
};

/**
 * Deletes an image from Firebase Storage using its download URL.
 */
export const deleteQuestionImage = async (downloadURL: string): Promise<void> => {
  if (!downloadURL) throw new Error("No URL provided");
  // firebase limits ref() from download URLs if not using a bucket, but since we are setup properly it usually works
  // alternatively, using refFromURL in older SDKs. In v9+: ref(storage, downloadURL)
  const imageRef = ref(storage, downloadURL);
  await deleteObject(imageRef);
};
