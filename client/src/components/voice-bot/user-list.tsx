import { Mic, MicOff, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RemoteUser } from "@shared/schema";

interface UserListProps {
  remoteUsers: Map<string | number, RemoteUser>;
  localUserId?: string | number;
  localIsMuted?: boolean;
  localAudioLevel?: number;
}

function SpeakingIndicator({ isSpeaking, audioLevel }: { isSpeaking: boolean; audioLevel: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3].map((bar) => (
        <div
          key={bar}
          className={cn(
            "w-1 rounded-full transition-all duration-150",
            isSpeaking && audioLevel > bar * 0.15
              ? "bg-green-500 animate-pulse"
              : "bg-muted"
          )}
          style={{ 
            height: isSpeaking ? `${Math.min(8 + audioLevel * 12, 16)}px` : "4px",
            opacity: isSpeaking ? 0.8 + audioLevel * 0.2 : 0.3,
          }}
        />
      ))}
    </div>
  );
}

function UserItem({ 
  uid, 
  hasAudio, 
  isSpeaking, 
  audioLevel, 
  isLocal 
}: { 
  uid: string | number; 
  hasAudio: boolean; 
  isSpeaking: boolean; 
  audioLevel: number;
  isLocal?: boolean;
}) {
  return (
    <div 
      className={cn(
        "flex items-center justify-between p-3 rounded-lg bg-background transition-colors",
        isSpeaking && "ring-2 ring-green-500/30"
      )}
      data-testid={`user-item-${uid}`}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "relative flex items-center justify-center w-8 h-8 rounded-full",
          isLocal ? "bg-primary/10" : "bg-muted"
        )}>
          <User className={cn(
            "w-4 h-4",
            isLocal ? "text-primary" : "text-muted-foreground"
          )} />
          <span 
            className={cn(
              "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background",
              hasAudio ? "bg-green-500" : "bg-gray-400"
            )}
          />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">
            {isLocal ? "You" : `User ${uid}`}
          </span>
          <span className="text-xs text-muted-foreground">
            {isLocal ? "Local" : "Remote"}
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <SpeakingIndicator isSpeaking={isSpeaking} audioLevel={audioLevel} />
        {hasAudio ? (
          <Mic className={cn(
            "w-4 h-4 transition-colors",
            isSpeaking ? "text-green-500" : "text-muted-foreground"
          )} />
        ) : (
          <MicOff className="w-4 h-4 text-red-500" />
        )}
      </div>
    </div>
  );
}

export function UserList({ remoteUsers, localUserId, localIsMuted = false, localAudioLevel = 0 }: UserListProps) {
  const userCount = remoteUsers.size + (localUserId ? 1 : 0);

  return (
    <div 
      className="bg-card rounded-xl p-4 border border-card-border"
      data-testid="user-list"
    >
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <User className="w-4 h-4" />
        Users in Channel
        <span className="text-muted-foreground font-normal">({userCount})</span>
      </h3>
      
      <div className="space-y-2">
        {localUserId && (
          <UserItem
            uid={localUserId}
            hasAudio={!localIsMuted}
            isSpeaking={!localIsMuted && localAudioLevel > 0.01}
            audioLevel={localAudioLevel}
            isLocal
          />
        )}
        
        {remoteUsers.size === 0 && !localUserId && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No users in channel yet
          </p>
        )}
        
        {Array.from(remoteUsers.entries()).map(([uid, user]) => (
          <UserItem
            key={uid}
            uid={user.uid}
            hasAudio={user.hasAudio}
            isSpeaking={user.isSpeaking}
            audioLevel={user.audioLevel}
          />
        ))}
      </div>
    </div>
  );
}
