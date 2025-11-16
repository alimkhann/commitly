#!/usr/bin/env python3
"""
Run database migrations.
This script can be run manually or as a pre-deploy command.
"""
import sys
from pathlib import Path
from alembic.config import Config
from alembic import command

# Add project root to sys.path
project_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(project_root))

def run_migrations():
    """Run Alembic migrations to head."""
    alembic_ini = project_root / "alembic.ini"
    
    if not alembic_ini.exists():
        print(f"ERROR: alembic.ini not found at {alembic_ini}")
        sys.exit(1)
    
    print(f"Found alembic.ini at {alembic_ini}")
    print("Running migrations...")
    
    try:
        alembic_cfg = Config(str(alembic_ini))
        
        # Show current revision
        print("Current database revision:")
        command.current(alembic_cfg, verbose=True)
        
        # Run migrations
        print("\nUpgrading to head...")
        command.upgrade(alembic_cfg, "head")
        
        # Show final revision
        print("\nFinal database revision:")
        command.current(alembic_cfg, verbose=True)
        
        print("\n✅ Migrations completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    run_migrations()
