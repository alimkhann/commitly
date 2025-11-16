#!/usr/bin/env python3
"""Manually add missing columns to generated_roadmaps table."""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from app.core.config import settings

def main():
    print("=" * 70)
    print("ADDING MISSING COLUMNS TO generated_roadmaps")
    print("=" * 70)
    
    engine = create_engine(str(settings.database_url))
    
    # SQL statements to add missing columns
    column_additions = [
        "ALTER TABLE generated_roadmaps ADD COLUMN IF NOT EXISTS primary_language VARCHAR(64);",
        "ALTER TABLE generated_roadmaps ADD COLUMN IF NOT EXISTS languages JSON;",
        "ALTER TABLE generated_roadmaps ADD COLUMN IF NOT EXISTS topics JSON;",
        "ALTER TABLE generated_roadmaps ADD COLUMN IF NOT EXISTS difficulty VARCHAR(32);",
        "ALTER TABLE generated_roadmaps ADD COLUMN IF NOT EXISTS star_count INTEGER DEFAULT 0;",
        "ALTER TABLE generated_roadmaps ADD COLUMN IF NOT EXISTS fork_count INTEGER DEFAULT 0;",
        "ALTER TABLE generated_roadmaps ADD COLUMN IF NOT EXISTS last_pushed_at TIMESTAMP;",
        "ALTER TABLE generated_roadmaps ADD COLUMN IF NOT EXISTS license VARCHAR(128);",
        "ALTER TABLE generated_roadmaps ADD COLUMN IF NOT EXISTS contributor_count INTEGER DEFAULT 0;",
        "ALTER TABLE generated_roadmaps ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;",
        "ALTER TABLE generated_roadmaps ADD COLUMN IF NOT EXISTS sync_count INTEGER DEFAULT 0;",
        "ALTER TABLE generated_roadmaps ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;",
        "ALTER TABLE generated_roadmaps ADD COLUMN IF NOT EXISTS rating_sum INTEGER DEFAULT 0;",
    ]
    
    with engine.begin() as conn:
        print("\nAdding columns...")
        for i, sql in enumerate(column_additions, 1):
            try:
                print(f"  {i}. {sql[:80]}...")
                conn.execute(text(sql))
                print(f"     ✅ Success")
            except Exception as e:
                print(f"     ⚠️  Warning: {e}")
                # Continue anyway - column might already exist
    
    print("\n" + "=" * 70)
    print("✅ Column addition complete!")
    print("\nNow verifying columns exist...")
    
    # Verify columns were added
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'generated_roadmaps'
            AND column_name IN (
                'primary_language', 'languages', 'topics', 'difficulty',
                'star_count', 'fork_count', 'last_pushed_at', 'license',
                'contributor_count', 'view_count', 'sync_count',
                'rating_count', 'rating_sum'
            )
            ORDER BY column_name
        """))
        
        found_columns = [row[0] for row in result.fetchall()]
        
        expected = [
            'contributor_count', 'difficulty', 'fork_count', 'languages',
            'last_pushed_at', 'license', 'primary_language', 'rating_count',
            'rating_sum', 'star_count', 'sync_count', 'topics', 'view_count'
        ]
        
        print(f"\nFound {len(found_columns)}/{len(expected)} expected columns:")
        for col in sorted(found_columns):
            print(f"  ✅ {col}")
        
        missing = set(expected) - set(found_columns)
        if missing:
            print(f"\n❌ Still missing: {', '.join(sorted(missing))}")
            sys.exit(1)
        else:
            print("\n🎉 All columns present!")

if __name__ == "__main__":
    main()
