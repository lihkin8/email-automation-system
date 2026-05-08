import boto3
from app.config import settings
from typing import Tuple

r2_client = boto3.client(
    "s3",
    endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
    aws_access_key_id=settings.r2_access_key_id,
    aws_secret_access_key=settings.r2_secret_access_key,
    region_name="auto",
)


def upload_resume(user_id: int, content: bytes, filename: str) -> str:
    """Upload file bytes to R2 at resumes/{user_id}/{filename}. Returns the object key."""
    key = f"resumes/{user_id}/{filename}"
    r2_client.put_object(Bucket=settings.r2_bucket_name, Key=key, Body=content)
    return key


def delete_resume(key: str) -> None:
    """Delete the R2 object at the given key."""
    r2_client.delete_object(Bucket=settings.r2_bucket_name, Key=key)


def get_presigned_url(key: str, expires_in: int = 3600) -> str:
    """Generate a presigned GET URL for the given R2 object key."""
    return r2_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.r2_bucket_name, "Key": key},
        ExpiresIn=expires_in,
    )


def download_resume(key: str) -> Tuple[bytes, str]:
    """Download the resume object bytes from R2. Returns (content_bytes, filename)."""
    obj = r2_client.get_object(Bucket=settings.r2_bucket_name, Key=key)
    content: bytes = obj["Body"].read()
    filename = key.split("/")[-1] if key else "resume"
    return content, filename
