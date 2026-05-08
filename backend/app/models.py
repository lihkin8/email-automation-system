# app/models.py
import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Enum
from sqlalchemy.orm import relationship, declarative_base
import enum
from sqlalchemy.dialects.postgresql import ENUM, JSONB
import pytz

Base = declarative_base()

# Get PST timezone
pst = pytz.timezone('America/Los_Angeles')

def get_pst_time():
    # Convert to PST and remove timezone info before storing
    return datetime.datetime.now(pst).replace(tzinfo=None)


class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, autoincrement=True)
    google_id = Column(String(255), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    avatar_url = Column(String(512))
    gmail_refresh_token = Column(Text)  # Fernet-encrypted at rest
    resume_url = Column(String(512))
    follow_up_days = Column(Integer, default=3)
    created_at = Column(DateTime, default=get_pst_time)

class EmailType(str, enum.Enum):
    MAIN = "MAIN"
    FOLLOW_UP = "FOLLOW_UP"

class TemplateType(str, enum.Enum):
    MAIN = "MAIN"
    FOLLOW_UP = "FOLLOW_UP"

class EmailStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"
    
class CampaignStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    RUNNING = "RUNNING"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"

class ContactList(Base):
    __tablename__ = 'contact_lists'
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    name = Column(String(255), nullable=False)
    source = Column(String(50), nullable=False)  # 'TEXT_FILE' | 'APOLLO'
    created_at = Column(DateTime, default=get_pst_time)

    recruiters = relationship("Recruiter", back_populates="contact_list")


class Recruiter(Base):
    __tablename__ = 'recruiters'
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    contact_list_id = Column(Integer, ForeignKey('contact_lists.id'), nullable=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    company = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=get_pst_time)

    contact_list = relationship("ContactList", back_populates="recruiters")
    emails = relationship("Email", back_populates="recruiter")

class Email(Base):
    __tablename__ = 'emails'
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    campaign_id = Column(Integer, ForeignKey('campaigns.id'), nullable=True)
    recruiter_id = Column(Integer, ForeignKey('recruiters.id'), nullable=False)
    email_type = Column(ENUM('MAIN', 'FOLLOW_UP', name='emailtype', create_type=False), nullable=False)
    subject = Column(String(255), nullable=False)
    status = Column(ENUM('PENDING', 'SENT', 'FAILED', name='emailstatus', create_type=False), nullable=False)
    tracking_id = Column(String(255), unique=True)
    created_at = Column(DateTime, default=get_pst_time)
    is_opened = Column(Boolean, default=False)

    # Add these relationship definitions back
    recruiter = relationship("Recruiter", back_populates="emails")
    tracking_events = relationship("EmailTracking", back_populates="email")


class Template(Base):
    __tablename__ = 'templates'
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    name = Column(String(255), nullable=False)
    type = Column(ENUM('MAIN', 'FOLLOW_UP', name='templatetype', create_type=False), nullable=False)
    subject = Column(String(255), nullable=False)
    body_html = Column(Text, nullable=False)
    variables = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=get_pst_time)


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=False)
    contact_list_id = Column(Integer, ForeignKey("contact_lists.id"), nullable=False)
    follow_up_template_id = Column(Integer, ForeignKey("templates.id"), nullable=True)
    follow_up_days = Column(Integer, default=5)
    status = Column(
        ENUM("DRAFT", "RUNNING", "PAUSED", "COMPLETED", name="campaignstatus", create_type=False),
        nullable=False,
        default=CampaignStatus.DRAFT,
    )
    created_at = Column(DateTime, default=get_pst_time)


class EmailTracking(Base):
    __tablename__ = 'email_tracking'
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    email_id = Column(Integer, ForeignKey('emails.id'), nullable=False)
    opened_at = Column(DateTime, default=get_pst_time)
    user_agent = Column(String(512))
    ip_address = Column(String(45))

    email = relationship("Email", back_populates="tracking_events")