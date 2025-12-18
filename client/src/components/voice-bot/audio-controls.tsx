import { Mic, MicOff, Volume2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface AudioControlsProps {
  isMuted: boolean;
  volume: number;
  onMuteToggle: () => void;
  onVolumeChange: (volume: number) => void;
  onLeave: () => void;
  disabled?: boolean;
}

export function AudioControls({
  isMuted,
  volume,
  onMuteToggle,
  onVolumeChange,
  onLeave,
  disabled,
}: AudioControlsProps) {
  return (
    <div className="space-y-4" data-testid="audio-controls">
      <Button
        onClick={onMuteToggle}
        disabled={disabled}
        className={cn(
          "w-full h-12 text-base font-semibold",
          isMuted 
            ? "bg-red-500 hover:bg-red-600 text-white" 
            : "bg-amber-500 hover:bg-amber-600 text-white"
        )}
        data-testid="button-mute"
      >
        {isMuted ? (
          <>
            <MicOff className="w-5 h-5 mr-2" />
            Unmute Microphone
          </>
        ) : (
          <>
            <Mic className="w-5 h-5 mr-2" />
            Mute Microphone
          </>
        )}
      </Button>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium flex items-center gap-2">
            <Volume2 className="w-4 h-4" />
            Microphone Volume
          </label>
          <span 
            className="text-sm font-mono text-muted-foreground"
            data-testid="text-volume-value"
          >
            {volume}%
          </span>
        </div>
        <Slider
          value={[volume]}
          onValueChange={(values) => onVolumeChange(values[0])}
          min={0}
          max={200}
          step={1}
          disabled={disabled}
          className="w-full"
          data-testid="slider-volume"
        />
        <p className="text-xs text-muted-foreground">
          Values above 100% will boost your microphone volume
        </p>
      </div>

      <Button
        onClick={onLeave}
        disabled={disabled}
        variant="destructive"
        className="w-full h-12 text-base font-semibold"
        data-testid="button-leave"
      >
        <LogOut className="w-5 h-5 mr-2" />
        Leave Channel
      </Button>
    </div>
  );
}
