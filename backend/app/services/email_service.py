# app/services/email_service.py
import base64
import logging
import asyncio
import os
import mimetypes
from concurrent.futures import ThreadPoolExecutor
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from jinja2 import Template
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from app.config import settings
from app.models import EmailType

logger = logging.getLogger(__name__)
executor = ThreadPoolExecutor(max_workers=5)

class GmailService:
    SCOPES = ['https://www.googleapis.com/auth/gmail.send']

    def __init__(self, credentials_path: str):
        self.credentials_path = credentials_path
        self.service = self._get_gmail_service()

    def _get_gmail_service(self):
        flow = InstalledAppFlow.from_client_secrets_file(self.credentials_path, self.SCOPES)
        creds = flow.run_local_server(port=0)
        return build('gmail', 'v1', credentials=creds)

    def _send_email_sync(self, to_email: str, subject: str, body: str, attachments: list = None) -> bool:
        try:
            message = MIMEMultipart()
            message['to'] = to_email
            message['subject'] = subject
            message.attach(MIMEText(body, 'html'))

            if attachments:
                logger.info(f"Processing {len(attachments)} attachments")
                for attachment in attachments:
                    try:
                        # attachment can be either a file path (str) or a tuple (filename, bytes, mime_type)
                        if isinstance(attachment, str):
                            file_path = attachment
                            logger.info(f"Attaching file: {file_path}")
                            with open(file_path, 'rb') as f:
                                data = f.read()
                            filename = os.path.basename(file_path)
                            mime_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
                        else:
                            filename, data, mime_type = attachment
                            logger.info(f"Attaching in-memory file: {filename}")

                        subtype = (mime_type.split("/", 1)[1] if "/" in mime_type else "octet-stream")
                        part = MIMEApplication(data, _subtype=subtype, Name=filename)
                        part['Content-Disposition'] = f'attachment; filename="{filename}"'
                        message.attach(part)
                        logger.info(f"Successfully attached: {filename}")
                    except Exception as e:
                        logger.error(f"Error attaching file: {str(e)}")
                        raise

            raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
            self.service.users().messages().send(userId='me', body={'raw': raw_message}).execute()
            return True
        except HttpError as error:
            logger.error(f"Error sending email to {to_email}: {error}")
            return False

    async def send_email(self, to_email: str, subject: str, body: str, attachments: list = None) -> bool:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            executor,
            self._send_email_sync,
            to_email,
            subject,
            body,
            attachments
        )

class EmailService:
    def __init__(self, gmail_service: GmailService):
        self.gmail_service = gmail_service
        self.templates = {
            EmailType.MAIN: Template("""
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333;">
    <div style="max-width: 100%;">
      <p>Hello {{ recruiter_name }},</p>

      <p>I hope this message finds you well. I have applied for the <b>SDE 1 (R-94228)</b> role at {{ company_name }} and wanted to express my continued enthusiasm for the role. Below is a quick snapshot of why I believe I'd be a great fit:</p>

      <p><strong>TL;DR:</strong></p>
      <ul>
        <li><b>Team Lead Experience</b>: Leading a team of <b>2 engineers</b> at CNI USC, architecting and managing a laboratory management system that handles <b>500+ monthly reservations</b> across <b>$20M+ worth of scientific instruments</b>, while maintaining system reliability and continuous improvement.</li>
        <li><b>Professional Expertise</b>: Two years as a Software Engineer at Bosch, building enterprise-grade tools that reduced errors by <b>40%</b> and improved efficiency by <b>30%</b>.</li>
        <li><b>Technical Proficiency</b>: Full-stack developer skilled in modern web technologies (<b>React.js</b>, <b>Node.js</b>, <b>TypeScript</b>, <b>Express.js</b>), cloud services (<b>AWS</b>, <b>GCP</b>, <b>Azure</b>), and database systems (<b>PostgreSQL</b>, <b>MongoDB</b>, <b>Prisma ORM</b>).</li>
        <li><b>Advanced Education</b>: Master's student in Computer Science at USC, excelling in Applied NLP, Web Technologies, Database Systems, and Deep Learning <b>(GPA: 3.95/4.0).</b></li>
      </ul>

      <p>In my current role at CNI USC, I <b>lead a development team of 2 engineers</b> where I've <b>architected and implemented a comprehensive laboratory management system</b> for USC's premier nano-imaging facility that modernizes operations managing <b>$20M+ worth of scientific instruments</b>. I engineered a <b>React.js</b> frontend with <b>Node.js TypeScript</b> backend web application with <b>role-based access control</b>, handling <b>500+ monthly reservations</b> across 15+ specialized instruments, successfully replacing a legacy PHP system. Additionally, I developed a <b>real-time instrument usage tracking and billing system</b> that processes <b>$100K+ in monthly transactions</b> with automated SKU generation and integration with USC's financial system.</p>

      <p>During my tenure at Bosch, I developed enterprise-grade tools that transformed inefficient processes into streamlined operations, resulting in a <b>40% reduction in errors</b> and a <b>30% improvement in efficiency</b>. This experience has honed my ability to adapt quickly to evolving environments, lead engineering initiatives, and deliver impactful results.</p>

      <p>In addition to my experience, I have a strong academic foundation. Through courses like Applied NLP, Database Systems, and Deep Learning, I've cultivated a keen understanding of cutting-edge technologies. I have hands-on experience building web applications with <b>AI integration</b>, leveraging best practices in developing <b>AI-powered systems</b>. My expertise in <b>full-stack development</b>, combined with my knowledge of <b>AI agents</b> and <b>machine learning models</b>, enables me to create intelligent, scalable solutions that can bring value to {{ company_name }}'s engineering initiatives.</p>

      <p>I would welcome the opportunity to discuss how my experience and skills can contribute to {{ company_name }}'s vision. Thank you for considering my application. I look forward to the possibility of working together.</p>

      <p>Warm regards,<br>
      Nikhil Shastry<br>
      Master of Science in Computer Science Candidate<br>
      University of Southern California<br>
      Phone: 213-839-7772<br>
      Email: nsathyan@usc.edu<br>
      LinkedIn Profile: <a href="https://www.linkedin.com/in/nikhil-shastry/" style="color: #0066cc;">https://www.linkedin.com/in/nikhil-shastry/</a></p>
    </div>
    <div style="background-image: url('{{ tracking_pixel_url }}')"></div>
  </body>
</html>
"""),
            EmailType.FOLLOW_UP: Template("""
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333;">
    <div style="max-width: 800px; padding: 20px;">
      <p>Hi {{ recruiter_name }},</p>

      <p>I hope you're doing well. I’m writing to follow up on my previous email regarding my application for the Software Engineer New Grad position at {{ company_name }}. In that message, I shared an overview of my experience—highlighting my work at Bosch, my leadership at CNI USC, and my academic pursuits at USC—to illustrate how I can contribute to your team.</p>

      <p>I wanted to ensure my application has reached you and to reiterate my genuine enthusiasm for the role. I remain very excited about the opportunity to bring my skills in full-stack development, cloud computing, and systems optimization to {{ company_name }}. For ease of access, I have attached my resume to this email as well.</p>

      <p>If you need any additional information or would like to schedule a call to discuss my background further, please feel free to let me know.</p>

      <p>Thank you for your time and consideration. I look forward to the possibility of contributing to the innovative work at {{ company_name }}.</p>

      <p>Best regards,<br>
      Nikhil Shastry<br>
      Master of Science in Computer Science Candidate<br>
      University of Southern California<br>
      Phone: 213-839-7772<br>
      Email: nsathyan@usc.edu<br>
      LinkedIn Profile: <a href="https://www.linkedin.com/in/nikhil-shastry/" style="color: #0066cc;">https://www.linkedin.com/in/nikhil-shastry/</a></p>
    </div>
    <div style="background-image: url('{{ tracking_pixel_url }}')"></div>
  </body>
</html>
""")
        }

    def generate_email(self, recruiter_name: str, company_name: str, tracking_pixel_url: str, email_type: EmailType = EmailType.MAIN) -> str:
        template = self.templates.get(email_type, self.templates[EmailType.MAIN])
        return template.render(
            recruiter_name=recruiter_name,
            company_name=company_name,
            tracking_pixel_url=tracking_pixel_url
        )

    async def send_email(self, to_email: str, recruiter_name: str, company_name: str, subject: str, email_id: int, 
                        email_type: EmailType = EmailType.MAIN, attachments: list = None) -> bool:
        tracking_pixel_url = f"{settings.tracking_pixel_base_url}?email_id={email_id}"
        email_body = self.generate_email(recruiter_name, company_name, tracking_pixel_url, email_type)
        return await self.gmail_service.send_email(to_email, subject, email_body, attachments)