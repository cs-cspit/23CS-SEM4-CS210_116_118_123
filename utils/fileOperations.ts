import { storage, db } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { FileMetadata } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export const calculateFileHash = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const hash = crypto.createHash('sha256');
      hash.update(e.target?.result as ArrayBuffer);
      resolve(hash.digest('hex'));
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

export const uploadFile = async (
  file: File,
  path: string,
  onProgress?: (progress: number) => void
): Promise<FileMetadata> => {
  const fileId = uuidv4();
  const fileHash = await calculateFileHash(file);
  const storageRef = ref(storage, `${path}/${fileId}-${file.name}`);
  
  const uploadTask = uploadBytesResumable(storageRef, file);
  
  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(progress);
      },
      (error) => reject(error),
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          
          const fileMetadata: FileMetadata = {
            id: fileId,
            name: file.name,
            type: file.type,
            size: file.size,
            url: downloadURL,
            path: `${path}/${fileId}-${file.name}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            ownerId: '', // Set this from the auth context
            isPublic: false,
            downloadCount: 0,
            hash: fileHash,
          };
          
          await setDoc(doc(db, 'files', fileId), fileMetadata);
          resolve(fileMetadata);
        } catch (error) {
          reject(error);
        }
      }
    );
  });
};

export const deleteFile = async (fileId: string, path: string): Promise<void> => {
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
  await deleteDoc(doc(db, 'files', fileId));
};

export const updateFileMetadata = async (
  fileId: string,
  updates: Partial<FileMetadata>
): Promise<void> => {
  await updateDoc(doc(db, 'files', fileId), {
    ...updates,
    updatedAt: new Date(),
  });
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const getFileTypeIcon = (type: string): string => {
  const fileTypes: { [key: string]: string } = {
    'image/': '🖼️',
    'video/': '🎥',
    'audio/': '🎵',
    'application/pdf': '📄',
    'application/msword': '📝',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
    'application/vnd.ms-excel': '📊',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
    'application/zip': '📦',
    'text/': '📝',
  };

  const matchingType = Object.keys(fileTypes).find((key) => type.startsWith(key));
  return matchingType ? fileTypes[matchingType] : '📄';
}; 