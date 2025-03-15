# Contributing to Email Automation System

Thank you for your interest in contributing to our email automation system!

## Development Setup

Follow the setup instructions in the README.md file to get your local development environment running.

## Git Workflow

1. Create a feature branch from `main`:

   ```bash
   git checkout main
   git pull
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit:

   ```bash
   git add .
   git commit -m "Description of changes"
   ```

3. Push your branch:

   ```bash
   git push origin feature/your-feature-name
   ```

4. Create a pull request against the `main` branch

## Coding Standards

### Backend (Python)

- Follow PEP 8 guidelines
- Use descriptive variable names
- Include docstrings for functions and classes
- Write unit tests for new functionality

### Frontend (JavaScript/React)

- Follow the Airbnb JavaScript Style Guide
- Use functional components and hooks
- Keep components modular and focused
- Write tests for components and functionality

## Pull Request Process

1. Update documentation if necessary
2. Ensure tests pass
3. Get approval from at least one maintainer
4. Merge only if checks pass

## Environment Variables

Be careful not to commit any sensitive information. Always use environment variables for:

- API keys
- Database credentials
- Service account information
- Personal information

## Questions?

Feel free to open an issue if you have any questions about the contribution process.
