"""add contact_lists table and contact_list_id to recruiters

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-04

"""
from alembic import op
import sqlalchemy as sa

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create contact_lists table
    op.create_table(
        'contact_lists',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('source', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_contact_lists_user_id'),
        sa.PrimaryKeyConstraint('id'),
    )

    # Add contact_list_id to recruiters (nullable — existing rows have no list)
    op.add_column('recruiters', sa.Column('contact_list_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_recruiters_contact_list_id', 'recruiters', 'contact_lists',
        ['contact_list_id'], ['id'],
    )

    # Drop composite unique (email, user_id) — same email can now appear in
    # multiple contact lists for the same user
    op.drop_constraint('uq_recruiters_email_user', 'recruiters', type_='unique')


def downgrade() -> None:
    op.create_unique_constraint('uq_recruiters_email_user', 'recruiters', ['email', 'user_id'])
    op.drop_constraint('fk_recruiters_contact_list_id', 'recruiters', type_='foreignkey')
    op.drop_column('recruiters', 'contact_list_id')
    op.drop_table('contact_lists')
