import { useState, useRef, useCallback } from "react";
import { Upload, Play, Pause, Square, Music, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface AudioFilePlayerProps {
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  fileName: string | null;
  volume: number;
  disabled?: boolean;
  onFileSelect: (file: File) => void;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
}

export function AudioFilePlayer({
  isPlaying,
  isPaused,
  currentTime,
  duration,
  fileName,
  volume,
  disabled,
  onFileSelect,
  onPlay,
  onPause,
  onResume,
  onStop,
  onSeek,
  onVolumeChange,
}: AudioFilePlayerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("audio/")) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("audio/")) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <Card data-testid="audio-file-player">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Music className="w-4 h-4" />
          Audio File Player
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          className="hidden"
          data-testid="input-audio-file"
        />

        {!fileName ? (
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            data-testid="dropzone-audio"
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drop an MP3 file here or click to browse
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Supported formats: MP3, WAV, OGG, M4A
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="p-2 rounded-md bg-primary/10">
                <Music className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p 
                  className="text-sm font-medium truncate"
                  data-testid="text-file-name"
                >
                  {fileName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isPlaying}
                data-testid="button-change-file"
              >
                Change
              </Button>
            </div>

            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <Slider
                value={[currentTime]}
                onValueChange={(values) => onSeek(values[0])}
                min={0}
                max={duration || 100}
                step={0.1}
                disabled={disabled || !duration}
                className="w-full"
                data-testid="slider-seek"
              />
            </div>

            <div className="flex items-center justify-center gap-2">
              {!isPlaying ? (
                <Button
                  onClick={onPlay}
                  disabled={disabled}
                  className="w-full"
                  data-testid="button-play"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Play Audio
                </Button>
              ) : isPaused ? (
                <>
                  <Button
                    onClick={onResume}
                    disabled={disabled}
                    className="flex-1"
                    data-testid="button-resume"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Resume
                  </Button>
                  <Button
                    onClick={onStop}
                    disabled={disabled}
                    variant="destructive"
                    className="flex-1"
                    data-testid="button-stop"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Stop
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={onPause}
                    disabled={disabled}
                    variant="secondary"
                    className="flex-1"
                    data-testid="button-pause"
                  >
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </Button>
                  <Button
                    onClick={onStop}
                    disabled={disabled}
                    variant="destructive"
                    className="flex-1"
                    data-testid="button-stop"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Stop
                  </Button>
                </>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Volume2 className="w-4 h-4" />
                  Playback Volume
                </label>
                <span 
                  className="text-sm font-mono text-muted-foreground"
                  data-testid="text-playback-volume"
                >
                  {volume}%
                </span>
              </div>
              <Slider
                value={[volume]}
                onValueChange={(values) => onVolumeChange(values[0])}
                min={0}
                max={100}
                step={1}
                disabled={disabled}
                className="w-full"
                data-testid="slider-playback-volume"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
