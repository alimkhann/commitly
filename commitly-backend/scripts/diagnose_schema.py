#!/usr/bin/env python3
"""Diagnose database schema and migration state."""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text, inspect
from app.core.config import settings

def main():
    print("=" * 70)
    print("DATABASE SCHEMA DIAGNOSTIC")
    print("=" * 70)

    engine = create_engine(str(settings.database_url))

    with engine.connect() as conn:
        # Check alembic version
        print("\n1. Current Alembic Version:")
        result = conn.execute(text("SELECT version_num FROM alembic_version"))
        version = result.fetchone()
        print(f"   Version: {version[0] if version else 'None'}")

        # Check if generated_roadmaps table exists
        print("\n2. Generated Roadmaps Table:")
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'generated_roadmaps'
            )
        """))
        exists = result.fetchone()[0]
        print(f"   Table exists: {exists}")

        if exists:
            # Get all columns
            print("\n3. Current Columns in generated_roadmaps:")
            result = conn.execute(text("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'generated_roadmaps'
                ORDER BY ordinal_position
            """))
            columns = result.fetchall()
            for col_name, data_type, nullable in columns:
                print(f"   - {col_name:30} {data_type:20} (nullable={nullable})")

            # Check for specific missing columns
            print("\n4. Missing Columns Check:")
            expected_columns = [
                'primary_language', 'languages', 'topics', 'difficulty',
                'star_count', 'fork_count', 'last_pushed_at', 'license',
                'contributor_count', 'view_count', 'sync_count',
                'rating_count', 'rating_sum'
            ]

            existing_cols = {col[0] for col in columns}
            missing_cols = [col for col in expected_columns if col not in existing_cols]

            if missing_cols:
                print(f"   ❌ Missing columns: {', '.join(missing_cols)}")
            else:
                print("   ✅ All expected columns present")

        # Check migration history
        print("\n5. Applied Migrations (from alembic_version history):")
        try:
            result = conn.execute(text("""
                SELECT version_num FROM alembic_version
            """))
            for row in result:
                print(f"   - {row[0]}")
        except Exception as e:
            print(f"   Error: {e}")

        print("\n" + "=" * 70)

        # Provide recommendations
        if missing_cols:
            print("\n⚠️  DIAGNOSIS: Columns are missing!")
            print("\nThe migration '20241116_upgrade_roadmaps_and_user_repo_state' appears")
            print("to have been skipped. The database revision is at 'add_view_tracker'")
            print("which comes AFTER the migration that should add these columns.")
            print("\nRECOMMENDATION:")
            print("We need to manually add these columns using SQL.")

if __name__ == "__main__":
    main()
