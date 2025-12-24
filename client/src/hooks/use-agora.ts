import { useState, useCallback, useRef, useEffect } from "react";
import type { 
  IAgoraRTCClient, 
  ILocalAudioTrack,
  IBufferSourceAudioTrack,
  IAgoraRTCRemoteUser 
} from "@/lib/agora-types";
import { 
  ConnectionStatus, 
  type ConnectionStatusType,
  type RemoteUser,
  type LogEntry,
  type NetworkQualityType,
  NetworkQuality
} from "@shared/schema";

interface UseAgoraOptions {
  onUserJoined?: (user: RemoteUser) => void;
  onUserLeft?: (uid: string | number) => void;
  onVolumeIndicator?: (volumes: { uid: string | number; level: number }[]) => void;
}

export function useAgora(options: UseAgoraOptions = {}) {
  const [status, setStatus] = useState<ConnectionStatusType>(ConnectionStatus.DISCONNECTED);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(100);
  const [remoteUsers, setRemoteUsers] = useState<Map<string | number, RemoteUser>>(new Map());
  const [networkQuality, setNetworkQuality] = useState<NetworkQualityType>(NetworkQuality.UNKNOWN);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrackRef = useRef<ILocalAudioTrack | null>(null);
  const volumeIntervalRef = useRef<number | null>(null);

  const addLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      message,
      type,
    };
    setLogs((prev) => [...prev.slice(-99), entry]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Check if SDK is loaded with polling
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds with 100ms intervals
    
    const checkSDK = () => {
      if (window.AgoraRTC) {
        setSdkLoaded(true);
        setSdkError(null);
        addLog("Agora SDK loaded successfully", "success");
        // Set log level to error only to reduce console noise
        window.AgoraRTC.setLogLevel(4);
        return true;
      }
      return false;
    };

    // Check immediately
    if (checkSDK()) return;

    // Poll for SDK availability
    const interval = window.setInterval(() => {
      attempts++;
      if (checkSDK()) {
        clearInterval(interval);
        return;
      }
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setSdkError("Failed to load Agora SDK. Please check your internet connection and refresh the page.");
        addLog("Failed to load Agora SDK", "error");
      }
    }, 100);

    return () => clearInterval(interval);
  }, [addLog]);

  const join = useCallback(async (
    appId: string,
    channelId: string,
    token: string | null,
    uid?: string | number
  ) => {
    if (!window.AgoraRTC) {
      throw new Error("Agora SDK not loaded");
    }

    try {
      setStatus(ConnectionStatus.CONNECTING);
      addLog(`Joining channel: ${channelId}`, "info");

      // Create client if not exists
      if (!clientRef.current) {
        clientRef.current = window.AgoraRTC.createClient({ 
          mode: "rtc", 
          codec: "vp8" 
        });

        // Set up event listeners
        clientRef.current.on("user-published", async (user: IAgoraRTCRemoteUser, mediaType: string) => {
          if (mediaType === "audio" && clientRef.current) {
            await clientRef.current.subscribe(user, "audio");
            user.audioTrack?.play();
            
            const remoteUser: RemoteUser = {
              uid: user.uid,
              hasAudio: user.hasAudio,
              isSpeaking: false,
              audioLevel: 0,
            };
            
            setRemoteUsers((prev) => new Map(prev).set(user.uid, remoteUser));
            options.onUserJoined?.(remoteUser);
            addLog(`User ${user.uid} joined and published audio`, "info");
          }
        });

        clientRef.current.on("user-unpublished", (user: IAgoraRTCRemoteUser, mediaType: string) => {
          if (mediaType === "audio") {
            user.audioTrack?.stop();
            setRemoteUsers((prev) => {
              const updated = new Map(prev);
              const existing = updated.get(user.uid);
              if (existing) {
                updated.set(user.uid, { ...existing, hasAudio: false });
              }
              return updated;
            });
            addLog(`User ${user.uid} stopped publishing audio`, "info");
          }
        });

        clientRef.current.on("user-left", (user: IAgoraRTCRemoteUser) => {
          setRemoteUsers((prev) => {
            const updated = new Map(prev);
            updated.delete(user.uid);
            return updated;
          });
          options.onUserLeft?.(user.uid);
          addLog(`User ${user.uid} left the channel`, "info");
        });

        clientRef.current.on("user-joined", (user: IAgoraRTCRemoteUser) => {
          addLog(`User ${user.uid} joined the channel`, "info");
        });

        clientRef.current.on("connection-state-change", (curState: string, prevState: string, reason?: string) => {
          addLog(`Connection state: ${prevState} → ${curState}${reason ? ` (reason: ${reason})` : ''}`, "info");
          
          switch (curState) {
            case "CONNECTED":
              setStatus(ConnectionStatus.CONNECTED);
              break;
            case "CONNECTING":
              setStatus(ConnectionStatus.CONNECTING);
              break;
            case "RECONNECTING":
              setStatus(ConnectionStatus.RECONNECTING);
              break;
            case "DISCONNECTED":
              setStatus(ConnectionStatus.DISCONNECTED);
              // If we disconnected due to an error, log it
              if (reason && reason !== "LEAVE") {
                addLog(`Disconnected: ${reason}`, "error");
              }
              break;
          }
        });

        // Handle token expiration
        clientRef.current.on("token-privilege-will-expire", () => {
          addLog("Token will expire soon", "warning");
        });

        clientRef.current.on("token-privilege-did-expire", () => {
          addLog("Token expired - please reconnect with a new token", "error");
          setStatus(ConnectionStatus.ERROR);
        });

        clientRef.current.on("network-quality", (stats: { uplinkNetworkQuality: number; downlinkNetworkQuality: number }) => {
          const quality = Math.max(stats.uplinkNetworkQuality, stats.downlinkNetworkQuality) as NetworkQualityType;
          setNetworkQuality(quality);
        });

        clientRef.current.on("exception", (event: { code: number; msg: string }) => {
          addLog(`Exception: ${event.msg} (${event.code})`, "error");
        });
      }

      // Join the channel
      const assignedUid = await clientRef.current.join(appId, channelId, token, uid);
      addLog(`Joined as user: ${assignedUid}`, "success");

      // Create and publish local audio track (muted by default)
      localAudioTrackRef.current = await window.AgoraRTC.createMicrophoneAudioTrack();
      localAudioTrackRef.current.setEnabled(false); // Start muted
      await clientRef.current.publish(localAudioTrackRef.current);
      addLog("Published local audio track (muted)", "success");

      // Start volume level monitoring
      volumeIntervalRef.current = window.setInterval(() => {
        if (localAudioTrackRef.current && clientRef.current) {
          const localLevel = localAudioTrackRef.current.getVolumeLevel();
          
          // Update remote users speaking status
          setRemoteUsers((prev) => {
            const updated = new Map(prev);
            clientRef.current?.remoteUsers.forEach((user) => {
              if (user.audioTrack) {
                const level = user.audioTrack.getVolumeLevel();
                const existing = updated.get(user.uid);
                if (existing) {
                  updated.set(user.uid, {
                    ...existing,
                    audioLevel: level,
                    isSpeaking: level > 0.01,
                  });
                }
              }
            });
            return updated;
          });

          // Notify parent about volume levels
          const volumes = [
            { uid: assignedUid, level: localLevel },
            ...Array.from(remoteUsers.entries()).map(([uid, user]) => ({
              uid,
              level: user.audioLevel,
            })),
          ];
          options.onVolumeIndicator?.(volumes);
        }
      }, 200);

      // Don't manually set CONNECTED - let the connection-state-change event handle it
      // This ensures we only show connected when the SDK confirms the connection
      return assignedUid;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to join channel";
      addLog(message, "error");
      setStatus(ConnectionStatus.ERROR);
      throw error;
    }
  }, [addLog, options, remoteUsers]);

  const leave = useCallback(async () => {
    try {
      addLog("Leaving channel...", "info");

      // Clear volume monitoring
      if (volumeIntervalRef.current) {
        clearInterval(volumeIntervalRef.current);
        volumeIntervalRef.current = null;
      }

      // Clear audio time tracking
      if (audioTimeIntervalRef.current) {
        clearInterval(audioTimeIntervalRef.current);
        audioTimeIntervalRef.current = null;
      }

      // Stop, unpublish and close audio file track
      if (audioFileTrackRef.current) {
        audioFileTrackRef.current.stopProcessAudioBuffer();
        if (clientRef.current && audioTrackPublishedRef.current) {
          try {
            await clientRef.current.unpublish(audioFileTrackRef.current);
          } catch {
            // Track may not be published, ignore error
          }
        }
        audioTrackPublishedRef.current = false;
        audioFileTrackRef.current.close();
        audioFileTrackRef.current = null;
      }

      // Stop and close local track
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop();
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
      }

      // Leave channel
      if (clientRef.current) {
        await clientRef.current.leave();
        clientRef.current.removeAllListeners();
        clientRef.current = null;
      }

      setRemoteUsers(new Map());
      setStatus(ConnectionStatus.DISCONNECTED);
      setIsMuted(false);
      setNetworkQuality(NetworkQuality.UNKNOWN);
      
      // Reset audio file state
      setAudioFileName(null);
      setIsAudioPlaying(false);
      setIsAudioPaused(false);
      setAudioCurrentTime(0);
      setAudioDuration(0);
      audioFileRef.current = null;
      
      addLog("Left channel successfully", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to leave channel";
      addLog(message, "error");
    }
  }, [addLog]);

  const toggleMute = useCallback(async () => {
    if (localAudioTrackRef.current) {
      const newMuted = !isMuted;
      await localAudioTrackRef.current.setEnabled(!newMuted);
      setIsMuted(newMuted);
      addLog(newMuted ? "Microphone muted" : "Microphone unmuted", "info");
    }
  }, [isMuted, addLog]);

  const setMicrophoneVolume = useCallback((newVolume: number) => {
    if (localAudioTrackRef.current) {
      // Agora volume is 0-100, we support 0-200 for boost
      localAudioTrackRef.current.setVolume(newVolume);
      setVolume(newVolume);
    }
  }, []);

  const changeMicrophone = useCallback(async (deviceId: string) => {
    if (localAudioTrackRef.current) {
      try {
        await localAudioTrackRef.current.setDevice(deviceId);
        addLog("Microphone changed successfully", "success");
      } catch (error) {
        addLog("Failed to change microphone", "error");
      }
    }
  }, [addLog]);

  const loadAudioFile = useCallback(async (file: File) => {
    if (!window.AgoraRTC) {
      addLog("Agora SDK not loaded", "error");
      return;
    }

    try {
      if (audioFileTrackRef.current) {
        audioFileTrackRef.current.stopProcessAudioBuffer();
        audioFileTrackRef.current.close();
        audioFileTrackRef.current = null;
        audioTrackPublishedRef.current = false;
      }

      addLog(`Loading audio file: ${file.name}`, "info");
      const track = await window.AgoraRTC.createBufferSourceAudioTrack({
        source: file,
      });
      
      audioFileTrackRef.current = track;
      audioFileRef.current = file;
      setAudioFileName(file.name);
      setAudioDuration(track.duration);
      setAudioCurrentTime(0);
      setIsAudioPlaying(false);
      setIsAudioPaused(false);
      
      track.setVolume(audioVolume);
      addLog(`Audio file loaded: ${file.name} (${Math.round(track.duration)}s)`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load audio file";
      addLog(message, "error");
    }
  }, [addLog, audioVolume]);

  const startAudioTimeTracking = useCallback(() => {
    if (audioTimeIntervalRef.current) {
      clearInterval(audioTimeIntervalRef.current);
    }
    
    audioTimeIntervalRef.current = window.setInterval(async () => {
      if (audioFileTrackRef.current) {
        const currentTime = audioFileTrackRef.current.getCurrentTime();
        setAudioCurrentTime(currentTime);
        
        if (currentTime >= audioDuration && audioDuration > 0) {
          if (audioTimeIntervalRef.current) {
            clearInterval(audioTimeIntervalRef.current);
            audioTimeIntervalRef.current = null;
          }
          
          audioFileTrackRef.current.stopProcessAudioBuffer();
          
          if (clientRef.current && audioTrackPublishedRef.current) {
            try {
              await clientRef.current.unpublish(audioFileTrackRef.current);
              audioTrackPublishedRef.current = false;
            } catch {
            }
          }
          
          setIsAudioPlaying(false);
          setIsAudioPaused(false);
          setAudioCurrentTime(0);
        }
      }
    }, 100);
  }, [audioDuration]);

  const playAudio = useCallback(async () => {
    if (!audioFileTrackRef.current || !clientRef.current) {
      addLog("No audio file loaded or not connected", "error");
      return;
    }

    try {
      addLog("Starting audio playback...", "info");
      
      if (!audioTrackPublishedRef.current) {
        await clientRef.current.publish(audioFileTrackRef.current);
        audioTrackPublishedRef.current = true;
      }
      
      audioFileTrackRef.current.startProcessAudioBuffer({ loop: false });
      audioFileTrackRef.current.play();
      
      setIsAudioPlaying(true);
      setIsAudioPaused(false);
      startAudioTimeTracking();
      
      addLog("Audio playback started", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to play audio";
      addLog(message, "error");
    }
  }, [addLog, startAudioTimeTracking]);

  const pauseAudio = useCallback(() => {
    if (audioFileTrackRef.current && isAudioPlaying && !isAudioPaused) {
      audioFileTrackRef.current.pauseProcessAudioBuffer();
      setIsAudioPaused(true);
      addLog("Audio paused", "info");
    }
  }, [isAudioPlaying, isAudioPaused, addLog]);

  const resumeAudio = useCallback(() => {
    if (audioFileTrackRef.current && isAudioPlaying && isAudioPaused) {
      audioFileTrackRef.current.resumeProcessAudioBuffer();
      setIsAudioPaused(false);
      addLog("Audio resumed", "info");
    }
  }, [isAudioPlaying, isAudioPaused, addLog]);

  const stopAudio = useCallback(async () => {
    if (audioFileTrackRef.current) {
      try {
        audioFileTrackRef.current.stopProcessAudioBuffer();
        
        if (clientRef.current && audioTrackPublishedRef.current) {
          await clientRef.current.unpublish(audioFileTrackRef.current);
          audioTrackPublishedRef.current = false;
        }
        
        if (audioTimeIntervalRef.current) {
          clearInterval(audioTimeIntervalRef.current);
          audioTimeIntervalRef.current = null;
        }
        
        setIsAudioPlaying(false);
        setIsAudioPaused(false);
        setAudioCurrentTime(0);
        addLog("Audio stopped", "info");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to stop audio";
        addLog(message, "error");
      }
    }
  }, [addLog]);

  const seekAudio = useCallback((time: number) => {
    if (audioFileTrackRef.current) {
      audioFileTrackRef.current.seekAudioBuffer(time);
      setAudioCurrentTime(time);
    }
  }, []);

  const setAudioFileVolume = useCallback((newVolume: number) => {
    if (audioFileTrackRef.current) {
      audioFileTrackRef.current.setVolume(newVolume);
    }
    setAudioVolume(newVolume);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (volumeIntervalRef.current) {
        clearInterval(volumeIntervalRef.current);
      }
      if (audioTimeIntervalRef.current) {
        clearInterval(audioTimeIntervalRef.current);
      }
      if (audioFileTrackRef.current) {
        audioFileTrackRef.current.stopProcessAudioBuffer();
        audioFileTrackRef.current.close();
      }
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop();
        localAudioTrackRef.current.close();
      }
      if (clientRef.current) {
        clientRef.current.leave().catch(() => {});
        clientRef.current.removeAllListeners();
      }
    };
  }, []);

  return {
    // State
    status,
    isMuted,
    volume,
    remoteUsers,
    networkQuality,
    logs,
    sdkLoaded,
    sdkError,
    
    // Audio file state
    audioFileName,
    isAudioPlaying,
    isAudioPaused,
    audioCurrentTime,
    audioDuration,
    audioVolume,
    
    // Actions
    join,
    leave,
    toggleMute,
    setMicrophoneVolume,
    changeMicrophone,
    addLog,
    clearLogs,
    
    // Audio file actions
    loadAudioFile,
    playAudio,
    pauseAudio,
    resumeAudio,
    stopAudio,
    seekAudio,
    setAudioFileVolume,
  };
}
