from sqlalchemy import create_engine, text
import os

engine = create_engine(os.environ["DATABASE_URL"])
with engine.connect() as conn:
    conn.execute(text("ALTER TABLE events ADD COLUMN IF NOT EXISTS league_id VARCHAR;"))
print("league_id column added (if it was missing).") 