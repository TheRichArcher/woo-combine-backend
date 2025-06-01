# Firestore is now used for all database operations. See backend/firestore_client.py for the client setup.

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://woo_combine_db_v4_user:6E1WLpvpLnmGsE0DruxCfI8MAbK2TgJF@dpg-d0nte2buibrs73c569eg-a.oregon-postgres.render.com/woo_combine_db_v4')

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine) 