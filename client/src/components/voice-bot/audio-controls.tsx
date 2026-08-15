import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AudioControlsProps {
  onLeave: () => void;
  disabled?: boolean;
}

export function AudioControls({
  onLeave,
  disabled,
}: AudioControlsProps) {
  return (
    <div className="space-y-4" data-testid="audio-controls">
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
