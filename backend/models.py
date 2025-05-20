from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class Player(Base):
    __tablename__ = 'players'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    number = Column(Integer, nullable=False)
    age_group = Column(String, nullable=False)
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

# Pydantic schemas for API
class PlayerSchema(BaseModel):
    id: int
    name: str
    number: int
    age_group: str
    photo_url: str | None = None
    created_at: datetime
    class Config:
        orm_mode = True

class DrillResultSchema(BaseModel):
    id: int
    player_id: int
    type: str
    value: float
    created_at: datetime
    class Config:
        orm_mode = True

class EventSchema(BaseModel):
    id: int
    name: str
    date: datetime
    created_at: datetime
    class Config:
        orm_mode = True 