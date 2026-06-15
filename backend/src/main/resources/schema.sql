CREATE TABLE IF NOT EXISTS `groups` (
    id   BIGINT       NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_group_name (name)
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

-- Idempotent column additions for existing databases
ALTER TABLE expenses        ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100) NULL;
ALTER TABLE expenses        ADD COLUMN IF NOT EXISTS image_data  MEDIUMTEXT   NULL;
ALTER TABLE expenses        ADD COLUMN IF NOT EXISTS group_id    BIGINT       NULL;
ALTER TABLE fixed_expenses  ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100) NULL;
ALTER TABLE fixed_expenses  ADD COLUMN IF NOT EXISTS group_id    BIGINT       NULL;
ALTER TABLE monthly_salaries ADD COLUMN IF NOT EXISTS group_id   BIGINT       NULL;
ALTER TABLE categories      ADD COLUMN IF NOT EXISTS is_income   BOOLEAN      NOT NULL DEFAULT FALSE;

-- Fix monthly_salaries unique key to include group_id (idempotent via procedure)
DROP PROCEDURE IF EXISTS fix_salary_unique_key;
CREATE PROCEDURE fix_salary_unique_key()
BEGIN
    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'monthly_salaries'
          AND INDEX_NAME = 'uk_month_year'
    ) THEN
        ALTER TABLE monthly_salaries DROP INDEX uk_month_year;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'monthly_salaries'
          AND INDEX_NAME = 'uk_group_month_year'
    ) THEN
        ALTER TABLE monthly_salaries ADD UNIQUE KEY uk_group_month_year (group_id, month, year);
    END IF;
END;
CALL fix_salary_unique_key();
DROP PROCEDURE IF EXISTS fix_salary_unique_key;
