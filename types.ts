
export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video'
}

export interface User {
  id: string;
  email: string;
  name: string;
  accessToken?: string;
  driveFolderId?: string;
}

export interface MediaItem {
  id: string; // The Google Drive File ID
  userId: string;
  type: MediaType;
  url: string; // Temporary webContentLink or thumbnailLink
  title: string;
  description: string;
  timestamp: number;
  duration?: number;
}

export type ViewType = 'photos' | 'videos' | 'upload' | 'landing';
export type AuthView = 'landing' | 'options' | 'email-signin' | 'email-signup';
