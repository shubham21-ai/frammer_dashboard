-- Migration: Add exec_ddl helper for DDL statements (ALTER TABLE, etc.)
-- exec_sql wraps queries as SELECT * FROM (<sql>) t which rejects DDL.
-- exec_ddl executes DDL directly via EXECUTE without any wrapping.
--
-- Run in Supabase SQL Editor or: psql -U postgres -d your_db -f lib/migrations/002_exec_ddl.sql

CREATE OR REPLACE FUNCTION exec_ddl(sql text)
RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
