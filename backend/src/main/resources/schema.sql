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
    PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS fixed_expenses (
    id       BIGINT NOT NULL AUTO_INCREMENT,
    title    VARCHAR(100) NOT NULL,
    amount   DECIMAL(12, 2) NOT NULL,
    category VARCHAR(50)  NOT NULL,
    notes    VARCHAR(255),
    PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS monthly_salaries (
    id            BIGINT NOT NULL AUTO_INCREMENT,
    month         INT    NOT NULL,
    year          INT    NOT NULL,
    priya_salary  DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    vamsi_salary  DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    PRIMARY KEY (id),
    UNIQUE KEY uk_month_year (month, year)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id       BIGINT       NOT NULL AUTO_INCREMENT,
    endpoint VARCHAR(2000) NOT NULL,
    p256dh   VARCHAR(500) NOT NULL,
    auth     VARCHAR(200) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_endpoint (endpoint(500))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
