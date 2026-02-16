
export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video'
}

export interface User {
  id: string;
  email: string;
  password?: string;
  name: string;
}

export interface MediaItem {
  id: string;
  userId: string;
  type: MediaType;
  url: string; // Base64 data for local storage
  title: string;
  description: string;
  timestamp: number;
  duration?: number;
}

export type ViewType = 'photos' | 'videos' | 'upload';
export type AuthView = 'signin' | 'signup' | 'forgot';
