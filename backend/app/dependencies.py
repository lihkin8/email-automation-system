from fastapi import HTTPException, status


async def get_current_user_id() -> int:
    """Returns the authenticated user's ID from the JWT session cookie.

    Stub implementation — replaced by real JWT auth in KAN-11.
    All protected endpoints depend on this; override in tests.
    """
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
    )
