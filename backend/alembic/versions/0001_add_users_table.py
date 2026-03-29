"""add users table

Revision ID: 0001
Revises:
Create Date: 2026-03-28

"""
from alembic import op
import sqlalchemy as sa

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('google_id', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('avatar_url', sa.String(length=512), nullable=True),
        sa.Column('gmail_refresh_token', sa.Text(), nullable=True),
        sa.Column('resume_url', sa.String(length=512), nullable=True),
        sa.Column('follow_up_days', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('google_id'),
        sa.UniqueConstraint('email'),
    )


def downgrade() -> None:
    op.drop_table('users')
