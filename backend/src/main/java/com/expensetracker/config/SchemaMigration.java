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
        dropLegacyTables();
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

    // Drop any legacy tables that no longer belong in the schema.
    private void dropLegacyTables() throws SQLException {
        try (Connection conn = dataSource.getConnection();
             Statement stmt  = conn.createStatement()) {
            stmt.execute("DROP TABLE IF EXISTS monthly_salaries");
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
