"""cascade delete campaign emails and tracking

Adds ``ON DELETE CASCADE`` to:
  * ``emails.campaign_id`` -> ``campaigns.id``
  * ``email_tracking.email_id`` -> ``emails.id``

Without these, ``DELETE FROM campaigns WHERE id = X`` raises a foreign-key
violation whenever the campaign has any sent ``emails`` rows (which in turn
have ``email_tracking`` rows). The ``CampaignRepository.delete`` cascades in
application code so this still works on environments that haven't run this
migration; once it has, the database enforces the same invariant directly.

The original ``email_tracking.email_id`` FK was created outside of Alembic
(by the legacy ``Base.metadata.create_all`` bootstrap) so its name varies
across deployments. We look it up via ``pg_constraint`` and drop it before
recreating it with the cascade option.

Revision ID: 0007
Revises: 0006
Create Date: 2026-05-08
"""
from alembic import op


revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # emails.campaign_id -> campaigns.id (named in 0006_add_campaign_id_to_emails)
    op.execute("ALTER TABLE emails DROP CONSTRAINT IF EXISTS fk_emails_campaign_id")
    op.execute(
        "ALTER TABLE emails "
        "ADD CONSTRAINT fk_emails_campaign_id "
        "FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE"
    )

    # email_tracking.email_id -> emails.id (legacy auto-generated name).
    # Discover it from pg_constraint and drop whatever exists, then recreate.
    op.execute(
        """
        DO $$
        DECLARE
            fk_name text;
        BEGIN
            SELECT conname INTO fk_name
            FROM pg_constraint
            WHERE conrelid = 'email_tracking'::regclass
              AND confrelid = 'emails'::regclass
              AND contype = 'f'
            LIMIT 1;
            IF fk_name IS NOT NULL THEN
                EXECUTE format('ALTER TABLE email_tracking DROP CONSTRAINT %I', fk_name);
            END IF;
        END
        $$;
        """
    )
    op.execute(
        "ALTER TABLE email_tracking "
        "ADD CONSTRAINT fk_email_tracking_email_id "
        "FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE email_tracking DROP CONSTRAINT IF EXISTS fk_email_tracking_email_id"
    )
    op.execute(
        "ALTER TABLE email_tracking "
        "ADD CONSTRAINT email_tracking_email_id_fkey "
        "FOREIGN KEY (email_id) REFERENCES emails(id)"
    )

    op.execute("ALTER TABLE emails DROP CONSTRAINT IF EXISTS fk_emails_campaign_id")
    op.execute(
        "ALTER TABLE emails "
        "ADD CONSTRAINT fk_emails_campaign_id "
        "FOREIGN KEY (campaign_id) REFERENCES campaigns(id)"
    )
