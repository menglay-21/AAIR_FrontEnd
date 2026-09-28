-- Run once in pgAdmin 4 before starting the backend version that supports avatars.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);

COMMENT ON COLUMN users.avatar_url IS
    'Relative URL of the user avatar stored by the application, for example /uploads/avatars/<uuid>.webp';
