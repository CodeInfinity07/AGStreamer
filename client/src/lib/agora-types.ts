// Agora RTC SDK type definitions for browser usage
// The SDK is loaded via CDN script tag

export interface IAgoraRTCClient {
  join(appId: string, channel: string, token: string | null, uid?: string | number | null): Promise<string | number>;
  leave(): Promise<void>;
  publish(tracks: ILocalAudioTrack | ILocalAudioTrack[]): Promise<void>;
  unpublish(tracks?: ILocalAudioTrack | ILocalAudioTrack[]): Promise<void>;
  subscribe(user: IAgoraRTCRemoteUser, mediaType: "audio" | "video"): Promise<IRemoteAudioTrack | IRemoteVideoTrack>;
  unsubscribe(user: IAgoraRTCRemoteUser, mediaType?: "audio" | "video"): Promise<void>;
  on(event: string, callback: (...args: any[]) => void): void;
  off(event: string, callback: (...args: any[]) => void): void;
  removeAllListeners(): void;
  connectionState: "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "RECONNECTING" | "DISCONNECTING";
  remoteUsers: IAgoraRTCRemoteUser[];
  localTracks: (ILocalAudioTrack | ILocalVideoTrack)[];
  uid?: string | number;
}

export interface IAgoraRTCRemoteUser {
  uid: string | number;
  hasAudio: boolean;
  hasVideo: boolean;
  audioTrack?: IRemoteAudioTrack;
  videoTrack?: IRemoteVideoTrack;
}

export interface ILocalAudioTrack {
  setEnabled(enabled: boolean): Promise<void>;
  setVolume(volume: number): void;
  getVolumeLevel(): number;
  close(): void;
  play(): void;
  stop(): void;
  setDevice(deviceId: string): Promise<void>;
  getTrackId(): string;
}

export interface ILocalVideoTrack {
  setEnabled(enabled: boolean): Promise<void>;
  close(): void;
  play(element: HTMLElement | string): void;
  stop(): void;
}

export interface IRemoteAudioTrack {
  play(): void;
  stop(): void;
  setVolume(volume: number): void;
  getVolumeLevel(): number;
}

export interface IRemoteVideoTrack {
  play(element: HTMLElement | string): void;
  stop(): void;
}

export interface IBufferSourceAudioTrack extends ILocalAudioTrack {
  startProcessAudioBuffer(options?: { loop?: boolean }): void;
  stopProcessAudioBuffer(): void;
  pauseProcessAudioBuffer(): void;
  resumeProcessAudioBuffer(): void;
  seekAudioBuffer(time: number): void;
  getCurrentTime(): number;
  duration: number;
}

export interface BufferSourceAudioTrackConfig {
  source: AudioBuffer | string | File;
}

export interface AgoraRTCType {
  createClient(config: { mode: string; codec: string }): IAgoraRTCClient;
  createMicrophoneAudioTrack(config?: { microphoneId?: string }): Promise<ILocalAudioTrack>;
  createBufferSourceAudioTrack(config: BufferSourceAudioTrackConfig): Promise<IBufferSourceAudioTrack>;
  getMicrophones(): Promise<MediaDeviceInfo[]>;
  getPlaybackDevices(): Promise<MediaDeviceInfo[]>;
  onMicrophoneChanged?: (callback: (changedDevice: MediaDeviceInfo) => void) => void;
  onPlaybackDeviceChanged?: (callback: (changedDevice: MediaDeviceInfo) => void) => void;
  setLogLevel(level: number): void;
}

// Declare global AgoraRTC from CDN
declare global {
  interface Window {
    AgoraRTC?: AgoraRTCType;
  }
}

export {};
