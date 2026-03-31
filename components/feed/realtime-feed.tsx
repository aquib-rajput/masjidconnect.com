"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  MoreHorizontal, 
  ImagePlus, 
  X, 
  Send,
  Loader2,
  Trash2,
  Flag,
  Bookmark,
  Calendar,
  MapPin,
  Quote,
  Zap,
  Info
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Post {
  id: string;
  content: string;
  image_url: string | null;
  likes_count: number;
  comments_count: number;
  post_type: 'text' | 'image' | 'event' | 'announcement' | 'prayer-request' | 'quote';
  category: string;
  metadata: any;
  created_at: string;
  author: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    username: string | null;
  };
  is_liked?: boolean;
  is_bookmarked?: boolean;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  author: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export function RealtimeFeed() {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [postType, setPostType] = useState<Post['post_type']>('text');
  const [eventDate, setEventDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [quoteSource, setQuoteSource] = useState("");
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [loadingComments, setLoadingComments] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  // Fetch posts
  const fetchPosts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("posts")
        .select(`
          *,
          author:profiles!author_id(id, full_name, avatar_url, username)
        `)
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Check if current user has liked each post
      if (user && data) {
        const { data: likes } = await supabase
          .from("post_likes")
          .select("post_id")
          .eq("user_id", user.id);

        const { data: bookmarks } = await supabase
          .from("post_bookmarks")
          .select("post_id")
          .eq("user_id", user.id);

        const likedPostIds = new Set(likes?.map(l => l.post_id) || []);
        const bookmarkedPostIds = new Set(bookmarks?.map(b => b.post_id) || []);
        
        const updatedPosts = data.map(post => ({
          ...post,
          is_liked: likedPostIds.has(post.id),
          is_bookmarked: bookmarkedPostIds.has(post.id)
        }));
        
        setPosts(updatedPosts);
      } else {
        setPosts(data || []);
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
      toast.error("Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, [supabase, user]);

  // Set up realtime subscription
  useEffect(() => {
    fetchPosts();

    const channel = supabase
      .channel("posts-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        async (payload) => {
          const { data: newPost } = await supabase
            .from("posts")
            .select(`*, author:profiles!author_id(id, full_name, avatar_url, username)`)
            .eq("id", payload.new.id)
            .single();
          
          if (newPost) {
            setPosts(prev => [newPost, ...prev]);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "posts" },
        async (payload) => {
          setPosts(prev => 
            prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p)
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "posts" },
        (payload) => {
          setPosts(prev => prev.filter(p => p.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPosts, supabase]);

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size must be less than 5MB");
        return;
      }
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // Clear selected image
  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Create new post
  const handleCreatePost = async () => {
    if (!user || (!newPostContent.trim() && !selectedImage)) return;

    setPosting(true);
    try {
      let imageUrl = null;

      // Upload image if selected
      if (selectedImage) {
        const formData = new FormData();
        formData.append("file", selectedImage);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error("Failed to upload image");
        }

        const { url } = await uploadRes.json();
        imageUrl = url;
      }

      // Prepare metadata
      const metadata: any = {};
      if (postType === 'event') {
        metadata.eventDetails = { date: eventDate, location: eventLocation };
      } else if (postType === 'quote') {
        metadata.quoteSource = quoteSource;
      }

      // Create post
      const { error } = await supabase
        .from("posts")
        .insert({
          author_id: user.id,
          content: newPostContent.trim(),
          image_url: imageUrl,
          post_type: postType,
          metadata: metadata
        });

      if (error) throw error;

      setNewPostContent("");
      setPostType('text');
      setEventDate("");
      setEventLocation("");
      setQuoteSource("");
      clearImage();
      toast.success("Post created successfully");
    } catch (error) {
      console.error("Error creating post:", error);
      toast.error("Failed to create post");
    } finally {
      setPosting(false);
    }
  };

  // Toggle like
  const handleLike = async (postId: string, isLiked: boolean) => {
    if (!user) {
      toast.error("Please sign in to like posts");
      return;
    }

    try {
      if (isLiked) {
        await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);

        setPosts(prev =>
          prev.map(p =>
            p.id === postId
              ? { ...p, is_liked: false, likes_count: p.likes_count - 1 }
              : p
          )
        );
      } else {
        await supabase
          .from("post_likes")
          .insert({ post_id: postId, user_id: user.id });

        setPosts(prev =>
          prev.map(p =>
            p.id === postId
              ? { ...p, is_liked: true, likes_count: p.likes_count + 1 }
              : p
          )
        );
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  // Toggle bookmark
  const handleToggleBookmark = async (postId: string, isBookmarked: boolean) => {
    if (!user) {
      toast.error("Please sign in to save posts");
      return;
    }

    try {
      if (isBookmarked) {
        await supabase
          .from("post_bookmarks")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);

        setPosts(prev =>
          prev.map(p => p.id === postId ? { ...p, is_bookmarked: false } : p)
        );
        toast.success("Removed from bookmarks");
      } else {
        await supabase
          .from("post_bookmarks")
          .insert({ post_id: postId, user_id: user.id });

        setPosts(prev =>
          prev.map(p => p.id === postId ? { ...p, is_bookmarked: true } : p)
        );
        toast.success("Added to bookmarks");
      }
    } catch (error) {
      console.error("Error toggling bookmark:", error);
    }
  };

  // Load comments for a post
  const loadComments = async (postId: string) => {
    if (loadingComments.has(postId)) return;
    
    setLoadingComments(prev => new Set(prev).add(postId));
    
    try {
      const { data, error } = await supabase
        .from("post_comments")
        .select(`*, author:profiles!author_id(id, full_name, avatar_url)`)
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setComments(prev => ({ ...prev, [postId]: data || [] }));
    } catch (error) {
      console.error("Error loading comments:", error);
    } finally {
      setLoadingComments(prev => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  };

  // Toggle comments section
  const toggleComments = (postId: string) => {
    const newExpanded = new Set(expandedComments);
    if (newExpanded.has(postId)) {
      newExpanded.delete(postId);
    } else {
      newExpanded.add(postId);
      if (!comments[postId]) {
        loadComments(postId);
      }
    }
    setExpandedComments(newExpanded);
  };

  // Add comment
  const handleAddComment = async (postId: string) => {
    if (!user || !newComments[postId]?.trim()) return;

    try {
      const { data, error } = await supabase
        .from("post_comments")
        .insert({
          post_id: postId,
          author_id: user.id,
          content: newComments[postId].trim(),
        })
        .select(`*, author:profiles!author_id(id, full_name, avatar_url)`)
        .single();

      if (error) throw error;

      setComments(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), data],
      }));

      setNewComments(prev => ({ ...prev, [postId]: "" }));

      // Update comment count
      setPosts(prev =>
        prev.map(p =>
          p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p
        )
      );
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    }
  };

  // Delete post
  const handleDeletePost = async (postId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId)
        .eq("author_id", user.id);

      if (error) throw error;

      setPosts(prev => prev.filter(p => p.id !== postId));
      toast.success("Post deleted");
    } catch (error) {
      console.error("Error deleting post:", error);
      toast.error("Failed to delete post");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create Post */}
      {user && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <Avatar>
                <AvatarImage src={profile?.avatar_url || ""} />
                <AvatarFallback>
                  {profile?.full_name?.charAt(0) || user.email?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-4">
                <Textarea
                  placeholder="Share something with the community..."
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  className="min-h-[100px] resize-none"
                />
                {imagePreview && (
                  <div className="relative inline-block">
                    <Image
                      src={imagePreview}
                      alt="Preview"
                      width={200}
                      height={200}
                      className="rounded-lg object-cover"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute -right-2 -top-2 h-6 w-6"
                      onClick={clearImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={postType} onValueChange={(v: any) => setPostType(v)}>
                      <SelectTrigger className="w-[140px] h-9 text-xs font-bold uppercase tracking-wider rounded-xl">
                        <SelectValue placeholder="Post Type" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="text">General Post</SelectItem>
                        <SelectItem value="event">Event</SelectItem>
                        <SelectItem value="announcement">Announcement</SelectItem>
                        <SelectItem value="prayer-request">Prayer Request</SelectItem>
                        <SelectItem value="quote">Islamic Quote</SelectItem>
                      </SelectContent>
                    </Select>

                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageSelect}
                      accept="image/*"
                      className="hidden"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl h-9 px-3"
                    >
                      <ImagePlus className="mr-2 h-4 w-4 text-primary" />
                      <span className="text-xs font-bold uppercase tracking-wider">Photo</span>
                    </Button>
                  </div>

                  <Button
                    onClick={handleCreatePost}
                    disabled={posting || (!newPostContent.trim() && !selectedImage)}
                    className="rounded-xl px-6 font-bold shadow-lg shadow-primary/20"
                  >
                    {posting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Post
                  </Button>
                </div>

                {/* Conditional Metadata Inputs */}
                {postType === 'event' && (
                  <div className="grid grid-cols-2 gap-3 pt-2 animate-in fade-in slide-in-from-top-1 duration-300">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Date & Time</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-primary/40" />
                        <input
                          type="text"
                          placeholder="Tomorrow at 2PM"
                          value={eventDate}
                          onChange={(e) => setEventDate(e.target.value)}
                          className="w-full bg-muted/50 border-none rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-1 focus:ring-primary/20"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Location</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-primary/40" />
                        <input
                          type="text"
                          placeholder="Main Hall"
                          value={eventLocation}
                          onChange={(e) => setEventLocation(e.target.value)}
                          className="w-full bg-muted/50 border-none rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-1 focus:ring-primary/20"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {postType === 'quote' && (
                  <div className="pt-2 animate-in fade-in slide-in-from-top-1 duration-300">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Source (e.g. Sahih Bukhari)</label>
                      <div className="relative">
                        <Quote className="absolute left-3 top-2.5 h-4 w-4 text-primary/40" />
                        <input
                          type="text"
                          placeholder="Hadith Vol 1..."
                          value={quoteSource}
                          onChange={(e) => setQuoteSource(e.target.value)}
                          className="w-full bg-muted/50 border-none rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-1 focus:ring-primary/20"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Posts Feed */}
      {posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No posts yet. Be the first to share something!</p>
          </CardContent>
        </Card>
      ) : (
        posts.map((post) => (
          <Card key={post.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={post.author?.avatar_url || ""} />
                  <AvatarFallback>
                    {post.author?.full_name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold leading-none">
                    {post.author?.full_name || "Anonymous"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {user?.id === post.author?.id ? (
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDeletePost(post.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem>
                      <Flag className="mr-2 h-4 w-4" />
                      Report
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Specialized Post Layouts */}
              {post.post_type === 'quote' ? (
                <div className="bg-primary/5 border-l-4 border-primary p-6 rounded-r-2xl">
                  <Quote className="h-8 w-8 text-primary/20 mb-2" />
                  <p className="text-xl font-medium italic text-primary/90 leading-relaxed">
                    "{post.content}"
                  </p>
                  {post.metadata?.quoteSource && (
                    <p className="mt-4 text-sm font-bold text-primary/60 uppercase tracking-widest">
                      — {post.metadata.quoteSource}
                    </p>
                  )}
                </div>
              ) : post.post_type === 'event' ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none font-bold text-[10px] uppercase tracking-widest py-1 px-3">Community Event</Badge>
                  </div>
                  <p className="whitespace-pre-wrap text-lg font-medium">{post.content}</p>
                  <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-2xl border border-border/40">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-background flex items-center justify-center shadow-sm border border-border/40">
                        <Calendar className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Date & Time</p>
                        <p className="text-sm font-bold">{post.metadata?.eventDetails?.date || 'See details'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-background flex items-center justify-center shadow-sm border border-border/40">
                        <MapPin className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Location</p>
                        <p className="text-sm font-bold">{post.metadata?.eventDetails?.location || 'Mosque'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : post.post_type === 'announcement' ? (
                <div className="bg-amber-500/5 border border-amber-500/10 p-5 rounded-2xl">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-amber-600 fill-amber-600" />
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-[0.2em]">Official Announcement</span>
                  </div>
                  <p className="text-lg font-bold text-amber-900/80 leading-relaxed">{post.content}</p>
                </div>
              ) : post.post_type === 'prayer-request' ? (
                <div className="bg-sky-500/5 border border-sky-500/10 p-5 rounded-2xl">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-sky-700 uppercase tracking-[0.2em]">Prayer Request (Dua)</span>
                  </div>
                  <p className="text-lg font-medium text-sky-900/80 italic">"{post.content}"</p>
                  <div className="mt-4 flex items-center gap-2 text-sky-600/80">
                    <Info className="h-4 w-4" />
                    <span className="text-xs font-medium">May Allah answer all sincere prayers. Ameen.</span>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{post.content}</p>
              )}

              {post.image_url && post.post_type !== 'quote' && (
                <div className="relative aspect-video w-full overflow-hidden rounded-2xl shadow-sm">
                  <Image
                    src={post.image_url}
                    alt="Post image"
                    fill
                    className="object-cover"
                  />
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <div className="flex w-full items-center gap-4 border-t pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleLike(post.id, !!post.is_liked)}
                  className={post.is_liked ? "text-red-500" : ""}
                >
                  <Heart className={`mr-2 h-4 w-4 ${post.is_liked ? "fill-current" : ""}`} />
                  {post.likes_count}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleComments(post.id)}
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  {post.comments_count}
                </Button>
                <Button variant="ghost" size="sm">
                  <Share2 className="mr-2 h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Share</span>
                </Button>
                <div className="ml-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleBookmark(post.id, !!post.is_bookmarked)}
                    className={post.is_bookmarked ? "text-primary bg-primary/5" : "text-muted-foreground"}
                  >
                    <Bookmark className={`mr-2 h-4 w-4 ${post.is_bookmarked ? "fill-current" : ""}`} />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {post.is_bookmarked ? "Saved" : "Save"}
                    </span>
                  </Button>
                </div>
              </div>

              {/* Comments Section */}
              {expandedComments.has(post.id) && (
                <div className="w-full space-y-4 border-t pt-4">
                  {loadingComments.has(post.id) ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <>
                      {comments[post.id]?.map((comment) => (
                        <div key={comment.id} className="flex gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={comment.author?.avatar_url || ""} />
                            <AvatarFallback>
                              {comment.author?.full_name?.charAt(0) || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 rounded-lg bg-muted p-3">
                            <p className="text-sm font-semibold">
                              {comment.author?.full_name || "Anonymous"}
                            </p>
                            <p className="text-sm">{comment.content}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      ))}

                      {user && (
                        <div className="flex gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={profile?.avatar_url || ""} />
                            <AvatarFallback>
                              {profile?.full_name?.charAt(0) || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-1 gap-2">
                            <Textarea
                              placeholder="Write a comment..."
                              value={newComments[post.id] || ""}
                              onChange={(e) =>
                                setNewComments(prev => ({
                                  ...prev,
                                  [post.id]: e.target.value,
                                }))
                              }
                              className="min-h-[40px] flex-1 resize-none"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleAddComment(post.id);
                                }
                              }}
                            />
                            <Button
                              size="icon"
                              onClick={() => handleAddComment(post.id)}
                              disabled={!newComments[post.id]?.trim()}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardFooter>
          </Card>
        ))
      )}
    </div>
  );
}
