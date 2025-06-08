# Firestore is now used for all data storage.
# See the approved Firestore schema for collections and document structure.

from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Table, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
import uuid

Base = declarative_base()

class Player(Base):
    __tablename__ = 'players'
    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(PG_UUID(as_uuid=True), default=uuid.uuid4, unique=True, nullable=False)
    name = Column(String, nullable=False)
    number = Column(Integer, nullable=True)
    age_group = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class DrillResult(Base):
    __tablename__ = 'drill_results'
    id = Column(Integer, primary_key=True, index=True)
    player_id = Column(Integer, ForeignKey('players.id'), nullable=False)
    type = Column(String, nullable=False)
    value = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Event(Base):
    __tablename__ = 'events'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    date = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    league_id = Column(String, ForeignKey('leagues.id'), nullable=True)
    league = relationship('League', back_populates='events')

class User(Base):
    __tablename__ = 'users'
    id = Column(String, primary_key=True, index=True)  # Firebase UID
    email = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    leagues = relationship('UserLeague', back_populates='user')

class League(Base):
    __tablename__ = 'leagues'
    id = Column(String, primary_key=True, index=True)  # Short join code
    name = Column(String, nullable=False)
    created_by_user_id = Column(String, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    users = relationship('UserLeague', back_populates='league')
    events = relationship('Event', back_populates='league')

class RoleEnum(enum.Enum):
    organizer = 'organizer'
    coach = 'coach'

class UserLeague(Base):
    __tablename__ = 'user_leagues'
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey('users.id'), nullable=False)
    league_id = Column(String, ForeignKey('leagues.id'), nullable=False)
    role = Column(Enum(RoleEnum), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)
    user = relationship('User', back_populates='leagues')
    league = relationship('League', back_populates='users')

# Pydantic schemas for API
class PlayerSchema(BaseModel):
    id: int
    uuid: uuid.UUID
    name: str
    number: int | None = None
    age_group: str | None = None
    photo_url: str | None = None
    created_at: datetime
    class Config:
        from_attributes = True

class DrillResultSchema(BaseModel):
    id: int
    player_id: int
    type: str
    value: float
    created_at: datetime
    class Config:
        from_attributes = True

class EventSchema(BaseModel):
    id: int
    name: str
    date: datetime
    created_at: datetime
    class Config:
        from_attributes = True 