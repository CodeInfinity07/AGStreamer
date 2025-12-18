import { useState, useRef, useCallback } from "react";
import { Upload, Play, Square, Music, Server, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface UploadedFile {
  fileId: string;
  originalName: string;
  uploadedAt: string;
}

interface ServerAudioPlayerProps {
  isConnected: boolean;
  isPlaying: boolean;
  playbackProgress: number;
  playbackDuration: number;
  currentFile: string | null;
  uploadedFiles: UploadedFile[];
  isLoading: boolean;
  error: string | null;
  onUpload: (file: File) => Promise<string | null>;
  onPlay: (fileId: string) => Promise<boolean>;
  onStop: () => Promise<boolean>;
  onDelete: (fileId: string) => Promise<boolean>;
  onRefresh: () => void;
}

export function ServerAudioPlayer({
  isConnected,
  isPlaying,
  playbackProgress,
  playbackDuration,
  currentFile,
  uploadedFiles,
  isLoading,
  error,
  onUpload,
  onPlay,
  onStop,
  onDelete,
  onRefresh,
}: ServerAudioPlayerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("audio/")) {
      const fileId = await onUpload(file);
      if (fileId) {
        setSelectedFileId(fileId);
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [onUpload]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("audio/")) {
      const fileId = await onUpload(file);
      if (fileId) {
        setSelectedFileId(fileId);
      }
    }
  }, [onUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handlePlay = useCallback(async () => {
    if (selectedFileId) {
      await onPlay(selectedFileId);
    }
  }, [selectedFileId, onPlay]);

  const handleDelete = useCallback(async (fileId: string) => {
    await onDelete(fileId);
    if (selectedFileId === fileId) {
      setSelectedFileId(null);
    }
  }, [onDelete, selectedFileId]);

  const progress = playbackDuration > 0 ? (playbackProgress / playbackDuration) * 100 : 0;
  const selectedFile = uploadedFiles.find(f => f.fileId === selectedFileId);

  return (
    <Card data-testid="server-audio-player">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4" />
            Server Audio Bot
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isConnected ? "default" : "secondary"} className="text-xs">
              {isConnected ? "Bot Connected" : "Bot Disconnected"}
            </Badge>
            <Button
              size="icon"
              variant="ghost"
              onClick={onRefresh}
              disabled={isLoading}
              data-testid="button-refresh-files"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {!isConnected && (
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <p className="text-sm text-muted-foreground">
              The audio bot must join the channel to play audio.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Use the same channel credentials below to have the bot join.
            </p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          className="hidden"
          data-testid="input-server-audio-file"
        />

        <div
          className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          data-testid="dropzone-server-audio"
        >
          <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Uploading..." : "Drop an audio file or click to upload"}
          </p>
        </div>

        {uploadedFiles.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Uploaded Files</label>
            <ScrollArea className="h-32 rounded-md border">
              <div className="p-2 space-y-1">
                {uploadedFiles.map((file) => (
                  <div
                    key={file.fileId}
                    className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                      selectedFileId === file.fileId
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedFileId(file.fileId)}
                    data-testid={`file-item-${file.fileId}`}
                  >
                    <Music className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm flex-1 truncate">{file.originalName}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(file.fileId);
                      }}
                      disabled={isLoading || isPlaying}
                      data-testid={`button-delete-${file.fileId}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {selectedFile && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="p-2 rounded-md bg-primary/10">
                <Music className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" data-testid="text-selected-file">
                  {selectedFile.originalName}
                </p>
                {isPlaying && (
                  <p className="text-xs text-muted-foreground">
                    {formatTime(playbackProgress)} / {formatTime(playbackDuration)}
                  </p>
                )}
              </div>
            </div>

            {isPlaying && (
              <Progress value={progress} className="h-2" />
            )}

            <div className="flex items-center justify-center gap-2">
              {!isPlaying ? (
                <Button
                  onClick={handlePlay}
                  disabled={!isConnected || isLoading}
                  className="w-full"
                  data-testid="button-server-play"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Play via Server Bot
                </Button>
              ) : (
                <Button
                  onClick={onStop}
                  disabled={isLoading}
                  variant="destructive"
                  className="w-full"
                  data-testid="button-server-stop"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop Playback
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
