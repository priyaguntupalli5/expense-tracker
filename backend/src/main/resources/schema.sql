CREATE TABLE IF NOT EXISTS `groups` (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    name       VARCHAR(100) NOT NULL,
    group_code VARCHAR(6)   NULL,
    currency   VARCHAR(10)  NOT NULL DEFAULT 'CAD',
    PRIMARY KEY (id),
    UNIQUE KEY uk_group_name (name),
    UNIQUE KEY uk_group_code (group_code)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS users (
    id        BIGINT       NOT NULL AUTO_INCREMENT,
    username  VARCHAR(100) NOT NULL,
    password  VARCHAR(255) NOT NULL,
    group_id  BIGINT       NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_username (username),
    FOREIGN KEY (group_id) REFERENCES `groups`(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS categories (
    id    BIGINT NOT NULL AUTO_INCREMENT,
    value VARCHAR(50)  NOT NULL,
    label VARCHAR(100) NOT NULL,
    icon  VARCHAR(100) NOT NULL,
    color VARCHAR(10)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_value (value)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS expenses (
    id       BIGINT NOT NULL AUTO_INCREMENT,
    title    VARCHAR(100) NOT NULL,
    amount   DECIMAL(12, 2) NOT NULL,
    category VARCHAR(50)  NOT NULL,
    date     DATE         NOT NULL,
    notes    VARCHAR(255),
    group_id BIGINT       NULL,
    PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS fixed_expenses (
    id       BIGINT NOT NULL AUTO_INCREMENT,
    title    VARCHAR(100) NOT NULL,
    amount   DECIMAL(12, 2) NOT NULL,
    category VARCHAR(50)  NOT NULL,
    notes    VARCHAR(255),
    group_id BIGINT       NULL,
    PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS monthly_salaries (
    id            BIGINT NOT NULL AUTO_INCREMENT,
    month         INT    NOT NULL,
    year          INT    NOT NULL,
    priya_salary  DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    vamsi_salary  DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    group_id      BIGINT NULL,
    PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id       BIGINT       NOT NULL AUTO_INCREMENT,
    endpoint VARCHAR(2000) NOT NULL,
    p256dh   VARCHAR(500) NOT NULL,
    auth     VARCHAR(200) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_endpoint (endpoint(500))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS subcategories (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    category_value VARCHAR(50)  NOT NULL,
    name           VARCHAR(100) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_subcategory (category_value, name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS join_requests (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    username      VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    group_id      BIGINT       NOT NULL,
    requested_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_jr_username_group (username, group_id),
    FOREIGN KEY (group_id) REFERENCES `groups`(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- Idempotent column additions for existing databases
ALTER TABLE expenses        ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100) NULL;
ALTER TABLE expenses        ADD COLUMN IF NOT EXISTS image_data  MEDIUMTEXT   NULL;
ALTER TABLE expenses        ADD COLUMN IF NOT EXISTS group_id    BIGINT       NULL;
ALTER TABLE fixed_expenses  ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100) NULL;
ALTER TABLE fixed_expenses  ADD COLUMN IF NOT EXISTS group_id    BIGINT       NULL;
ALTER TABLE monthly_salaries ADD COLUMN IF NOT EXISTS group_id   BIGINT       NULL;
ALTER TABLE categories      ADD COLUMN IF NOT EXISTS is_income   BOOLEAN      NOT NULL DEFAULT FALSE;
ALTER TABLE `groups`        ADD COLUMN IF NOT EXISTS group_code  VARCHAR(6)   NULL;
ALTER TABLE `groups`        ADD COLUMN IF NOT EXISTS currency    VARCHAR(10)  NOT NULL DEFAULT 'CAD';

-- Note: monthly_salaries unique key migration (uk_month_year → uk_group_month_year) and
-- group_code unique key + backfill are handled by SchemaMigration.java on startup.
