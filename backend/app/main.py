import os
import pandas as pd
from dotenv import load_dotenv
from recruiter_parser import RecruiterParser
from template_manager import EmailTemplate
from email_service import GmailService

class EmailAutomation:
    def __init__(self):
       # Update paths to be relative to the src directory
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.sent_emails_file = os.path.join(base_dir, 'data', 'sent_emails.csv')
        self.recruiters_file = os.path.join(base_dir, 'data', 'recruiters.txt')
        self.credentials_path = os.path.join(base_dir, 'credentials', 'credentials.json')

        # Create directories if they don't exist
        os.makedirs(os.path.dirname(self.sent_emails_file), exist_ok=True)
        os.makedirs(os.path.dirname(self.credentials_path), exist_ok=True)

    def load_sent_emails(self):
        if os.path.exists(self.sent_emails_file):
            try:
                return set(pd.read_csv(self.sent_emails_file)['email'].values)
            except pd.errors.EmptyDataError:
                return set()
        return set()

    def save_sent_email(self, email: str):
        df = pd.DataFrame({'email': [email]})
        if os.path.exists(self.sent_emails_file):
            df.to_csv(self.sent_emails_file, mode='a', header=False, index=False)
        else:
            df.to_csv(self.sent_emails_file, index=False)

    def run(self, email_template: str = None):
        # Initialize components
        parser = RecruiterParser(self.recruiters_file)
        template = EmailTemplate()
        if email_template:
            template.set_template(email_template)
        email_service = GmailService(self.credentials_path)
        sent_emails = self.load_sent_emails()

        # Get recruiters
        recruiters = parser.parse_recruiters()

        # Process each recruiter
        for recruiter in recruiters:
            if recruiter.email in sent_emails:
                print(f"Email already sent to {recruiter.name}")
                continue

            # Generate email content
            email_body = template.generate_email(
                recruiter_name=recruiter.name,
                company_name=recruiter.company
            )

            # Send email
            if email_service.send_email(
                to_email=recruiter.email,
                subject=f"Software Engineering Position at {recruiter.company}",
                body=email_body
            ):
                print(f"Successfully sent email to {recruiter.name}")
                self.save_sent_email(recruiter.email)
            else:
                print(f"Failed to send email to {recruiter.name}")

if __name__ == "__main__":
    automation = EmailAutomation()
    
    # Example of setting a custom template
    custom_template = """
Dear {{recruiter_name}},

I hope this email finds you well. I am reaching out regarding potential software engineering opportunities at {{company_name}}. 

[Your AI-generated content here]

Best regards,
[Your Name]
"""
    automation.run(email_template=custom_template)