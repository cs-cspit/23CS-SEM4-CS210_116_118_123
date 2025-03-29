import { db } from '@/config/firebase';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  createdAt: Date;
  updatedAt: Date;
  totalStorage: number; // in bytes
  usedStorage: number; // in bytes
  files: string[]; // array of file IDs
  sharedFiles: string[]; // array of shared file IDs
}

export const createUserProfile = async (uid: string, email: string): Promise<UserProfile> => {
  const userProfile: UserProfile = {
    uid,
    email,
    createdAt: new Date(),
    updatedAt: new Date(),
    totalStorage: 1024 * 1024 * 1024, // 1GB default storage
    usedStorage: 0,
    files: [],
    sharedFiles: []
  };

  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, userProfile);
  return userProfile;
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const userRef = doc(db, 'users', uid);
  const userDoc = await getDoc(userRef);

  if (!userDoc.exists()) {
    return null;
  }

  return userDoc.data() as UserProfile;
};

export const updateUserProfile = async (
  uid: string,
  data: Partial<UserProfile>
): Promise<void> => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    ...data,
    updatedAt: new Date()
  });
};

export const updateUserStorage = async (
  uid: string,
  fileSize: number,
  isAddition: boolean = true
): Promise<void> => {
  const userProfile = await getUserProfile(uid);
  if (!userProfile) {
    throw new Error('User profile not found');
  }

  const newUsedStorage = isAddition
    ? userProfile.usedStorage + fileSize
    : userProfile.usedStorage - fileSize;

  if (newUsedStorage > userProfile.totalStorage) {
    throw new Error('Storage quota exceeded');
  }

  await updateUserProfile(uid, { usedStorage: newUsedStorage });
}; 