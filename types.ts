export enum UserRole {
  GUEST = 'GUEST',
  USER = 'USER',
  ADMIN = 'ADMIN'
}

export interface User {
  email: string;
  role: UserRole;
  name: string;
  photoUrl?: string;
  lastActive?: number; // For tracking live users
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string; // base64 or url
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
  userEmail?: string;
}

export interface Template {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  promptTemplate: string; 
  likes: number;
  isPro?: boolean;
}

export interface GeneratedImage {
  id: string;
  userEmail: string;
  imageUrl: string;
  prompt: string;
  timestamp: number;
}

export interface SystemLog {
  id: string;
  type: 'ERROR' | 'INFO';
  message: string;
  timestamp: number;
  userEmail?: string;
}

// Live API Types
export interface LiveConfig {
  model: string;
  systemInstruction?: string;
  voiceName?: string;
}