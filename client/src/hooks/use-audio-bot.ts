import { useState, useCallback, useRef, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

interface BotStatus {
  isRunning: boolean;
  sdkAvailable: boolean;
  agoraAvailable: boolean;
  pydubAvailable: boolean;
  lastError: string | null;
  isConnected: boolean;
  isPlaying: boolean;
  channel: string | null;
  uid: number | null;
  currentFile: string | null;
  playbackProgress: number;
  playbackDuration: number;
}

interface UploadedFile {
  fileId: string;
  originalName: string;
  uploadedAt: string;
}

interface BotLog {
  timestamp: number;
  level: string;
  message: string;
}

export function useAudioBot() {
  const [status, setStatus] = useState<BotStatus>({
    isRunning: false,
    sdkAvailable: false,
    agoraAvailable: false,
    pydubAvailable: false,
    lastError: null,
    isConnected: false,
    isPlaying: false,
    channel: null,
    uid: null,
    currentFile: null,
    playbackProgress: 0,
    playbackDuration: 0,
  });
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const statusPollingRef = useRef<number | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/bot/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error("Failed to fetch bot status:", err);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/bot/logs?limit=50");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to fetch bot logs:", err);
    }
  }, []);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/audio/files");
      if (res.ok) {
        const data = await res.json();
        setUploadedFiles(data.files || []);
      }
    } catch (err) {
      console.error("Failed to fetch uploaded files:", err);
    }
  }, []);

  const startPolling = useCallback(() => {
    if (statusPollingRef.current) return;
    
    statusPollingRef.current = window.setInterval(() => {
      fetchStatus();
      fetchLogs();
    }, 1000);
  }, [fetchStatus, fetchLogs]);

  const stopPolling = useCallback(() => {
    if (statusPollingRef.current) {
      clearInterval(statusPollingRef.current);
      statusPollingRef.current = null;
    }
  }, []);

  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const buffer = await file.arrayBuffer();
      const res = await fetch("/api/audio/upload", {
        method: "POST",
        headers: {
          "Content-Type": file.type || "audio/mpeg",
          "X-Filename": file.name,
        },
        body: buffer,
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }
      
      const data = await res.json();
      await fetchFiles();
      return data.fileId;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchFiles]);

  const deleteFile = useCallback(async (fileId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const res = await apiRequest("DELETE", `/api/audio/files/${fileId}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed");
      }
      await fetchFiles();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchFiles]);

  const joinChannel = useCallback(async (
    appId: string,
    channel: string,
    uid: number,
    token?: string
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const res = await apiRequest("POST", "/api/bot/join", {
        appId,
        channel,
        uid,
        token: token || "",
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to join channel");
      }
      
      await fetchStatus();
      startPolling();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to join channel";
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchStatus, startPolling]);

  const leaveChannel = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const res = await apiRequest("POST", "/api/bot/leave");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to leave channel");
      }
      
      stopPolling();
      await fetchStatus();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to leave channel";
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchStatus, stopPolling]);

  const playAudio = useCallback(async (fileId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const res = await apiRequest("POST", "/api/bot/play", { file: fileId });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to play audio");
      }
      
      await fetchStatus();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to play audio";
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchStatus]);

  const stopPlayback = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const res = await apiRequest("POST", "/api/bot/stop");
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to stop playback");
      }
      
      await fetchStatus();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to stop playback";
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchStatus]);

  const shutdown = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const res = await apiRequest("POST", "/api/bot/shutdown");
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to shutdown bot");
      }
      
      stopPolling();
      await fetchStatus();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to shutdown bot";
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchStatus, stopPolling]);

  useEffect(() => {
    fetchStatus();
    fetchFiles();
    
    return () => {
      stopPolling();
    };
  }, [fetchStatus, fetchFiles, stopPolling]);

  useEffect(() => {
    if (status.isConnected && !statusPollingRef.current) {
      startPolling();
    } else if (!status.isConnected && statusPollingRef.current) {
      stopPolling();
    }
  }, [status.isConnected, startPolling, stopPolling]);

  return {
    status,
    uploadedFiles,
    logs,
    isLoading,
    error,
    
    uploadFile,
    deleteFile,
    joinChannel,
    leaveChannel,
    playAudio,
    stopPlayback,
    shutdown,
    
    refreshStatus: fetchStatus,
    refreshFiles: fetchFiles,
    refreshLogs: fetchLogs,
  };
}
