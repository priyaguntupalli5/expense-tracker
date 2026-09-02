package com.expensetracker.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.*;
import java.util.Random;

/**
 * Runs after schema.sql/data.sql to handle migrations that require conditional
 * logic (which can't be expressed in plain SQL without stored procedures).
 */
@Component
public class SchemaMigration implements ApplicationRunner {

    private final DataSource dataSource;
    private final Random random = new Random();

    public SchemaMigration(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        migrateExistingColumns();
        migrateGroupCodes();
        migrateIncomePaymentDate();
        migrateFixedExpenseColumns();
        migrateExpenseTagsToJoinTable();
        migrateSavingsAccounts();
        backfillOpeningBalanceFlag();
        dropLegacyTables();
        resetGroups1And3ToDefaults();
    }

    // Brings pre-existing bank_accounts/savings_entries tables (created before
    // opening balances and transfers existed) up to the current schema: adds the
    // new columns and drops the old one-entry-per-account-per-month unique key,
    // which otherwise blocks transfers (two rows) and any second entry in a month.
    private void migrateSavingsAccounts() throws SQLException {
        try (Connection conn = dataSource.getConnection()) {
            addColumnIfAbsent(conn, "bank_accounts", "opening_balance", "DECIMAL(12,2) NOT NULL DEFAULT 0");
            // Superseded by savings_entries.asset_type — an account can hold both
            // cash and investment, so the type belongs on the entry, not the account.
            dropColumnIfPresent(conn, "bank_accounts", "account_type");

            addColumnIfAbsent(conn, "savings_entries", "is_transfer", "BOOLEAN NOT NULL DEFAULT FALSE");
            addColumnIfAbsent(conn, "savings_entries", "linked_entry_id", "BIGINT NULL");
            addColumnIfAbsent(conn, "savings_entries", "note", "VARCHAR(255) NULL");
            addColumnIfAbsent(conn, "savings_entries", "asset_type", "VARCHAR(20) NOT NULL DEFAULT 'CASH'");
            addColumnIfAbsent(conn, "savings_entries", "is_opening_balance", "BOOLEAN NOT NULL DEFAULT FALSE");

            if (indexExists(conn, "savings_entries", "uk_savings_account_month_year")) {
                // The unique key backs the bank_account_id FK, so a replacement index
                // must be added in the same statement or MySQL refuses the drop.
                try (Statement stmt = conn.createStatement()) {
                    stmt.execute("ALTER TABLE savings_entries " +
                        "ADD INDEX idx_savings_bank_account (bank_account_id), " +
                        "DROP INDEX uk_savings_account_month_year");
                }
            }
        }
    }

    // One-time: entries logged before is_opening_balance existed were still
    // tagged with a note of 'Opening balance', so backfill the flag from that
    // rather than leaving pre-existing accounts' "this month" totals inflated.
    private void backfillOpeningBalanceFlag() throws SQLException {
        try (Connection conn = dataSource.getConnection()) {
            if (migrationApplied(conn, "backfill_opening_balance_flag")) return;

            try (Statement stmt = conn.createStatement()) {
                stmt.execute("UPDATE savings_entries SET is_opening_balance = TRUE WHERE note = 'Opening balance'");
                stmt.execute(
                    "INSERT IGNORE INTO applied_migrations (migration_name) " +
                    "VALUES ('backfill_opening_balance_flag')");
            }
        }
    }

    private void migrateGroupCodes() throws SQLException {
        try (Connection conn = dataSource.getConnection()) {
            // Backfill any groups that have no code yet
            try (Statement sel = conn.createStatement();
                 ResultSet rs = sel.executeQuery("SELECT id FROM `groups` WHERE group_code IS NULL")) {
                while (rs.next()) {
                    long id = rs.getLong("id");
                    String code = generateUniqueCode(conn);
                    try (PreparedStatement ps = conn.prepareStatement(
                            "UPDATE `groups` SET group_code = ? WHERE id = ?")) {
                        ps.setString(1, code);
                        ps.setLong(2, id);
                        ps.executeUpdate();
                    }
                }
            }

            // Add unique key if not already present
            if (!indexExists(conn, "groups", "uk_group_code")) {
                try (Statement stmt = conn.createStatement()) {
                    stmt.execute("ALTER TABLE `groups` ADD UNIQUE KEY uk_group_code (group_code)");
                }
            }
        }
    }

    /**
     * Consolidates income_entries date storage: removes month, year, payment_day,
     * payment_month columns and ensures payment_date is set on all non-template rows.
     */
    private void migrateIncomePaymentDate() throws SQLException {
        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData meta = conn.getMetaData();

            // Backfill payment_date from month/year before dropping those columns
            if (columnExists(meta, conn, "income_entries", "month")) {
                try (PreparedStatement ps = conn.prepareStatement(
                        "UPDATE income_entries " +
                        "SET payment_date = STR_TO_DATE(CONCAT(`year`, '-', LPAD(`month`, 2, '0'), '-01'), '%Y-%m-%d') " +
                        "WHERE payment_date IS NULL AND is_template = false AND template_id IS NULL")) {
                    ps.executeUpdate();
                }
                try (Statement stmt = conn.createStatement()) {
                    stmt.execute("ALTER TABLE income_entries DROP COLUMN `month`");
                    stmt.execute("ALTER TABLE income_entries DROP COLUMN `year`");
                }
            }

            if (columnExists(meta, conn, "income_entries", "payment_day")) {
                try (Statement stmt = conn.createStatement()) {
                    stmt.execute("ALTER TABLE income_entries DROP COLUMN payment_day");
                }
            }

            if (columnExists(meta, conn, "income_entries", "payment_month")) {
                try (Statement stmt = conn.createStatement()) {
                    stmt.execute("ALTER TABLE income_entries DROP COLUMN payment_month");
                }
            }
        }
    }

    private void migrateFixedExpenseColumns() throws SQLException {
        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData meta = conn.getMetaData();
            if (columnExists(meta, conn, "fixed_expenses", "payment_day")) {
                try (Statement stmt = conn.createStatement()) {
                    stmt.execute("ALTER TABLE fixed_expenses DROP COLUMN payment_day");
                }
            }
            if (columnExists(meta, conn, "fixed_expenses", "payment_month")) {
                try (Statement stmt = conn.createStatement()) {
                    stmt.execute("ALTER TABLE fixed_expenses DROP COLUMN payment_month");
                }
            }
        }
    }

    // Moves single-value expenses.tag data into the expense_tags join table (which
    // supports multiple labels per expense), then drops the now-unused column.
    private void migrateExpenseTagsToJoinTable() throws SQLException {
        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData meta = conn.getMetaData();
            if (!columnExists(meta, conn, "expenses", "tag")) return;

            try (PreparedStatement ps = conn.prepareStatement(
                    "INSERT IGNORE INTO expense_tags (expense_id, tag) " +
                    "SELECT id, tag FROM expenses WHERE tag IS NOT NULL AND tag <> ''")) {
                ps.executeUpdate();
            }

            try (Statement stmt = conn.createStatement()) {
                stmt.execute("ALTER TABLE expenses DROP COLUMN tag");
            }
        }
    }

    // Adds any columns that are missing from existing databases (local dev upgrade path).
    // For fresh databases all columns are already included in the CREATE TABLE definitions.
    private void migrateExistingColumns() throws SQLException {
        try (Connection conn = dataSource.getConnection()) {
            // groups
            addColumnIfAbsent(conn, "groups", "group_code", "VARCHAR(6) NULL");
            addColumnIfAbsent(conn, "groups", "currency",   "VARCHAR(10) NOT NULL DEFAULT 'CAD'");
            addColumnIfAbsent(conn, "groups", "created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
            addColumnIfAbsent(conn, "groups", "updated_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
            // users
            addColumnIfAbsent(conn, "users", "is_admin",   "BOOLEAN NOT NULL DEFAULT FALSE");
            addColumnIfAbsent(conn, "users", "created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
            addColumnIfAbsent(conn, "users", "updated_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
            // categories
            addColumnIfAbsent(conn, "categories", "is_income",  "BOOLEAN NOT NULL DEFAULT FALSE");
            addColumnIfAbsent(conn, "categories", "created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
            addColumnIfAbsent(conn, "categories", "updated_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
            // expenses
            addColumnIfAbsent(conn, "expenses", "subcategory",     "VARCHAR(100) NULL");
            addColumnIfAbsent(conn, "expenses", "image_data",      "MEDIUMTEXT NULL");
            addColumnIfAbsent(conn, "expenses", "group_id",        "BIGINT NULL");
            addColumnIfAbsent(conn, "expenses", "source_fixed_id", "BIGINT NULL");
            addColumnIfAbsent(conn, "expenses", "created_at",      "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
            addColumnIfAbsent(conn, "expenses", "updated_at",      "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
            // fixed_expenses
            addColumnIfAbsent(conn, "fixed_expenses", "subcategory", "VARCHAR(100) NULL");
            addColumnIfAbsent(conn, "fixed_expenses", "group_id",    "BIGINT NULL");
            addColumnIfAbsent(conn, "fixed_expenses", "recurrence",  "VARCHAR(20) NOT NULL DEFAULT 'MONTHLY'");
            addColumnIfAbsent(conn, "fixed_expenses", "start_date",  "DATE NULL");
            addColumnIfAbsent(conn, "fixed_expenses", "end_date",    "DATE NULL");
            addColumnIfAbsent(conn, "fixed_expenses", "created_at",  "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
            addColumnIfAbsent(conn, "fixed_expenses", "updated_at",  "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
            // income_entries
            addColumnIfAbsent(conn, "income_entries", "recurrence",   "VARCHAR(20) NULL");
            addColumnIfAbsent(conn, "income_entries", "start_date",   "DATE NULL");
            addColumnIfAbsent(conn, "income_entries", "is_template",  "BOOLEAN NOT NULL DEFAULT FALSE");
            addColumnIfAbsent(conn, "income_entries", "template_id",  "BIGINT NULL");
            addColumnIfAbsent(conn, "income_entries", "payment_date", "DATE NULL");
            addColumnIfAbsent(conn, "income_entries", "created_at",   "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
            addColumnIfAbsent(conn, "income_entries", "updated_at",   "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
            // push_subscriptions
            addColumnIfAbsent(conn, "push_subscriptions", "created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
            addColumnIfAbsent(conn, "push_subscriptions", "updated_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
            // subcategories
            addColumnIfAbsent(conn, "subcategories", "created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
            addColumnIfAbsent(conn, "subcategories", "updated_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
            // join_requests
            addColumnIfAbsent(conn, "join_requests", "updated_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
            // group_categories
            addColumnIfAbsent(conn, "group_categories", "created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
            addColumnIfAbsent(conn, "group_categories", "updated_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
            // group_subcategories
            addColumnIfAbsent(conn, "group_subcategories", "created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
            addColumnIfAbsent(conn, "group_subcategories", "updated_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        }
    }

    private void addColumnIfAbsent(Connection conn, String table, String column, String definition) throws SQLException {
        DatabaseMetaData meta = conn.getMetaData();
        if (!columnExists(meta, conn, table, column)) {
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("ALTER TABLE `" + table + "` ADD COLUMN `" + column + "` " + definition);
            }
        }
    }

    private void dropColumnIfPresent(Connection conn, String table, String column) throws SQLException {
        DatabaseMetaData meta = conn.getMetaData();
        if (columnExists(meta, conn, table, column)) {
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("ALTER TABLE `" + table + "` DROP COLUMN `" + column + "`");
            }
        }
    }

    // Drop any legacy tables that no longer belong in the schema.
    private void dropLegacyTables() throws SQLException {
        try (Connection conn = dataSource.getConnection();
             Statement stmt  = conn.createStatement()) {
            stmt.execute("DROP TABLE IF EXISTS monthly_salaries");
        }
    }

    // One-time reset: clear group 1 and 3 category data so the seeder
    // re-populates them from the standard defaults (not group 2's custom data).
    private void resetGroups1And3ToDefaults() throws SQLException {
        try (Connection conn = dataSource.getConnection()) {
            if (migrationApplied(conn, "reset_groups_1_3_to_defaults")) return;

            try (Statement stmt = conn.createStatement()) {
                stmt.execute("DELETE FROM group_subcategories WHERE group_id IN (1, 3)");
                stmt.execute("DELETE FROM group_categories WHERE group_id IN (1, 3)");
                stmt.execute(
                    "INSERT IGNORE INTO applied_migrations (migration_name) " +
                    "VALUES ('reset_groups_1_3_to_defaults')");
            }
        }
    }

    private boolean migrationApplied(Connection conn, String name) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT 1 FROM applied_migrations WHERE migration_name = ?")) {
            ps.setString(1, name);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        } catch (SQLException e) {
            return false; // table doesn't exist yet
        }
    }

    private String generateUniqueCode(Connection conn) throws SQLException {
        String code;
        do {
            code = String.format("%06d", random.nextInt(1_000_000));
        } while (codeExists(conn, code));
        return code;
    }

    private boolean codeExists(Connection conn, String code) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT 1 FROM `groups` WHERE group_code = ?")) {
            ps.setString(1, code);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private boolean columnExists(DatabaseMetaData meta, Connection conn, String table, String column) throws SQLException {
        try (ResultSet rs = meta.getColumns(conn.getCatalog(), null, table, column)) {
            return rs.next();
        }
    }

    private boolean tableExists(DatabaseMetaData meta, Connection conn, String table) throws SQLException {
        try (ResultSet rs = meta.getTables(conn.getCatalog(), null, table, null)) {
            return rs.next();
        }
    }

    private boolean indexExists(Connection conn, String table, String indexName) throws SQLException {
        DatabaseMetaData meta = conn.getMetaData();
        try (ResultSet rs = meta.getIndexInfo(conn.getCatalog(), null, table, false, false)) {
            while (rs.next()) {
                if (indexName.equals(rs.getString("INDEX_NAME"))) return true;
            }
        }
        return false;
    }
}
