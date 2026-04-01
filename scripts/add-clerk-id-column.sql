-- Add clerk_id column to profiles table for Clerk authentication integration
-- This migration adds the clerk_id column which will store the Clerk user ID

-- Add the clerk_id column if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS clerk_id TEXT UNIQUE;

-- Create an index on clerk_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_clerk_id ON profiles(clerk_id);

-- Comment for documentation
COMMENT ON COLUMN profiles.clerk_id IS 'Clerk authentication user ID - links to Clerk user management';
