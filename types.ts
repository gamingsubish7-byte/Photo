
export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video'
}

export interface User {
  id: string;
  email: string;
  password?: string; // In a real app, never store plain text or even return it
  name: string;
}

export interface MediaItem {
  id: string;
  userId: string; // Ownership link
  type: MediaType;
  url: string; // This will store the Base64 data for persistence
  title: string;
  description: string;
  tags: string[];
  timestamp: number;
  duration?: number;
}

export type ViewType = 'photos' | 'videos' | 'upload';
export type AuthView = 'signin' | 'signup' | 'forgot';
