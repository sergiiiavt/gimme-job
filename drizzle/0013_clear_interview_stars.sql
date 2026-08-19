-- Reset interview stars after removing the legacy editorial/default star set.
-- This intentionally clears every existing row once. Future stars are created only
-- by an explicit user action through the personal interview-star API.
DELETE FROM `user_interview_stars`;
