"use client";

import { useRealtimeStatus, getRealtimeService } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import { Wifi, WifiOff, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ConnectionStatusProps {
  showLabel?: boolean;
  className?: string;
}

export function ConnectionStatus({ showLabel = false, className }: ConnectionStatusProps) {
  const status = useRealtimeStatus();

  const handleReconnect = () => {
    const service = getRealtimeService();
    service.reconnectAll();
  };

  const statusConfig = {
    connected: {
      icon: Wifi,
      label: "Connected",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      dotColor: "bg-green-500",
    },
    connecting: {
      icon: Loader2,
      label: "Connecting...",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      dotColor: "bg-yellow-500",
      animate: true,
    },
    reconnecting: {
      icon: RefreshCw,
      label: "Reconnecting...",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      dotColor: "bg-yellow-500",
      animate: true,
    },
    disconnected: {
      icon: WifiOff,
      label: "Disconnected",
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      dotColor: "bg-destructive",
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex items-center gap-2 rounded-full px-2 py-1",
              config.bgColor,
              className
            )}
          >
            <div className="relative flex h-2 w-2">
              <span
                className={cn(
                  "absolute inline-flex h-full w-full rounded-full",
                  config.dotColor,
                  status === "connected" && "animate-ping opacity-75"
                )}
              />
              <span
                className={cn(
                  "relative inline-flex h-2 w-2 rounded-full",
                  config.dotColor
                )}
              />
            </div>
            {showLabel && (
              <span className={cn("text-xs font-medium", config.color)}>
                {config.label}
              </span>
            )}
            <Icon
              className={cn(
                "h-3.5 w-3.5",
                config.color,
                config.animate && "animate-spin"
              )}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="flex flex-col gap-2">
            <p className="text-sm">
              {status === "connected" && "Real-time updates are active"}
              {status === "connecting" && "Establishing connection..."}
              {status === "reconnecting" && "Attempting to reconnect..."}
              {status === "disconnected" && "Real-time updates are offline"}
            </p>
            {status === "disconnected" && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleReconnect}
                className="w-full"
              >
                <RefreshCw className="mr-2 h-3 w-3" />
                Reconnect
              </Button>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Minimal dot-only indicator for tight spaces
 */
export function ConnectionStatusDot({ className }: { className?: string }) {
  const status = useRealtimeStatus();

  const colors = {
    connected: "bg-green-500",
    connecting: "bg-yellow-500 animate-pulse",
    reconnecting: "bg-yellow-500 animate-pulse",
    disconnected: "bg-destructive",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex h-2 w-2 rounded-full",
              colors[status],
              className
            )}
          />
        </TooltipTrigger>
        <TooltipContent>
          {status === "connected" && "Connected"}
          {status === "connecting" && "Connecting..."}
          {status === "reconnecting" && "Reconnecting..."}
          {status === "disconnected" && "Disconnected"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
