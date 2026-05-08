from fastapi import Depends

from app.services.auth_service import get_current_user


async def get_current_user_id(current_user=Depends(get_current_user)) -> int:
    """Return the authenticated user's integer ID.

    Note: tests override this dependency to inject a fixed user_id.
    """
    return int(current_user.id)
