import { useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Trash2, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LogEntry } from "@shared/schema";

interface LogsConsoleProps {
  logs: LogEntry[];
  onClear?: () => void;
}

const typeColors = {
  info: "text-green-400",
  warning: "text-amber-400",
  error: "text-red-400",
  success: "text-blue-400",
};

export function LogsConsole({ logs, onClear }: LogsConsoleProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div 
      className="rounded-lg overflow-hidden border border-card-border"
      data-testid="logs-console"
    >
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 dark:bg-zinc-950 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-zinc-400 text-sm">
          <Terminal className="w-4 h-4" />
          <span className="font-medium">Console</span>
          <span className="text-zinc-600">({logs.length} entries)</span>
        </div>
        {onClear && logs.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-7 px-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            data-testid="button-clear-logs"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Clear
          </Button>
        )}
      </div>
      
      <ScrollArea 
        className="h-[200px] bg-zinc-950"
        ref={scrollRef as any}
      >
        <div className="p-4 font-mono text-[13px] leading-relaxed" ref={scrollRef}>
          {logs.length === 0 ? (
            <p className="text-zinc-600 text-center py-4">
              No logs yet. Events will appear here when you connect.
            </p>
          ) : (
            logs.map((log) => (
              <div 
                key={log.id} 
                className="mb-1 flex"
                data-testid={`log-entry-${log.id}`}
              >
                <span className="text-zinc-600 mr-2 shrink-0">
                  {log.timestamp.toLocaleTimeString()}
                </span>
                <span className={cn(typeColors[log.type])}>
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
