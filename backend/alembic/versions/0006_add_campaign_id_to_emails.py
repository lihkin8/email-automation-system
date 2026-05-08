"""add campaign_id to emails

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-08

"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("emails", sa.Column("campaign_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_emails_campaign_id",
        "emails",
        "campaigns",
        ["campaign_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_emails_campaign_id", "emails", type_="foreignkey")
    op.drop_column("emails", "campaign_id")

