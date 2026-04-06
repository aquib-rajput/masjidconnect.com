"use client"

import { useTypingIndicator } from "@/hooks/use-typing-indicator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface TypingIndicatorProps {
  conversationId: string
  className?: string
}

export function TypingIndicator({ conversationId, className }: TypingIndicatorProps) {
  const { typingUsers } = useTypingIndicator(conversationId)
  
  if (typingUsers.length === 0) return null
  
  const displayNames = typingUsers.map(u => u.display_name || 'Someone')
  
  let text = ''
  if (displayNames.length === 1) {
    text = `${displayNames[0]} is typing...`
  } else if (displayNames.length === 2) {
    text = `${displayNames[0]} and ${displayNames[1]} are typing...`
  } else {
    text = `${displayNames.length} people are typing...`
  }
  
  return (
    <div className={cn("flex items-center gap-2 px-4 py-2", className)}>
      <div className="flex -space-x-2">
        {typingUsers.slice(0, 3).map((user) => (
          <Avatar key={user.userId} className="h-6 w-6 border-2 border-background">
            <AvatarImage src={user.avatar_url || undefined} />
            <AvatarFallback className="text-xs">
              {user.display_name?.charAt(0) || '?'}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <span className="text-sm text-muted-foreground">{text}</span>
        <TypingDots />
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <span className="inline-flex gap-0.5 ml-1">
      <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
      <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
      <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
    </span>
  )
}
