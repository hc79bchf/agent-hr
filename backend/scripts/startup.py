"""Startup script to reset database and run migrations."""
import os
import sys
from sqlalchemy import create_engine, text

# Get database URL
database_url = os.getenv("DATABASE_URL")
if not database_url:
    print("DATABASE_URL not set, skipping database reset")
    sys.exit(0)

# Check if we should reset (only in dev)
should_reset = os.getenv("RESET_DB", "false").lower() == "true"

if should_reset:
    print("Resetting database...")
    engine = create_engine(database_url)
    with engine.connect() as conn:
        # Drop all types (enums) first
        conn.execute(text("""
            DO $$ DECLARE
                r RECORD;
            BEGIN
                FOR r IN (SELECT typname FROM pg_type WHERE typtype = 'e' AND typnamespace = 'public'::regnamespace) LOOP
                    EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
                END LOOP;
            END $$;
        """))
        # Drop and recreate schema
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
        conn.execute(text("GRANT ALL ON SCHEMA public TO PUBLIC"))
        conn.commit()
    print("Database reset complete")
else:
    print("Skipping database reset (set RESET_DB=true to reset)")
