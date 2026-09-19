-- Avatars are now icon codes stored on User.profileImage; photo uploads are gone.
DROP TABLE IF EXISTS "Avatar";

-- Old generated/uploaded avatar URLs no longer resolve; clear them so those accounts
-- fall back to a stable icon derived from their name.
UPDATE "User" SET "profileImage" = NULL WHERE "profileImage" LIKE '/api/avatars/%';
