"use client"

import { useRealtime } from '@/lib/realtime/realtime-context'
import { cn } from '@/lib/utils'

interface OnlineBadgeProps {
  userId: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export function OnlineBadge({ userId, className, size = 'md', showLabel = false }: OnlineBadgeProps) {
  const { onlineUsers } = useRealtime()
  const isOnline = onlineUsers.has(userId)

  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3'
  }

  if (!isOnline && !showLabel) return null

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span 
        className={cn(
          "rounded-full ring-2 ring-background",
          sizeClasses[size],
          isOnline ? "bg-green-500" : "bg-muted-foreground/30"
        )} 
      />
      {showLabel && (
        <span className={cn(
          "text-xs",
          isOnline ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
        )}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      )}
    </div>
  )
}

interface OnlineCountBadgeProps {
  className?: string
}

export function OnlineCountBadge({ className }: OnlineCountBadgeProps) {
  const { onlineUsers } = useRealtime()
  const count = onlineUsers.size

  return (
    <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
      <span>{count} online</span>
    </div>
  )
}
