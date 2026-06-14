-- Expense Tracker — MySQL Schema
-- Run once to create the database and tables manually (optional).
-- If using the Spring Boot app with ddl-auto=update, tables are created automatically.

CREATE DATABASE IF NOT EXISTS expense_tracker
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE expense_tracker;

-- Actual (variable) expenses entered by the user each month
CREATE TABLE IF NOT EXISTS expenses (
    id       BIGINT NOT NULL AUTO_INCREMENT,
    title    VARCHAR(100) NOT NULL,
    amount   DECIMAL(12, 2) NOT NULL,
    category VARCHAR(50)  NOT NULL,
    date     DATE         NOT NULL,
    notes    VARCHAR(255),
    PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- Fixed recurring monthly expenses (rent, EMI, utilities, etc.)
CREATE TABLE IF NOT EXISTS fixed_expenses (
    id       BIGINT NOT NULL AUTO_INCREMENT,
    title    VARCHAR(100) NOT NULL,
    amount   DECIMAL(12, 2) NOT NULL,
    category VARCHAR(50)  NOT NULL,
    notes    VARCHAR(255),
    PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- Monthly salaries for Priya and Vamsi, stored per month/year
CREATE TABLE IF NOT EXISTS monthly_salaries (
    id            BIGINT NOT NULL AUTO_INCREMENT,
    month         INT    NOT NULL,
    year          INT    NOT NULL,
    priya_salary  DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    vamsi_salary  DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    PRIMARY KEY (id),
    UNIQUE KEY uk_month_year (month, year)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
