"""add campaigns table

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-08

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the campaignstatus ENUM before the table that uses it
    op.execute("CREATE TYPE campaignstatus AS ENUM ('DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED')")

    op.create_table(
        "campaigns",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("template_id", sa.Integer(), nullable=False),
        sa.Column("contact_list_id", sa.Integer(), nullable=False),
        sa.Column("follow_up_template_id", sa.Integer(), nullable=True),
        sa.Column("follow_up_days", sa.Integer(), nullable=False, server_default="5"),
        sa.Column(
            "status",
            postgresql.ENUM(
                "DRAFT",
                "RUNNING",
                "PAUSED",
                "COMPLETED",
                name="campaignstatus",
                create_type=False,
            ),
            nullable=False,
            server_default="DRAFT",
        ),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_campaigns_user_id"),
        sa.ForeignKeyConstraint(["template_id"], ["templates.id"], name="fk_campaigns_template_id"),
        sa.ForeignKeyConstraint(["contact_list_id"], ["contact_lists.id"], name="fk_campaigns_contact_list_id"),
        sa.ForeignKeyConstraint(
            ["follow_up_template_id"],
            ["templates.id"],
            name="fk_campaigns_follow_up_template_id",
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("campaigns")
    op.execute("DROP TYPE campaignstatus")

