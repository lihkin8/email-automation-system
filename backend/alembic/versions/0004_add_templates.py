"""add templates table

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-04

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the templatetype ENUM before the table that uses it
    op.execute("CREATE TYPE templatetype AS ENUM ('MAIN', 'FOLLOW_UP')")

    op.create_table(
        'templates',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('type', postgresql.ENUM('MAIN', 'FOLLOW_UP', name='templatetype', create_type=False), nullable=False),
        sa.Column('subject', sa.String(length=255), nullable=False),
        sa.Column('body_html', sa.Text(), nullable=False),
        sa.Column('variables', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_templates_user_id'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('templates')
    op.execute("DROP TYPE templatetype")
