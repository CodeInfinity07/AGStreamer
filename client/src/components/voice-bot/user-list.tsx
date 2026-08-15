import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mic, MicOff, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { lookupPlayers, getAvatarUrl, type PlayerInfo } from "@/lib/playerApi";
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

function UserAvatar({ avatarUrl, isLocal }: { avatarUrl: string; isLocal?: boolean }) {
  const [imgError, setImgError] = useState(false);

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="w-full h-full object-cover"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <User className={cn(
      "w-4 h-4",
      isLocal ? "text-primary" : "text-muted-foreground"
    )} />
  );
}

function UserItem({
  uid,
  hasAudio,
  isSpeaking,
  audioLevel,
  isLocal,
  player,
}: {
  uid: string | number;
  hasAudio: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  isLocal?: boolean;
  player?: PlayerInfo;
}) {
  const displayName = isLocal ? "You" : player?.name || `User ${uid}`;
  const avatarUrl = getAvatarUrl(player?.snuid);

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
          "relative flex items-center justify-center w-8 h-8 rounded-full overflow-hidden",
          isLocal ? "bg-primary/10" : "bg-muted"
        )}>
          <UserAvatar avatarUrl={avatarUrl} isLocal={isLocal} />
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background",
              hasAudio ? "bg-green-500" : "bg-gray-400"
            )}
          />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">
            {displayName}
          </span>
          <span className="text-xs text-muted-foreground">
            {isLocal ? "Local" : uid}
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

  const uids = useMemo(() => {
    const ids: Array<string | number> = [];
    if (localUserId) ids.push(localUserId);
    remoteUsers.forEach((_, uid) => ids.push(uid));
    return ids;
  }, [localUserId, remoteUsers]);

  const { data: players } = useQuery({
    queryKey: ["players-batch", uids.map(String).sort().join(",")],
    queryFn: () => lookupPlayers(uids),
    enabled: uids.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const playerMap = useMemo(() => {
    const map = new Map<string, PlayerInfo>();
    (players || []).forEach((p) => {
      if (p.gc) map.set(String(p.gc), p);
    });
    return map;
  }, [players]);

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
            player={playerMap.get(String(localUserId))}
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
            player={playerMap.get(String(user.uid))}
          />
        ))}
      </div>
    </div>
  );
}
