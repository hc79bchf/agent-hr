"""FastAPI dependencies for authentication and authorization."""

import time
from collections import defaultdict
from threading import Lock
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from uuid import UUID

from app.database import get_db
from app.services.auth import AuthService
from app.models.user import User

security = HTTPBearer()
auth_service = AuthService()


class RateLimiter:
    """Simple in-memory rate limiter using sliding window.

    For production, consider using Redis for distributed rate limiting.
    """

    def __init__(self, requests_per_window: int = 5, window_seconds: int = 60):
        """Initialize rate limiter.

        Args:
            requests_per_window: Maximum requests allowed per window.
            window_seconds: Window duration in seconds.
        """
        self.requests_per_window = requests_per_window
        self.window_seconds = window_seconds
        self.requests: dict[str, list[float]] = defaultdict(list)
        self.lock = Lock()

    def _get_client_key(self, request: Request) -> str:
        """Get unique identifier for the client.

        Uses X-Forwarded-For header if behind proxy, otherwise client host.
        """
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _clean_old_requests(self, key: str, now: float) -> None:
        """Remove requests outside the current window."""
        cutoff = now - self.window_seconds
        self.requests[key] = [t for t in self.requests[key] if t > cutoff]

    def is_rate_limited(self, request: Request) -> bool:
        """Check if client has exceeded rate limit.

        Args:
            request: The FastAPI request object.

        Returns:
            True if rate limited, False otherwise.
        """
        key = self._get_client_key(request)
        now = time.time()

        with self.lock:
            self._clean_old_requests(key, now)
            if len(self.requests[key]) >= self.requests_per_window:
                return True
            self.requests[key].append(now)
            return False

    def get_retry_after(self, request: Request) -> int:
        """Get seconds until rate limit resets.

        Args:
            request: The FastAPI request object.

        Returns:
            Seconds until oldest request expires from window.
        """
        key = self._get_client_key(request)
        now = time.time()

        with self.lock:
            self._clean_old_requests(key, now)
            if self.requests[key]:
                oldest = min(self.requests[key])
                return max(1, int(self.window_seconds - (now - oldest)))
            return 0


# Rate limiter for login endpoint: 5 attempts per minute
login_rate_limiter = RateLimiter(requests_per_window=5, window_seconds=60)


async def check_login_rate_limit(request: Request) -> None:
    """Dependency to check login rate limit.

    Raises:
        HTTPException: If rate limit exceeded.
    """
    if login_rate_limiter.is_rate_limited(request):
        retry_after = login_rate_limiter.get_retry_after(request)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """Extract and validate the current user from the JWT token.

    Args:
        credentials: HTTP Bearer credentials containing the JWT token.
        db: Database session.

    Returns:
        The authenticated User object.

    Raises:
        HTTPException: If the token is invalid, expired, or the user is not found.
    """
    token = credentials.credentials
    payload = auth_service.decode_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = db.query(User).filter(User.id == UUID(user_id)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


async def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Require the current user to be an admin.

    Args:
        current_user: The authenticated user from get_current_user.

    Returns:
        The authenticated admin User object.

    Raises:
        HTTPException: If the user is not an admin.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
