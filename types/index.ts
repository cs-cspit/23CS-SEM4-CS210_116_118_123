export interface FileMetadata {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  path: string;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
  isPublic: boolean;
  password?: string;
  expiresAt?: Date;
  downloadCount: number;
  parentFolderId?: string;
  hash: string;
}

export interface FolderMetadata {
  id: string;
  name: string;
  path: string;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
  isPublic: boolean;
  parentFolderId?: string;
}

export interface ShareSettings {
  id: string;
  fileId: string;
  isPublic: boolean;
  password?: string;
  expiresAt?: Date;
  allowDownload: boolean;
  allowView: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  storageUsed: number;
  storageLimit: number;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date;
  isAdmin: boolean;
}

export type SortOption = 'name' | 'size' | 'type' | 'date';
export type SortDirection = 'asc' | 'desc'; 