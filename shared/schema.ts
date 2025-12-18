import { z } from "zod";

// Voice channel configuration schema
export const voiceConfigSchema = z.object({
  appId: z.string().min(1, "App ID is required"),
  channelId: z.string().min(1, "Channel ID is required"),
  userId: z.string().min(1, "User ID is required"),
  token: z.string().optional(),
});

export type VoiceConfig = z.infer<typeof voiceConfigSchema>;

// Connection status enum
export const ConnectionStatus = {
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  RECONNECTING: "reconnecting",
  ERROR: "error",
} as const;

export type ConnectionStatusType = typeof ConnectionStatus[keyof typeof ConnectionStatus];

// Remote user in channel
export interface RemoteUser {
  uid: string | number;
  hasAudio: boolean;
  isSpeaking: boolean;
  audioLevel: number;
}

// Log entry for console
export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: "info" | "warning" | "error" | "success";
}

// Network quality levels
export const NetworkQuality = {
  UNKNOWN: 0,
  EXCELLENT: 1,
  GOOD: 2,
  POOR: 3,
  BAD: 4,
  VERY_BAD: 5,
  DOWN: 6,
} as const;

export type NetworkQualityType = typeof NetworkQuality[keyof typeof NetworkQuality];

// Audio device info
export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: "audioinput" | "audiooutput";
}

// Voice session state
export interface VoiceSessionState {
  status: ConnectionStatusType;
  localMuted: boolean;
  localVolume: number;
  remoteUsers: Map<string | number, RemoteUser>;
  networkQuality: NetworkQualityType;
  logs: LogEntry[];
  selectedMicrophone?: string;
  selectedSpeaker?: string;
}

// Token generation request
export const tokenRequestSchema = z.object({
  channelName: z.string().min(1),
  uid: z.union([z.string(), z.number()]),
  role: z.enum(["publisher", "subscriber"]).default("publisher"),
  expirationTimeInSeconds: z.number().optional().default(3600),
});

export type TokenRequest = z.infer<typeof tokenRequestSchema>;

// Token generation response
export interface TokenResponse {
  token: string;
  channelName: string;
  uid: string | number;
  expiresAt: number;
}

// Saved channel configuration
export const savedChannelSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Channel name is required"),
  appId: z.string().min(1, "App ID is required"),
  channelId: z.string().min(1, "Channel ID is required"),
  userId: z.string().min(1, "User ID is required"),
  token: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SavedChannel = z.infer<typeof savedChannelSchema>;

export const createSavedChannelSchema = savedChannelSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type CreateSavedChannel = z.infer<typeof createSavedChannelSchema>;

export const updateSavedChannelSchema = savedChannelSchema.partial().omit({
  id: true,
  createdAt: true,
});

export type UpdateSavedChannel = z.infer<typeof updateSavedChannelSchema>;
