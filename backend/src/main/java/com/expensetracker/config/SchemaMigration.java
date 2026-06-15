package com.expensetracker.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.math.BigDecimal;
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
        migrateIncomeFromSalaries();
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

    // Migrate existing monthly_salaries rows into income_entries (SALARY source type).
    // Only processes rows that have no corresponding income_entries yet for that group/month/year.
    private void migrateIncomeFromSalaries() throws SQLException {
        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData meta = conn.getMetaData();

            // Bail out if either table doesn't exist
            if (!tableExists(meta, conn, "monthly_salaries") || !tableExists(meta, conn, "income_entries")) {
                return;
            }

            String query =
                "SELECT ms.group_id, ms.month, ms.year, ms.priya_salary, ms.vamsi_salary " +
                "FROM monthly_salaries ms " +
                "WHERE ms.group_id IS NOT NULL " +
                "  AND (ms.priya_salary > 0 OR ms.vamsi_salary > 0) " +
                "  AND NOT EXISTS (" +
                "    SELECT 1 FROM income_entries ie " +
                "    WHERE ie.group_id = ms.group_id AND ie.month = ms.month AND ie.year = ms.year" +
                "  )";

            try (Statement stmt = conn.createStatement(); ResultSet rs = stmt.executeQuery(query)) {
                while (rs.next()) {
                    long groupId   = rs.getLong("group_id");
                    int  month     = rs.getInt("month");
                    int  year      = rs.getInt("year");
                    BigDecimal p   = rs.getBigDecimal("priya_salary");
                    BigDecimal v   = rs.getBigDecimal("vamsi_salary");

                    if (p != null && p.compareTo(BigDecimal.ZERO) > 0) {
                        insertIncomeEntry(conn, "Salary", p, "SALARY", month, year, groupId);
                    }
                    if (v != null && v.compareTo(BigDecimal.ZERO) > 0) {
                        insertIncomeEntry(conn, "Salary", v, "SALARY", month, year, groupId);
                    }
                }
            }
        }
    }

    private void insertIncomeEntry(Connection conn, String title, BigDecimal amount,
                                   String sourceType, int month, int year, long groupId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO income_entries (title, amount, source_type, month, year, group_id) " +
                "VALUES (?, ?, ?, ?, ?, ?)")) {
            ps.setString(1, title);
            ps.setBigDecimal(2, amount);
            ps.setString(3, sourceType);
            ps.setInt(4, month);
            ps.setInt(5, year);
            ps.setLong(6, groupId);
            ps.executeUpdate();
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
