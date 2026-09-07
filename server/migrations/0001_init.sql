-- Kedem Life — initial schema. UTC everywhere; money in minor units.
SET NAMES utf8mb4;

CREATE TABLE tenants (
  id            VARCHAR(64)  NOT NULL PRIMARY KEY,
  name          VARCHAR(160) NOT NULL,
  slug          VARCHAR(80)  NOT NULL,
  plan          ENUM('starter','growth','scale') NOT NULL DEFAULT 'starter',
  seats         INT UNSIGNED NOT NULL DEFAULT 100,
  primary_color VARCHAR(16)  NULL,
  -- Sign-ups that name no studio land here; exactly one row should be 1.
  is_default    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_tenants_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id                 VARCHAR(64)  NOT NULL PRIMARY KEY,
  tenant_id          VARCHAR(64)  NOT NULL,
  role               ENUM('member','coach','admin','app_manager') NOT NULL,
  first_name         VARCHAR(80)  NOT NULL,
  last_name          VARCHAR(80)  NOT NULL,
  email              VARCHAR(254) NOT NULL,
  password_hash      VARCHAR(100) NOT NULL,
  phone              VARCHAR(40)  NULL,
  avatar_url         VARCHAR(512) NULL,
  title              VARCHAR(160) NULL,
  bio                TEXT         NULL,
  location           VARCHAR(120) NULL,
  joined_at          DATE         NOT NULL,
  specialties        JSON         NULL,
  credentials        JSON         NULL,
  rating             DECIMAL(3,2) NULL,
  sessions_delivered INT UNSIGNED NULL,
  assigned_coach_id  VARCHAR(64)  NULL,
  status             ENUM('active','invited','suspended') NOT NULL DEFAULT 'active',
  created_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_users_email (email),
  KEY ix_users_tenant_role (tenant_id, role),
  KEY ix_users_coach (assigned_coach_id),
  CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id),
  CONSTRAINT fk_users_coach  FOREIGN KEY (assigned_coach_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The bookable view of a coach/clinician.
CREATE TABLE providers (
  user_id            VARCHAR(64)  NOT NULL PRIMARY KEY,
  discipline         ENUM('coaching','nutrition','physiotherapy','medical','mental_performance') NOT NULL,
  review_count       INT UNSIGNED NOT NULL DEFAULT 0,
  session_rate_minor INT UNSIGNED NOT NULL,
  currency           CHAR(3)      NOT NULL DEFAULT 'USD',
  channels           JSON         NOT NULL,
  timezone           VARCHAR(64)  NOT NULL DEFAULT 'America/New_York',
  slot_minutes       SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  accepting_bookings TINYINT(1)   NOT NULL DEFAULT 1,
  CONSTRAINT fk_providers_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Weekly working hours in the provider's own timezone (minutes from midnight).
CREATE TABLE provider_hours (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  provider_id  VARCHAR(64)  NOT NULL,
  weekday      TINYINT UNSIGNED NOT NULL,
  start_minute SMALLINT UNSIGNED NOT NULL,
  end_minute   SMALLINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_provider_hours (provider_id, weekday, start_minute),
  CONSTRAINT fk_hours_provider FOREIGN KEY (provider_id) REFERENCES providers (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE provider_time_off (
  id          VARCHAR(64)  NOT NULL PRIMARY KEY,
  provider_id VARCHAR(64)  NOT NULL,
  starts_at   DATETIME(3)  NOT NULL,
  ends_at     DATETIME(3)  NOT NULL,
  reason      VARCHAR(160) NULL,
  KEY ix_time_off_provider (provider_id, starts_at),
  CONSTRAINT fk_time_off_provider FOREIGN KEY (provider_id) REFERENCES providers (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE appointments (
  id               VARCHAR(64)  NOT NULL PRIMARY KEY,
  tenant_id        VARCHAR(64)  NOT NULL,
  member_id        VARCHAR(64)  NOT NULL,
  provider_id      VARCHAR(64)  NOT NULL,
  discipline       ENUM('coaching','nutrition','physiotherapy','medical','mental_performance') NOT NULL,
  channel          ENUM('zoom','google_meet','phone','in_person') NOT NULL,
  starts_at        DATETIME(3)  NOT NULL,
  duration_minutes SMALLINT UNSIGNED NOT NULL,
  status           ENUM('pending','confirmed','completed','cancelled','no_show') NOT NULL DEFAULT 'confirmed',
  price_minor      INT UNSIGNED NOT NULL,
  currency         CHAR(3)      NOT NULL DEFAULT 'USD',
  join_url         VARCHAR(512) NULL,
  notes            TEXT         NULL,
  member_goal      VARCHAR(255) NULL,
  -- Equals starts_at while the booking is live and NULL once cancelled, so the
  -- unique key allows exactly one live booking per provider slot.
  slot_key         DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  cancelled_at     DATETIME(3)  NULL,
  UNIQUE KEY uq_appt_provider_slot (provider_id, slot_key),
  KEY ix_appt_member (member_id, starts_at),
  KEY ix_appt_provider (provider_id, starts_at),
  KEY ix_appt_tenant (tenant_id, starts_at),
  CONSTRAINT fk_appt_tenant   FOREIGN KEY (tenant_id)   REFERENCES tenants (id),
  CONSTRAINT fk_appt_member   FOREIGN KEY (member_id)   REFERENCES users (id),
  CONSTRAINT fk_appt_provider FOREIGN KEY (provider_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE body_metrics (
  id                 VARCHAR(64)  NOT NULL PRIMARY KEY,
  member_id          VARCHAR(64)  NOT NULL,
  recorded_on        DATE         NOT NULL,
  weight_kg          DECIMAL(5,2) NOT NULL,
  height_cm          DECIMAL(5,1) NOT NULL,
  body_fat_percent   DECIMAL(4,1) NULL,
  resting_heart_rate SMALLINT UNSIGNED NULL,
  waist_cm           DECIMAL(5,1) NULL,
  note               VARCHAR(500) NULL,
  created_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_metrics_member_day (member_id, recorded_on),
  CONSTRAINT fk_metrics_member FOREIGN KEY (member_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE activity_entries (
  member_id         VARCHAR(64)  NOT NULL,
  `date`            DATE         NOT NULL,
  steps             INT UNSIGNED NOT NULL DEFAULT 0,
  active_minutes    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  calories_burned   INT UNSIGNED NOT NULL DEFAULT 0,
  calories_consumed INT UNSIGNED NOT NULL DEFAULT 0,
  protein_grams     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  water_ml          INT UNSIGNED NOT NULL DEFAULT 0,
  sleep_hours       DECIMAL(3,1) NOT NULL DEFAULT 0,
  workouts          TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (member_id, `date`),
  CONSTRAINT fk_activity_member FOREIGN KEY (member_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE member_goals (
  member_id             VARCHAR(64)  NOT NULL PRIMARY KEY,
  target_weight_kg      DECIMAL(5,2) NULL,
  daily_calorie_target  INT UNSIGNED NOT NULL DEFAULT 2200,
  daily_protein_target  SMALLINT UNSIGNED NOT NULL DEFAULT 150,
  daily_step_target     INT UNSIGNED NOT NULL DEFAULT 10000,
  weekly_workout_target TINYINT UNSIGNED NOT NULL DEFAULT 4,
  focus                 VARCHAR(160) NOT NULL DEFAULT 'General health',
  updated_at            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_goals_member FOREIGN KEY (member_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- tenant_id NULL = platform-wide catalogue entry.
CREATE TABLE products (
  id               VARCHAR(64)  NOT NULL PRIMARY KEY,
  tenant_id        VARCHAR(64)  NULL,
  slug             VARCHAR(120) NOT NULL,
  name             VARCHAR(160) NOT NULL,
  tagline          VARCHAR(200) NOT NULL DEFAULT '',
  description      TEXT         NOT NULL,
  category         ENUM('program','supplement','equipment','apparel','testing','membership') NOT NULL,
  price_minor      INT UNSIGNED NOT NULL,
  currency         CHAR(3)      NOT NULL DEFAULT 'USD',
  compare_at_minor INT UNSIGNED NULL,
  image_url        VARCHAR(512) NULL,
  accent           VARCHAR(16)  NOT NULL DEFAULT '#b6ef21',
  rating           DECIMAL(3,2) NOT NULL DEFAULT 0,
  review_count     INT UNSIGNED NOT NULL DEFAULT 0,
  in_stock         TINYINT(1)   NOT NULL DEFAULT 1,
  badge            VARCHAR(60)  NULL,
  digital          TINYINT(1)   NOT NULL DEFAULT 0,
  instructor_id    VARCHAR(64)  NULL,
  active           TINYINT(1)   NOT NULL DEFAULT 1,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_products_slug (slug),
  KEY ix_products_category (category, active),
  KEY ix_products_instructor (instructor_id),
  CONSTRAINT fk_products_tenant     FOREIGN KEY (tenant_id)     REFERENCES tenants (id),
  CONSTRAINT fk_products_instructor FOREIGN KEY (instructor_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE orders (
  id              VARCHAR(64)  NOT NULL PRIMARY KEY,
  order_no        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reference       VARCHAR(48)  NOT NULL,
  tenant_id       VARCHAR(64)  NOT NULL,
  customer_id     VARCHAR(64)  NOT NULL,
  customer_name   VARCHAR(170) NOT NULL,
  customer_email  VARCHAR(254) NOT NULL,
  subtotal_minor  INT UNSIGNED NOT NULL,
  shipping_minor  INT UNSIGNED NOT NULL,
  tax_minor       INT UNSIGNED NOT NULL,
  total_minor     INT UNSIGNED NOT NULL,
  currency        CHAR(3)      NOT NULL DEFAULT 'USD',
  status          ENUM('awaiting_payment','paid','processing','shipped','delivered','refunded','cancelled') NOT NULL DEFAULT 'awaiting_payment',
  placed_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fulfilled_at    DATETIME(3)  NULL,
  tracking_number VARCHAR(60)  NULL,
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_orders_no (order_no),
  UNIQUE KEY uq_orders_reference (reference),
  KEY ix_orders_customer (customer_id, placed_at),
  KEY ix_orders_tenant (tenant_id, placed_at),
  CONSTRAINT fk_orders_tenant   FOREIGN KEY (tenant_id)   REFERENCES tenants (id),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_lines (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id         VARCHAR(64)  NOT NULL,
  product_id       VARCHAR(64)  NOT NULL,
  name             VARCHAR(160) NOT NULL,
  quantity         SMALLINT UNSIGNED NOT NULL,
  unit_price_minor INT UNSIGNED NOT NULL,
  currency         CHAR(3)      NOT NULL DEFAULT 'USD',
  instructor_id    VARCHAR(64)  NULL,
  KEY ix_lines_order (order_id),
  KEY ix_lines_instructor (instructor_id),
  CONSTRAINT fk_lines_order   FOREIGN KEY (order_id)   REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_lines_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payments (
  id            VARCHAR(64)  NOT NULL PRIMARY KEY,
  tenant_id     VARCHAR(64)  NOT NULL,
  reference     VARCHAR(64)  NOT NULL,
  order_id      VARCHAR(64)  NULL,
  customer_id   VARCHAR(64)  NOT NULL,
  customer_name VARCHAR(170) NOT NULL,
  description   VARCHAR(200) NOT NULL,
  gross_minor   INT UNSIGNED NOT NULL,
  fee_minor     INT UNSIGNED NOT NULL DEFAULT 0,
  net_minor     INT UNSIGNED NOT NULL,
  currency      CHAR(3)      NOT NULL DEFAULT 'USD',
  method        ENUM('card','apple_pay','google_pay','bank_transfer') NOT NULL,
  card_last4    CHAR(4)      NULL,
  card_brand    VARCHAR(20)  NULL,
  status        ENUM('succeeded','pending','failed','refunded','disputed') NOT NULL,
  provider      VARCHAR(20)  NOT NULL DEFAULT 'manual',
  processed_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  payout_id     VARCHAR(40)  NULL,
  UNIQUE KEY uq_payments_reference (reference),
  KEY ix_payments_tenant (tenant_id, processed_at),
  KEY ix_payments_order (order_id),
  CONSTRAINT fk_payments_tenant   FOREIGN KEY (tenant_id)   REFERENCES tenants (id),
  CONSTRAINT fk_payments_order    FOREIGN KEY (order_id)    REFERENCES orders (id) ON DELETE SET NULL,
  CONSTRAINT fk_payments_customer FOREIGN KEY (customer_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE subscriptions (
  id           VARCHAR(64)  NOT NULL PRIMARY KEY,
  tenant_id    VARCHAR(64)  NOT NULL,
  member_id    VARCHAR(64)  NOT NULL,
  product_id   VARCHAR(64)  NULL,
  plan_name    VARCHAR(120) NOT NULL,
  price_minor  INT UNSIGNED NOT NULL,
  currency     CHAR(3)      NOT NULL DEFAULT 'USD',
  `interval`   ENUM('month','year') NOT NULL DEFAULT 'month',
  status       ENUM('active','past_due','cancelled','trialing') NOT NULL DEFAULT 'active',
  started_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  renews_at    DATETIME(3)  NOT NULL,
  cancelled_at DATETIME(3)  NULL,
  updated_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY ix_subs_member (member_id, status),
  KEY ix_subs_tenant (tenant_id, status),
  CONSTRAINT fk_subs_tenant  FOREIGN KEY (tenant_id)  REFERENCES tenants (id),
  CONSTRAINT fk_subs_member  FOREIGN KEY (member_id)  REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_subs_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE refresh_tokens (
  id         VARCHAR(64)  NOT NULL PRIMARY KEY,
  user_id    VARCHAR(64)  NOT NULL,
  session_id VARCHAR(64)  NOT NULL,
  token_hash CHAR(64)     NOT NULL,
  expires_at DATETIME(3)  NOT NULL,
  revoked_at DATETIME(3)  NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_refresh_hash (token_hash),
  KEY ix_refresh_user (user_id),
  KEY ix_refresh_session (session_id),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE password_reset_tokens (
  id         VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id    VARCHAR(64) NOT NULL,
  token_hash CHAR(64)    NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  used_at    DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_reset_hash (token_hash),
  KEY ix_reset_user (user_id),
  CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE contact_messages (
  id         VARCHAR(64)  NOT NULL PRIMARY KEY,
  first_name VARCHAR(80)  NOT NULL,
  last_name  VARCHAR(80)  NOT NULL,
  email      VARCHAR(254) NOT NULL,
  phone      VARCHAR(40)  NULL,
  topic      VARCHAR(40)  NOT NULL,
  message    TEXT         NOT NULL,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  handled_at DATETIME(3)  NULL,
  KEY ix_contact_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE newsletter_subscribers (
  email           VARCHAR(254) NOT NULL PRIMARY KEY,
  source          VARCHAR(40)  NOT NULL DEFAULT 'footer',
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  unsubscribed_at DATETIME(3)  NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
