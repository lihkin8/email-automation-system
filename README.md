# Email Automation System

A comprehensive email automation system with tracking capabilities and a dashboard interface.

## Project Structure

- **backend/** - Email automation backend (Python)
- **frontend/** - Dashboard frontend (React)

## Setup and Installation

### Prerequisites

- Python 3.9+
- Node.js 16+
- PostgreSQL database (or Neon DB account)
- Gmail account with API access

### Backend Setup

1. Navigate to the backend directory:

   ```bash
   cd backend
   ```

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Configure environment variables:

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

### Frontend Setup

1. Navigate to the frontend directory:

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

## Running the Application

### Backend

```bash
cd backend
python automation.py
```

To run the tracking server:

```bash
cd backend
python tracking_server.py
```

### Frontend

```bash
cd frontend
npm start
```

## Development Guidelines

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

[MIT](LICENSE)
