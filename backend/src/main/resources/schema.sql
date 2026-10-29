CREATE TABLE IF NOT EXISTS `groups` (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    name       VARCHAR(100) NOT NULL,
    group_code VARCHAR(6)   NULL,
    currency   VARCHAR(10)  NOT NULL DEFAULT 'CAD',
    is_demo    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_group_name (name),
    UNIQUE KEY uk_group_code (group_code)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS users (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    username   VARCHAR(100) NOT NULL,
    password   VARCHAR(255) NOT NULL,
    group_id   BIGINT       NOT NULL,
    is_admin   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_username (username),
    FOREIGN KEY (group_id) REFERENCES `groups`(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS categories (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    value      VARCHAR(50)  NOT NULL,
    label      VARCHAR(100) NOT NULL,
    icon       VARCHAR(100) NOT NULL,
    color      VARCHAR(10)  NOT NULL,
    is_income  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_value (value)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS expenses (
    id              BIGINT         NOT NULL AUTO_INCREMENT,
    title           VARCHAR(100)   NOT NULL,
    amount          DECIMAL(12, 2) NOT NULL,
    category        VARCHAR(50)    NOT NULL,
    date            DATE           NOT NULL,
    notes           VARCHAR(255),
    group_id        BIGINT         NULL,
    subcategory     VARCHAR(100)   NULL,
    image_data      MEDIUMTEXT     NULL,
    source_fixed_id BIGINT         NULL,
    created_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- Multiple labels per expense (many-to-many: an expense can carry several tags)
CREATE TABLE IF NOT EXISTS expense_tags (
    expense_id BIGINT      NOT NULL,
    tag        VARCHAR(50) NOT NULL,
    PRIMARY KEY (expense_id, tag),
    CONSTRAINT fk_expense_tags_expense FOREIGN KEY (expense_id) REFERENCES expenses (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS fixed_expenses (
    id          BIGINT         NOT NULL AUTO_INCREMENT,
    title       VARCHAR(100)   NOT NULL,
    amount      DECIMAL(12, 2) NOT NULL,
    category    VARCHAR(50)    NOT NULL,
    notes       VARCHAR(255),
    group_id    BIGINT         NULL,
    recurrence  VARCHAR(20)    NOT NULL DEFAULT 'MONTHLY',
    subcategory VARCHAR(100)   NULL,
    start_date  DATE           NULL,
    end_date    DATE           NULL,
    created_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS income_entries (
    id           BIGINT         NOT NULL AUTO_INCREMENT,
    title        VARCHAR(100)   NOT NULL,
    amount       DECIMAL(12,2)  NOT NULL,
    source_type  VARCHAR(20)    NOT NULL DEFAULT 'SALARY',
    payment_date DATE           NULL,
    notes        VARCHAR(255)   NULL,
    group_id     BIGINT         NOT NULL,
    recurrence   VARCHAR(20)    NULL,
    start_date   DATE           NULL,
    is_template  BOOLEAN        NOT NULL DEFAULT FALSE,
    template_id  BIGINT         NULL,
    created_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS bank_accounts (
    id              BIGINT        NOT NULL AUTO_INCREMENT,
    owner_name      VARCHAR(50)   NOT NULL,
    account_name    VARCHAR(100)  NOT NULL,
    group_id        BIGINT        NOT NULL,
    opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (group_id) REFERENCES `groups`(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- Ledger of savings deposits/withdrawals/transfers per account. Multiple entries
-- per account/month are allowed; transfers are two linked rows (see linked_entry_id)
-- excluded from "this month's savings" since they move money, not save it.
-- asset_type (CASH/INVESTMENT) lets one account hold both — the account itself
-- has no type, only its entries do, so balances can be broken down by type.
CREATE TABLE IF NOT EXISTS savings_entries (
    id              BIGINT        NOT NULL AUTO_INCREMENT,
    bank_account_id BIGINT        NOT NULL,
    group_id        BIGINT        NOT NULL,
    month           INT           NOT NULL,
    year            INT           NOT NULL,
    amount          DECIMAL(12,2) NOT NULL,
    asset_type      VARCHAR(20)   NOT NULL DEFAULT 'CASH',
    is_transfer     BOOLEAN       NOT NULL DEFAULT FALSE,
    is_opening_balance BOOLEAN    NOT NULL DEFAULT FALSE,
    linked_entry_id BIGINT        NULL,
    note            VARCHAR(255)  NULL,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_savings_bank_account FOREIGN KEY (bank_account_id) REFERENCES bank_accounts (id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES `groups`(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- Multiple labels per bank account (many-to-many, mirrors expense_tags)
CREATE TABLE IF NOT EXISTS bank_account_tags (
    bank_account_id BIGINT      NOT NULL,
    tag             VARCHAR(50) NOT NULL,
    PRIMARY KEY (bank_account_id, tag),
    CONSTRAINT fk_bank_account_tags_account FOREIGN KEY (bank_account_id) REFERENCES bank_accounts (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id         BIGINT        NOT NULL AUTO_INCREMENT,
    endpoint   VARCHAR(2000) NOT NULL,
    p256dh     VARCHAR(500)  NOT NULL,
    auth       VARCHAR(200)  NOT NULL,
    created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_endpoint (endpoint(500))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS subcategories (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    category_value VARCHAR(50)  NOT NULL,
    name           VARCHAR(100) NOT NULL,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_subcategory (category_value, name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS join_requests (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    username      VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    group_id      BIGINT       NOT NULL,
    requested_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_jr_username_group (username, group_id),
    FOREIGN KEY (group_id) REFERENCES `groups`(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS group_categories (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    group_id   BIGINT       NOT NULL,
    value      VARCHAR(50)  NOT NULL,
    label      VARCHAR(100) NOT NULL,
    icon       VARCHAR(100) NOT NULL,
    color      VARCHAR(10)  NOT NULL,
    is_income  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_group_category (group_id, value),
    FOREIGN KEY (group_id) REFERENCES `groups`(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS group_subcategories (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    group_id       BIGINT       NOT NULL,
    category_value VARCHAR(50)  NOT NULL,
    name           VARCHAR(100) NOT NULL,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_group_subcategory (group_id, category_value, name),
    FOREIGN KEY (group_id) REFERENCES `groups`(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS sub_categories (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    category_value VARCHAR(50)  NOT NULL,
    name           VARCHAR(100) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_sub_category (category_value, name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS applied_migrations (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    migration_name VARCHAR(100) NOT NULL,
    applied_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_migration_name (migration_name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- Default categories
INSERT IGNORE INTO categories (value, label, icon, color, is_income) VALUES
    ('FOOD',          'Food',          'restaurant',     '#e91e63', FALSE),
    ('TRANSPORT',     'Transport',     'directions_car', '#2196f3', FALSE),
    ('HOUSING',       'Housing',       'home',           '#ff9800', FALSE),
    ('ENTERTAINMENT', 'Entertainment', 'movie',          '#9c27b0', FALSE),
    ('HEALTH',        'Health',        'local_hospital', '#4caf50', FALSE),
    ('SHOPPING',      'Shopping',      'shopping_cart',  '#00bcd4', FALSE),
    ('EDUCATION',     'Education',     'school',         '#ff5722', FALSE),
    ('OTHER',         'Other',         'more_horiz',     '#607d8b', FALSE);

-- Default subcategories (source of truth for group seeding)
INSERT IGNORE INTO sub_categories (category_value, name) VALUES
    ('FOOD', 'Groceries'),
    ('FOOD', 'Restaurants'),
    ('FOOD', 'Coffee & Drinks'),
    ('FOOD', 'Fast Food'),
    ('FOOD', 'Takeout / Delivery'),
    ('TRANSPORT', 'Gas / Fuel'),
    ('TRANSPORT', 'Public Transit'),
    ('TRANSPORT', 'Parking'),
    ('TRANSPORT', 'Car Maintenance'),
    ('TRANSPORT', 'Car Insurance'),
    ('TRANSPORT', 'Rideshare'),
    ('HOUSING', 'Rent / Mortgage'),
    ('HOUSING', 'Electricity'),
    ('HOUSING', 'Water & Gas'),
    ('HOUSING', 'Internet'),
    ('HOUSING', 'Home Insurance'),
    ('HOUSING', 'Maintenance'),
    ('ENTERTAINMENT', 'Streaming Services'),
    ('ENTERTAINMENT', 'Movies & Shows'),
    ('ENTERTAINMENT', 'Games'),
    ('ENTERTAINMENT', 'Events & Concerts'),
    ('ENTERTAINMENT', 'Hobbies'),
    ('HEALTH', 'Doctor / Clinic'),
    ('HEALTH', 'Dentist'),
    ('HEALTH', 'Pharmacy'),
    ('HEALTH', 'Gym & Fitness'),
    ('HEALTH', 'Health Insurance'),
    ('SHOPPING', 'Clothing'),
    ('SHOPPING', 'Electronics'),
    ('SHOPPING', 'Home & Decor'),
    ('SHOPPING', 'Personal Care'),
    ('SHOPPING', 'Gifts'),
    ('EDUCATION', 'Tuition'),
    ('EDUCATION', 'Books & Supplies'),
    ('EDUCATION', 'Online Courses'),
    ('EDUCATION', 'Software & Tools'),
    ('OTHER', 'Miscellaneous');
