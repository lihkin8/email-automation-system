"""add sent_at and campaign status index

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-08
"""
from alembic import op
import sqlalchemy as sa


revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("emails", sa.Column("sent_at", sa.DateTime(), nullable=True))
    op.create_index(
        "idx_emails_campaign_status",
        "emails",
        ["campaign_id", "email_type", "status"],
    )


def downgrade() -> None:
    op.drop_index("idx_emails_campaign_status", table_name="emails")
    op.drop_column("emails", "sent_at")
