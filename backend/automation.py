import asyncio
import logging
import os
import datetime
from app.config import settings
from app.services.email_service import GmailService, EmailService
from scripts.recruiter_parser import RecruiterParser
from app.database import async_session
from app.repositories import RecruiterRepository, EmailRepository
from app.models import Recruiter, Email, EmailType, EmailStatus
import pytz

pst = pytz.timezone('America/Los_Angeles')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def run_email_automation():
    # Ensure sent_emails.csv exists
    sent_emails_path = "data/sent_emails.csv"
    os.makedirs(os.path.dirname(sent_emails_path), exist_ok=True)
    if not os.path.exists(sent_emails_path):
        with open(sent_emails_path, 'w') as f:
            f.write('email\n')  # Create with header

    async with async_session() as session:
        # Initialize repositories
        recruiter_repo = RecruiterRepository(session)
        email_repo = EmailRepository(session)
        
        # Parse recruiters from a text file
        parser = RecruiterParser("data/recruiters.txt")
        recruiters = parser.parse_recruiters()
        
        # Initialize Gmail service and email service
        gmail_service = GmailService(settings.gmail_credentials_path)
        email_service = EmailService(gmail_service)
        
        # Process each recruiter
        for recruiter_data in recruiters:
            try:
                # Check if recruiter exists
                db_recruiter = await recruiter_repo.get_by_email(recruiter_data.email)
                if not db_recruiter:
                    db_recruiter = await recruiter_repo.add(Recruiter(
                        name=recruiter_data.name,
                        email=recruiter_data.email,
                        company=recruiter_data.company
                    ))
                    logger.info(f"Added new recruiter: {db_recruiter.name} from {db_recruiter.company}")

                # Create email record
                 # Create email record
                email = Email(
                    recruiter_id=db_recruiter.id,
                    subject=f"Why I’m a Great Fit for {db_recruiter.company} – USC MSCS May 2025 Grad Student",
                    email_type=EmailType.MAIN,  # Remove .value here
                    status=EmailStatus.PENDING  # Remove .value here
                )
                email = await email_repo.add(email)
                logger.info(f"Created email record for {db_recruiter.email}")

                # Send the email
                resume_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'Nikhil_S_Shastry.pdf')
                resume_path = os.path.join('data', 'Nikhil_S_Shastry.pdf')
                if os.path.exists(resume_path):
                    logger.info(f"Found resume at: {resume_path}")
                    attachments = [os.path.abspath(resume_path)]
                else:
                    logger.error(f"Resume not found at: {resume_path}")
                    attachments = None

                success = await email_service.send_email(
                    to_email=db_recruiter.email,
                    recruiter_name=db_recruiter.name,
                    company_name=db_recruiter.company,
                    subject=email.subject,
                    email_id=email.id,
                    email_type=EmailType.MAIN,
                    attachments=attachments
                )

                # Update email status and record sent email
                if success:
                    await email_repo.update_status(email.id, EmailStatus.SENT)  # Remove .value here
                    with open(sent_emails_path, 'a') as f:
                        f.write(f"{db_recruiter.email}\n")
                    logger.info(f"Successfully sent email to {db_recruiter.email}")
                else:
                    await email_repo.update_status(email.id, EmailStatus.FAILED)  # Remove .value here
                    logger.error(f"Failed to send email to {db_recruiter.email}")
                await asyncio.sleep(2)

            except Exception as e:
                logger.error(f"Error processing recruiter {recruiter_data.email}: {str(e)}")
                continue

async def run_follow_up_automation():
    async with async_session() as session:
        email_repo = EmailRepository(session)
        gmail_service = GmailService(settings.gmail_credentials_path)
        email_service = EmailService(gmail_service)

        # Get all sent emails that haven't been opened after 5 days
        five_days_ago = datetime.datetime.now(pst).replace(tzinfo=None) - datetime.timedelta(days=5)
        emails_to_follow_up = await email_repo.get_unopened_emails(five_days_ago)

        for email in emails_to_follow_up:
            try:
                # Create follow-up email
                follow_up_email = Email(
                    recruiter_id=email.recruiter_id,
                    subject=f"Following up - ML Apprentice Role at {email.recruiter.company}",
                    email_type=EmailType.FOLLOW_UP,  # Remove .value here
                    status=EmailStatus.PENDING       # Remove .value here
                )

                follow_up_email = await email_repo.add(follow_up_email)

                # Send follow-up email
                success = await email_service.send_email(
                    to_email=email.recruiter.email,
                    recruiter_name=email.recruiter.name,
                    company_name=email.recruiter.company,
                    subject=follow_up_email.subject,
                    email_id=follow_up_email.id,
                    email_type=EmailType.FOLLOW_UP
                )

                if success:
                    await email_repo.update_status(follow_up_email.id, EmailStatus.SENT)  # Remove .value here
                    logger.info(f"Sent follow-up email to {email.recruiter.email}")
                else:
                    await email_repo.update_status(follow_up_email.id, EmailStatus.FAILED)  # Remove .value here
                    logger.error(f"Failed to send follow-up email to {email.recruiter.email}")
                await asyncio.sleep(2)

            except Exception as e:
                logger.error(f"Error sending follow-up email to {email.recruiter.email}: {str(e)}")
                continue

# Add this new function
async def run_manual_follow_up():
    sent_emails_path = "data/sent_emails.csv"
    
    async with async_session() as session:
        recruiter_repo = RecruiterRepository(session)
        email_repo = EmailRepository(session)
        gmail_service = GmailService(settings.gmail_credentials_path)
        email_service = EmailService(gmail_service)
        
        # Parse recruiters from the text file
        parser = RecruiterParser("data/follow_up_recruiters.txt")
        recruiters = parser.parse_recruiters()
        
        for recruiter_data in recruiters:
            try:
                # Get recruiter from database or create new one if not exists
                db_recruiter = await recruiter_repo.get_by_email(recruiter_data.email)
                if not db_recruiter:
                    db_recruiter = await recruiter_repo.add(Recruiter(
                        name=recruiter_data.name,
                        email=recruiter_data.email,
                        company=recruiter_data.company
                    ))
                    logger.info(f"Added new recruiter for follow-up: {db_recruiter.name} from {db_recruiter.company}")

                # Rest of the follow-up email logic remains the same
                resume_path = os.path.join('data', 'Nikhil_S_Shastry.pdf')
                if os.path.exists(resume_path):
                    logger.info(f"Found resume at: {resume_path}")
                    attachments = [os.path.abspath(resume_path)]
                else:
                    logger.error(f"Resume not found at: {resume_path}")
                    attachments = None

                follow_up_email = Email(
                    recruiter_id=db_recruiter.id,
                    subject=f"Following up - Software Engineer Role at {db_recruiter.company}",
                    email_type=EmailType.FOLLOW_UP,
                    status=EmailStatus.PENDING
                )
                
                follow_up_email = await email_repo.add(follow_up_email)
                
                # Update send_email call to include attachments
                success = await email_service.send_email(
                    to_email=db_recruiter.email,
                    recruiter_name=db_recruiter.name,
                    company_name=db_recruiter.company,
                    subject=follow_up_email.subject,
                    email_id=follow_up_email.id,
                    email_type=EmailType.FOLLOW_UP,
                    attachments=attachments  # Add attachments parameter
                )

                if success:
                    await email_repo.update_status(follow_up_email.id, EmailStatus.SENT)
                    logger.info(f"Sent follow-up email to {db_recruiter.email}")
                else:
                    await email_repo.update_status(follow_up_email.id, EmailStatus.FAILED)
                    logger.error(f"Failed to send follow-up email to {db_recruiter.email}")
                
                await asyncio.sleep(2)  # Pause between emails

            except Exception as e:
                logger.error(f"Error sending follow-up to {recruiter_data.email}: {str(e)}")
                continue

# Update the main block to include the new function
if __name__ == "__main__":
    # Choose which function to run
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "follow-up":
        asyncio.run(run_manual_follow_up())
    else:
        asyncio.run(run_email_automation())