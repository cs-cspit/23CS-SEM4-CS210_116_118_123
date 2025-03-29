import { db } from '@/config/firebase';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc, 
  getDoc,
  query,
  where,
  getDocs,
  arrayUnion,
  arrayRemove,
  Timestamp,
  deleteField
} from 'firebase/firestore';
import { updateUserStorage, getUserProfile } from '@/services/userService';

export interface FileData {
  id?: string;
  userId: string;
  name: string;
  displayName?: string;
  originalFilename?: string;
  size: number;
  type: string;
  fileType?: string;
  format?: string;
  url: string;
  secureUrl: string;
  publicId: string;
  assetId?: string;
  width?: number;
  height?: number;
  isPublic: boolean;
  uploadedAt: Date;
  updatedAt?: Date;
  expiresAt?: Date;
  resourceType?: string;
  sharedWith?: string[];
  isPasswordProtected?: boolean;
  password?: string; // Stores hashed password
}

const CLOUDINARY_CLOUD_NAME = 'dppaa4cu5';
const CLOUDINARY_API_KEY = '994829347648593';
const CLOUDINARY_API_SECRET = 'iIhlEuOFSLSavgYm9O9abHZnMrI';

// Function to format bytes into readable format
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Add Cloudinary upload function
const uploadToCloudinary = async (
  formData: FormData,
  onProgress?: (progress: number) => void
) => {
  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`,
      {
        method: 'POST',
        body: formData
      }
    );

    const data = await response.json();
    
    // Log for debugging
    console.log('Cloudinary Response:', data);
    
    // More permissive success check - any response with a public_id or secure_url is considered successful
    if (!data.public_id && !data.secure_url) {
      console.error('Upload failed:', data);
      throw new Error(data.error?.message || 'Failed to upload file');
    }

    return data;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
};

export const uploadFile = async (
  file: File,
  userId: string,
  options?: {
    expiresIn?: number;
    password?: string;
  }
): Promise<FileData> => {
  try {
    // Check user storage quota
    const userProfile = await getUserProfile(userId);
    if (!userProfile) {
      throw new Error('User profile not found');
    }

    if (userProfile.usedStorage + file.size > userProfile.totalStorage) {
      throw new Error('Storage quota exceeded');
    }
    
    // Create FormData for upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'realpreset');
    formData.append('folder', `ofss/${userId}`);

    // Start upload to Cloudinary
    const response = await uploadToCloudinary(formData);

    if (!response) {
      throw new Error('Upload failed');
    }

    // Create file data object
    const fileData: FileData = {
      userId,
      name: file.name,
      displayName: file.name,
      originalFilename: file.name,
      size: file.size,
      type: file.type,
      fileType: file.type,
      format: response.format,
      url: response.url,
      secureUrl: response.secure_url,
      publicId: response.public_id,
      assetId: response.asset_id,
      width: response.width,
      height: response.height,
      isPublic: false,
      uploadedAt: new Date(),
      updatedAt: new Date(),
      resourceType: response.resource_type,
      sharedWith: []
    };

    // Apply password protection if specified
    if (options?.password) {
      fileData.isPasswordProtected = true;
      fileData.password = await hashPassword(options.password);
    }

    // Apply expiration if specified
    if (options?.expiresIn) {
      const expirationDate = new Date();
      expirationDate.setHours(expirationDate.getHours() + options.expiresIn);
      fileData.expiresAt = expirationDate;
    }
    
    // Add file to Firestore
    const fileRef = await addDoc(collection(db, 'files'), fileData);
    
    // Update user's storage usage
    await updateUserStorage(userId, file.size);
    
    return { ...fileData, id: fileRef.id };
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

// Get all files for a specific user
export const getUserFiles = async (userId: string): Promise<FileData[]> => {
  try {
    const filesQuery = query(
      collection(db, 'files'),
      where('userId', '==', userId)
    );
    
    const querySnapshot = await getDocs(filesQuery);
    const files = querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Safely handle Timestamp conversion
      let uploadedAt: Date;
      if (data.uploadedAt) {
        if (typeof data.uploadedAt.toDate === 'function') {
          uploadedAt = data.uploadedAt.toDate();
        } else if (data.uploadedAt instanceof Date) {
          uploadedAt = data.uploadedAt;
        } else {
          uploadedAt = new Date(data.uploadedAt);
        }
      } else {
        uploadedAt = new Date();
      }
      
      // Handle expiresAt if present
      let expiresAt: Date | undefined;
      if (data.expiresAt) {
        if (typeof data.expiresAt.toDate === 'function') {
          expiresAt = data.expiresAt.toDate();
        } else if (data.expiresAt instanceof Date) {
          expiresAt = data.expiresAt;
        } else {
          expiresAt = new Date(data.expiresAt);
        }
      }

      return {
        ...data,
        id: doc.id,
        uploadedAt,
        expiresAt
      };
    }) as FileData[];

    // Log the number of files for debugging
    console.log(`Retrieved ${files.length} files for user ${userId}`);
    
    // Filter out expired files
    const now = new Date();
    const validFiles = files.filter(file => {
      // Keep files that don't have an expiration date or haven't expired yet
      return !file.expiresAt || file.expiresAt > now;
    });
    
    console.log(`Filtered to ${validFiles.length} non-expired files`);
    
    // Sort files by upload date (newest first)
    return validFiles.sort((a, b) => {
      const timeA = a.uploadedAt instanceof Date ? a.uploadedAt.getTime() : 0;
      const timeB = b.uploadedAt instanceof Date ? b.uploadedAt.getTime() : 0;
      return timeB - timeA;
    });
  } catch (error) {
    console.error('Error getting user files:', error);
    throw error;
  }
};

// Get user storage info
export const getUserStorageInfo = async (userId: string) => {
  const userProfile = await getUserProfile(userId);
  if (!userProfile) {
    throw new Error('User profile not found');
  }

  return {
    total: formatBytes(userProfile.totalStorage),
    used: formatBytes(userProfile.usedStorage),
    available: formatBytes(userProfile.totalStorage - userProfile.usedStorage),
    percentUsed: Math.round((userProfile.usedStorage / userProfile.totalStorage) * 100)
  };
};

const generateSignature = async (params: Record<string, string>) => {
  // Sort parameters alphabetically
  const sortedParams = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
  
  // Create the string to sign
  const stringToSign = Object.entries(sortedParams)
    .map(([key, value]) => `${key}=${value}`)
    .join('&') + CLOUDINARY_API_SECRET;
  
  console.log('String to sign:', stringToSign); // For debugging
  
  // Generate SHA-1 hash using Web Crypto API
  const encoder = new TextEncoder();
  const data = encoder.encode(stringToSign);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
};

export const deleteFile = async (fileId: string, userId: string) => {
  try {
    const fileRef = doc(db, 'files', fileId);
    const fileDoc = await getDoc(fileRef);
    
    if (!fileDoc.exists()) {
      throw new Error('File not found');
    }
    
    const fileData = fileDoc.data() as FileData;
    if (fileData.userId !== userId) {
      throw new Error('Unauthorized');
    }
    
    const timestamp = Math.round((new Date()).getTime() / 1000).toString();
    
    // Create a simple form-based deletion request that matches how Cloudinary Admin API works
    const formData = new FormData();
    formData.append('public_id', fileData.publicId);
    formData.append('timestamp', timestamp);
    formData.append('api_key', CLOUDINARY_API_KEY);
    
    // Generate signature with just the essential parameters
    const signature = await generateSignature({
      public_id: fileData.publicId,
      timestamp,
      api_key: CLOUDINARY_API_KEY
    });
    
    formData.append('signature', signature);
    
    // Send the destruction request
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`,
      {
        method: 'POST',
        body: formData
      }
    );
    
    const result = await response.json();
    console.log('Cloudinary delete response:', result);
    
    // If the response contains a result parameter but not success, it's an error
    if (!response.ok || (result && !result.result)) {
      console.error('Failed to delete from Cloudinary:', result);
    }

    // Update user's files array and storage usage
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      files: arrayRemove(fileId),
      updatedAt: new Date()
    });
    
    // Update user's storage usage
    await updateUserStorage(userId, fileData.size, false);
    
    // Delete file record from Firestore
    await deleteDoc(fileRef);
    
    return { success: true };
  } catch (error) {
    console.error('Delete error:', error);
    throw error;
  }
};

export const shareFile = async (
  fileId: string,
  userId: string,
  email: string
): Promise<void> => {
  try {
    const fileRef = doc(db, 'files', fileId);
    const fileDoc = await getDoc(fileRef);
    
    if (!fileDoc.exists()) {
      throw new Error('File not found');
    }
    
    const fileData = fileDoc.data() as FileData;
    
    if (fileData.userId !== userId) {
      throw new Error('You do not have permission to share this file');
    }
    
    // Update file with new shared user
    await updateDoc(fileRef, {
      sharedWith: arrayUnion(email)
    });
    
  } catch (error) {
    console.error('Error sharing file:', error);
    throw error;
  }
};

// Simple password hashing using SHA-256
const hashPassword = async (password: string): Promise<string> => {
  // Use the Web Crypto API which is available in modern browsers
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const generateShareableLink = async (
  fileId: string,
  userId: string,
  options?: {
    expiresIn?: number;
    password?: string;
  }
): Promise<string> => {
  try {
    const fileRef = doc(db, 'files', fileId);
    const fileDoc = await getDoc(fileRef);
    
    if (!fileDoc.exists()) {
      throw new Error('File not found');
    }
    
    const fileData = fileDoc.data() as FileData;
    
    // Check if the user is the owner of the file
    if (fileData.userId !== userId) {
      throw new Error('You do not have permission to share this file');
    }
    
    const updateData: any = {
      isPublic: true,
    };
    
    // Handle expiration
    if (options?.expiresIn) {
      // Set expiration time (current time + expiresIn hours)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + options.expiresIn);
      updateData.expiresAt = expiresAt;
    } else if (options?.expiresIn === null) {
      // Remove expiration if explicitly set to null
      updateData.expiresAt = deleteField();
    }
    
    // Handle password protection
    if (options?.password) {
      updateData.isPasswordProtected = true;
      updateData.password = await hashPassword(options.password);
    }
    
    // Update the file document
    await updateDoc(fileRef, updateData);
    
    // Generate and return the public URL
    return `${window.location.origin}/files/${fileId}`;
  } catch (error) {
    console.error('Error generating shareable link:', error);
    throw error;
  }
};

// Verify password for a password-protected file
export const verifyFilePassword = async (fileId: string, password: string): Promise<boolean> => {
  try {
    const fileRef = doc(db, 'files', fileId);
    const fileDoc = await getDoc(fileRef);
    
    if (!fileDoc.exists()) {
      throw new Error('File not found');
    }
    
    const fileData = fileDoc.data() as FileData;
    
    // Check if file is password protected
    if (!fileData.isPasswordProtected) {
      return true; // File is not password protected, so access is allowed
    }
    
    // Hash the provided password and compare with stored hash
    const hashedPassword = await hashPassword(password);
    return fileData.password === hashedPassword;
  } catch (error) {
    console.error('Error verifying file password:', error);
    return false;
  }
};

export const getSharedFiles = async (email: string): Promise<FileData[]> => {
  try {
    const q = query(
      collection(db, 'files'),
      where('sharedWith', 'array-contains', email)
    );
    
    const filesSnapshot = await getDocs(q);
    const files: FileData[] = [];
    
    filesSnapshot.forEach((doc) => {
      const fileData = doc.data() as FileData;
      files.push({
        ...fileData,
        id: doc.id
      });
    });
    
    return files;
  } catch (error) {
    console.error('Error getting shared files:', error);
    return [];
  }
};

export const getPublicFile = async (fileId: string): Promise<FileData | null> => {
  try {
    const fileRef = doc(db, 'files', fileId);
    const fileDoc = await getDoc(fileRef);
    
    if (!fileDoc.exists()) {
      return null;
    }
    
    const fileData = fileDoc.data();
    
    // Check if file is public
    if (!fileData.isPublic) {
      return null;
    }
    
    // Check if file has expired
    if (fileData.expiresAt) {
      const expirationDate = fileData.expiresAt.toDate();
      const now = new Date();
      
      if (now > expirationDate) {
        // File has expired
        console.log(`Attempted access to expired file: ${fileId}`);
        return null;
      }
    }
    
    // Convert Firestore Timestamp to Date if needed
    const uploadedAt = fileData.uploadedAt && typeof fileData.uploadedAt.toDate === 'function' 
      ? fileData.uploadedAt.toDate() 
      : fileData.uploadedAt;
    
    const expiresAt = fileData.expiresAt && typeof fileData.expiresAt.toDate === 'function'
      ? fileData.expiresAt.toDate()
      : fileData.expiresAt;
    
    return { 
      ...fileData, 
      id: fileDoc.id,
      uploadedAt,
      expiresAt
    } as FileData;
  } catch (error) {
    console.error('Error getting public file:', error);
    return null;
  }
};

// Check for and delete expired files
export const cleanupExpiredFiles = async () => {
  try {
    const now = new Date();
    
    // Query for files that have expired
    const expiredFilesQuery = query(
      collection(db, 'files'),
      where('expiresAt', '<', now),
      where('isPublic', '==', true)
    );
    
    const querySnapshot = await getDocs(expiredFilesQuery);
    
    // Delete each expired file
    const deletePromises = querySnapshot.docs.map(async (docSnapshot) => {
      const fileData = docSnapshot.data() as FileData;
      
      try {
        // Delete the file using our existing deleteFile function
        if (fileData.userId) {
          await deleteFile(docSnapshot.id, fileData.userId);
          console.log(`Auto-deleted expired file: ${fileData.name}`);
        }
      } catch (error) {
        console.error(`Failed to auto-delete file ${docSnapshot.id}:`, error);
      }
    });
    
    await Promise.all(deletePromises);
    
    return querySnapshot.size; // Return the number of files cleaned up
  } catch (error) {
    console.error('Error cleaning up expired files:', error);
    throw error;
  }
}; 