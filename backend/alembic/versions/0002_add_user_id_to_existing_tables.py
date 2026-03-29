"""add user_id to existing tables

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-29

"""
from alembic import op
import sqlalchemy as sa

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # recruiters: drop old global unique on email, add user_id FK, add composite unique
    op.add_column('recruiters', sa.Column('user_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_recruiters_user_id', 'recruiters', 'users', ['user_id'], ['id'])
    op.drop_constraint('recruiters_email_key', 'recruiters', type_='unique')
    op.create_unique_constraint('uq_recruiters_email_user', 'recruiters', ['email', 'user_id'])

    # emails: add user_id FK
    op.add_column('emails', sa.Column('user_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_emails_user_id', 'emails', 'users', ['user_id'], ['id'])

    # email_tracking: add user_id FK
    op.add_column('email_tracking', sa.Column('user_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_email_tracking_user_id', 'email_tracking', 'users', ['user_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_email_tracking_user_id', 'email_tracking', type_='foreignkey')
    op.drop_column('email_tracking', 'user_id')

    op.drop_constraint('fk_emails_user_id', 'emails', type_='foreignkey')
    op.drop_column('emails', 'user_id')

    op.drop_constraint('uq_recruiters_email_user', 'recruiters', type_='unique')
    op.drop_constraint('fk_recruiters_user_id', 'recruiters', type_='foreignkey')
    op.drop_column('recruiters', 'user_id')
    op.create_unique_constraint('recruiters_email_key', 'recruiters', ['email'])
