def test_imports():
    try:
        import fastapi
        import uvicorn
        import sqlalchemy
        import psycopg2
        import alembic
        import google.auth
        import google_auth_oauthlib
        import googleapiclient
        import jinja2
        import dotenv
        import pydantic
        import boto3
        
        print("✅ All packages imported successfully!")
        
    except ImportError as e:
        print(f"❌ Import Error: {e}")

if __name__ == "__main__":
    test_imports()