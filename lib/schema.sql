-- Analytics DB Schema
-- 1. Create database (once): createdb -U postgres analytics_db
-- 2. Apply schema: psql -U postgres -d analytics_db -f sql/schema.sql
-- 3. Load data: PGPASSWORD=password npm run db:load

-- ---------------------------------------------------------------------------
-- Reference / dimension tables (PKs only; no FKs between them)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS clients (
  client_id VARCHAR(20) PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  client_id VARCHAR(20) NOT NULL,
  user_id VARCHAR(30) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, user_id),
  CONSTRAINT fk_users_client FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS channels (
  client_id VARCHAR(20) NOT NULL,
  channel_id VARCHAR(30) NOT NULL,
  channel_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, channel_id),
  CONSTRAINT fk_channels_client FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- Fact table: videos (references clients, channels, users)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS videos (
  video_id BIGINT PRIMARY KEY,
  client_id VARCHAR(20) NOT NULL,
  channel_id VARCHAR(30) NOT NULL,
  user_id VARCHAR(30) NOT NULL,
  input_type_id VARCHAR(20),
  input_type_name VARCHAR(100),
  output_type_id VARCHAR(20),
  output_type_name VARCHAR(100),
  language_id VARCHAR(20),
  language_name VARCHAR(20),
  duration TEXT,
  uploaded_at TIMESTAMP,
  processed_at TIMESTAMP,
  published_at TIMESTAMP,
  published_flag BOOLEAN NOT NULL DEFAULT FALSE,
  published_platform VARCHAR(50),
  published_url TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_videos_client FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
  CONSTRAINT fk_videos_channel FOREIGN KEY (client_id, channel_id) REFERENCES channels(client_id, channel_id) ON DELETE CASCADE,
  CONSTRAINT fk_videos_user FOREIGN KEY (client_id, user_id) REFERENCES users(client_id, user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_videos_client ON videos(client_id);
CREATE INDEX IF NOT EXISTS idx_videos_channel ON videos(client_id, channel_id);
CREATE INDEX IF NOT EXISTS idx_videos_user ON videos(client_id, user_id);
CREATE INDEX IF NOT EXISTS idx_videos_uploaded ON videos(uploaded_at);

-- ---------------------------------------------------------------------------
-- Summary tables (all reference clients; some reference channel/user)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS monthly_processing_summary (
  client_id VARCHAR(20) NOT NULL,
  month VARCHAR(20) NOT NULL,
  total_uploaded INTEGER NOT NULL DEFAULT 0,
  total_created INTEGER NOT NULL DEFAULT 0,
  total_published INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, month),
  CONSTRAINT fk_monthly_processing_client FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
  CONSTRAINT chk_monthly_uploaded CHECK (total_uploaded >= 0),
  CONSTRAINT chk_monthly_created CHECK (total_created >= 0),
  CONSTRAINT chk_monthly_published CHECK (total_published >= 0)
);

CREATE TABLE IF NOT EXISTS monthly_duration_summary (
  client_id VARCHAR(20) NOT NULL,
  month VARCHAR(20) NOT NULL,
  total_uploaded_duration TEXT NOT NULL,
  total_created_duration TEXT NOT NULL,
  total_published_duration TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, month),
  CONSTRAINT fk_monthly_duration_client FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS channel_processing_summary (
  client_id VARCHAR(20) NOT NULL,
  channel_id VARCHAR(30) NOT NULL,
  channel_name VARCHAR(100) NOT NULL,
  uploaded_count INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  published_count INTEGER NOT NULL DEFAULT 0,
  uploaded_duration_hh_mm_ss TEXT,
  created_duration_hh_mm_ss TEXT,
  published_duration_hh_mm_ss TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, channel_id),
  CONSTRAINT fk_channel_summary_client FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
  CONSTRAINT fk_channel_summary_channel FOREIGN KEY (client_id, channel_id) REFERENCES channels(client_id, channel_id) ON DELETE CASCADE,
  CONSTRAINT chk_channel_uploaded CHECK (uploaded_count >= 0),
  CONSTRAINT chk_channel_created CHECK (created_count >= 0),
  CONSTRAINT chk_channel_published CHECK (published_count >= 0)
);

CREATE TABLE IF NOT EXISTS channel_user_processing_summary (
  client_id VARCHAR(20) NOT NULL,
  channel_id VARCHAR(30) NOT NULL,
  user_id VARCHAR(30) NOT NULL,
  channel_name VARCHAR(100) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  uploaded_count INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  published_count INTEGER NOT NULL DEFAULT 0,
  uploaded_duration_hh_mm_ss TEXT,
  created_duration_hh_mm_ss TEXT,
  published_duration_hh_mm_ss TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, channel_id, user_id),
  CONSTRAINT fk_channel_user_client FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
  CONSTRAINT fk_channel_user_channel FOREIGN KEY (client_id, channel_id) REFERENCES channels(client_id, channel_id) ON DELETE CASCADE,
  CONSTRAINT fk_channel_user_user FOREIGN KEY (client_id, user_id) REFERENCES users(client_id, user_id) ON DELETE CASCADE,
  CONSTRAINT chk_channel_user_uploaded CHECK (uploaded_count >= 0),
  CONSTRAINT chk_channel_user_created CHECK (created_count >= 0),
  CONSTRAINT chk_channel_user_published CHECK (published_count >= 0)
);

CREATE TABLE IF NOT EXISTS user_processing_summary (
  client_id VARCHAR(20) NOT NULL,
  user_id VARCHAR(30) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  uploaded_count INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  published_count INTEGER NOT NULL DEFAULT 0,
  uploaded_duration_hh_mm_ss TEXT,
  created_duration_hh_mm_ss TEXT,
  published_duration_hh_mm_ss TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, user_id),
  CONSTRAINT fk_user_summary_client FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
  CONSTRAINT fk_user_summary_user FOREIGN KEY (client_id, user_id) REFERENCES users(client_id, user_id) ON DELETE CASCADE,
  CONSTRAINT chk_user_uploaded CHECK (uploaded_count >= 0),
  CONSTRAINT chk_user_created CHECK (created_count >= 0),
  CONSTRAINT chk_user_published CHECK (published_count >= 0)
);

CREATE TABLE IF NOT EXISTS input_type_processing_summary (
  client_id VARCHAR(20) NOT NULL,
  input_type VARCHAR(100) NOT NULL,
  uploaded_count INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  published_count INTEGER NOT NULL DEFAULT 0,
  uploaded_duration_hh_mm_ss TEXT,
  created_duration_hh_mm_ss TEXT,
  published_duration_hh_mm_ss TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, input_type),
  CONSTRAINT fk_input_type_client FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
  CONSTRAINT chk_input_uploaded CHECK (uploaded_count >= 0),
  CONSTRAINT chk_input_created CHECK (created_count >= 0),
  CONSTRAINT chk_input_published CHECK (published_count >= 0)
);

CREATE TABLE IF NOT EXISTS output_type_processing_summary (
  client_id VARCHAR(20) NOT NULL,
  output_type VARCHAR(100) NOT NULL,
  uploaded_count INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  published_count INTEGER NOT NULL DEFAULT 0,
  uploaded_duration_hh_mm_ss TEXT,
  created_duration_hh_mm_ss TEXT,
  published_duration_hh_mm_ss TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, output_type),
  CONSTRAINT fk_output_type_client FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
  CONSTRAINT chk_output_uploaded CHECK (uploaded_count >= 0),
  CONSTRAINT chk_output_created CHECK (created_count >= 0),
  CONSTRAINT chk_output_published CHECK (published_count >= 0)
);

CREATE TABLE IF NOT EXISTS language_processing_summary (
  client_id VARCHAR(20) NOT NULL,
  language VARCHAR(20) NOT NULL,
  uploaded_count INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  published_count INTEGER NOT NULL DEFAULT 0,
  uploaded_duration_hh_mm_ss TEXT,
  created_duration_hh_mm_ss TEXT,
  published_duration_hh_mm_ss TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, language),
  CONSTRAINT fk_language_client FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
  CONSTRAINT chk_language_uploaded CHECK (uploaded_count >= 0),
  CONSTRAINT chk_language_created CHECK (created_count >= 0),
  CONSTRAINT chk_language_published CHECK (published_count >= 0)
);

CREATE TABLE IF NOT EXISTS channel_wise_publishing_counts (
  client_id VARCHAR(20) NOT NULL,
  channel_id VARCHAR(30) NOT NULL,
  channel_name VARCHAR(100) NOT NULL,
  facebook_count INTEGER NOT NULL DEFAULT 0,
  instagram_count INTEGER NOT NULL DEFAULT 0,
  linkedin_count INTEGER NOT NULL DEFAULT 0,
  reels_count INTEGER NOT NULL DEFAULT 0,
  shorts_count INTEGER NOT NULL DEFAULT 0,
  x_count INTEGER NOT NULL DEFAULT 0,
  youtube_count INTEGER NOT NULL DEFAULT 0,
  threads_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, channel_id),
  CONSTRAINT fk_pub_counts_client FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
  CONSTRAINT fk_pub_counts_channel FOREIGN KEY (client_id, channel_id) REFERENCES channels(client_id, channel_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS channel_wise_publishing_duration (
  client_id VARCHAR(20) NOT NULL,
  channel_id VARCHAR(30) NOT NULL,
  channel_name VARCHAR(100) NOT NULL,
  facebook_duration TEXT,
  instagram_duration TEXT,
  linkedin_duration TEXT,
  reels_duration TEXT,
  shorts_duration TEXT,
  x_duration TEXT,
  youtube_duration TEXT,
  threads_duration TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, channel_id),
  CONSTRAINT fk_pub_duration_client FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
  CONSTRAINT fk_pub_duration_channel FOREIGN KEY (client_id, channel_id) REFERENCES channels(client_id, channel_id) ON DELETE CASCADE
);
