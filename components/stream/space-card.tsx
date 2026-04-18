"use client";

import { formatDistanceToNow, format } from "date-fns";
import {
  Mic,
  Users,
  Clock,
  Calendar,
  Radio,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AudioSpace } from "@/lib/stream/types";

interface SpaceCardProps {
  space: AudioSpace;
  onJoin: () => void;
  isHost?: boolean;
}

export function SpaceCard({ space, onJoin, isHost }: SpaceCardProps) {
  const isLive = space.status === "live";
  const isScheduled = space.status === "scheduled";

  return (
    <Card
      className={cn(
        "group cursor-pointer transition-all hover:shadow-lg hover:border-primary/40",
        isLive && "border-primary/30 bg-gradient-to-br from-primary/5 to-transparent"
      )}
      onClick={onJoin}
    >
      <CardContent className="p-4">
        {/* Status Badge */}
        <div className="flex items-center justify-between mb-3">
          {isLive ? (
            <Badge variant="destructive" className="gap-1.5 animate-pulse">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              LIVE
            </Badge>
          ) : isScheduled ? (
            <Badge variant="secondary" className="gap-1.5">
              <Calendar className="h-3 w-3" />
              Scheduled
            </Badge>
          ) : (
            <Badge variant="outline">Ended</Badge>
          )}
          {isHost && (
            <Badge variant="outline" className="text-primary border-primary/50">
              Host
            </Badge>
          )}
        </div>

        {/* Title & Description */}
        <h3 className="font-semibold text-base mb-1 line-clamp-2 group-hover:text-primary transition-colors">
          {space.title}
        </h3>
        {space.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {space.description}
          </p>
        )}

        {/* Topics */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {space.topics.slice(0, 3).map((topic) => (
            <Badge key={topic} variant="outline" className="text-xs">
              {topic}
            </Badge>
          ))}
        </div>

        {/* Host Info */}
        <div className="flex items-center gap-2 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={space.host_avatar} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {space.host_name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{space.host_name}</p>
            {space.mosque_name && (
              <p className="text-xs text-muted-foreground truncate">
                {space.mosque_name}
              </p>
            )}
          </div>
        </div>

        {/* Speakers Avatars */}
        {isLive && space.speaker_ids.length > 1 && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex -space-x-2">
              {space.speaker_ids.slice(0, 4).map((id, index) => (
                <Avatar
                  key={id}
                  className="h-6 w-6 border-2 border-background"
                >
                  <AvatarFallback className="bg-muted text-[10px]">
                    S{index + 1}
                  </AvatarFallback>
                </Avatar>
              ))}
              {space.speaker_ids.length > 4 && (
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium border-2 border-background">
                  +{space.speaker_ids.length - 4}
                </div>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {space.speaker_ids.length} speakers
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {isLive ? (
              <>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {space.participant_count}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formatDistanceToNow(new Date(space.started_at!), {
                    addSuffix: false,
                  })}
                </span>
              </>
            ) : isScheduled && space.scheduled_at ? (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(new Date(space.scheduled_at), "MMM d, h:mm a")}
              </span>
            ) : null}
          </div>
          <Button
            size="sm"
            variant={isLive ? "default" : "outline"}
            className="gap-1.5"
          >
            {isLive ? (
              <>
                <Mic className="h-4 w-4" />
                Join
              </>
            ) : isScheduled ? (
              <>
                <Calendar className="h-4 w-4" />
                Remind Me
              </>
            ) : (
              "View"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
