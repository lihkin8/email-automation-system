# Email Automation System

A comprehensive email automation system for managing recruiter communications, automated follow-ups, and email tracking.

## Features

- Automated email sending based on recruiter data
- Follow-up email scheduling
- Email open/click tracking
- Dashboard for monitoring email performance

## Prerequisites

- Python 3.9+
- PostgreSQL database (or Neon DB account)
- Gmail account with API access

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/email-automation.git
   cd email-automation
   ```

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Set up environment variables:

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Set up the database:

   ```bash
   alembic upgrade head
   ```

5. Configure Gmail API credentials:
   - Go to the [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project
   - Enable the Gmail API
   - Create OAuth 2.0 credentials
   - Download the credentials.json file
   - Place in the `credentials/` directory

## Usage

### Running the automation

```bash
python automation.py
```

### Running the tracking server

```bash
python tracking_server.py
```

## API Endpoints

### Tracking API

- `GET /track/pixel/{email_id}` - Track email opens
- `GET /track/link/{email_id}/{link_id}` - Track link clicks

### Email API

- `POST /api/emails/send` - Send a new email
- `GET /api/emails` - List all emails
- `GET /api/emails/{email_id}` - Get email details

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

[MIT](LICENSE)
