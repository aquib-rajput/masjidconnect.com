"use client"

import { useRealtime } from "@/lib/realtime/realtime-context"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Phone, Video, PhoneCall } from "lucide-react"
import { cn } from "@/lib/utils"

interface CallButtonProps {
  /** The user ID to call */
  userId: string
  /** User display info for the call UI */
  userInfo: {
    display_name?: string | null
    avatar_url?: string | null
  }
  /** Show as icon only or with text */
  variant?: "icon" | "default"
  /** Size of the button */
  size?: "sm" | "default" | "lg"
  /** Additional class names */
  className?: string
  /** Whether to show both audio and video options */
  showOptions?: boolean
}

export function CallButton({ 
  userId, 
  userInfo, 
  variant = "icon",
  size = "default",
  className,
  showOptions = true
}: CallButtonProps) {
  const { startCall, callState, onlineUsers } = useRealtime()
  
  const isUserOnline = onlineUsers.has(userId)
  const isInCall = callState !== 'idle'
  
  const handleAudioCall = () => {
    startCall({
      recipientIds: [userId],
      type: 'audio',
      participants: [{
        id: userId,
        display_name: userInfo.display_name || null,
        avatar_url: userInfo.avatar_url || null
      }]
    })
  }
  
  const handleVideoCall = () => {
    startCall({
      recipientIds: [userId],
      type: 'video',
      participants: [{
        id: userId,
        display_name: userInfo.display_name || null,
        avatar_url: userInfo.avatar_url || null
      }]
    })
  }
  
  if (!showOptions) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size={size === "sm" ? "icon" : size}
              className={cn(
                variant === "icon" && "h-8 w-8",
                !isUserOnline && "opacity-50",
                className
              )}
              disabled={!isUserOnline || isInCall}
              onClick={handleAudioCall}
            >
              <Phone className={cn(
                size === "sm" ? "h-4 w-4" : "h-5 w-5"
              )} />
              {variant === "default" && <span className="ml-2">Call</span>}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {!isUserOnline ? "User is offline" : 
             isInCall ? "Already in a call" : "Start voice call"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }
  
  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size={size === "sm" ? "icon" : size}
                className={cn(
                  variant === "icon" && "h-8 w-8",
                  !isUserOnline && "opacity-50 cursor-not-allowed",
                  className
                )}
                disabled={!isUserOnline || isInCall}
              >
                <PhoneCall className={cn(
                  size === "sm" ? "h-4 w-4" : "h-5 w-5"
                )} />
                {variant === "default" && <span className="ml-2">Call</span>}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            {!isUserOnline ? "User is offline" : 
             isInCall ? "Already in a call" : "Start a call"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleAudioCall}>
          <Phone className="h-4 w-4 mr-2" />
          Voice Call
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleVideoCall}>
          <Video className="h-4 w-4 mr-2" />
          Video Call
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
