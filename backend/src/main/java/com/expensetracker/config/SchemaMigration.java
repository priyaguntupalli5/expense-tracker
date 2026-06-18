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
        migrateGroupCodes();
        migrateIncomePaymentDate();
        migrateFixedExpenseColumns();
        dropLegacyTables();
        resetGroups1And3ToDefaults();
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
