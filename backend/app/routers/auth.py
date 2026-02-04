from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, check_login_rate_limit
from app.models.user import User
from app.schemas.auth import UserCreate, UserLogin, UserResponse, Token
from app.services.auth import AuthService

router = APIRouter(prefix="/api/auth", tags=["auth"])
auth_service = AuthService()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user.

    Args:
        user_data: User registration data (email, name, password).
        db: Database session.

    Returns:
        Created user data.

    Raises:
        HTTPException: If email is already registered.
    """
    # Check if user exists
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create user
    user = User(
        email=user_data.email,
        name=user_data.name,
        password_hash=auth_service.hash_password(user_data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token, dependencies=[Depends(check_login_rate_limit)])
async def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """Authenticate user and return access token.

    Args:
        credentials: User login credentials (email, password).
        db: Database session.

    Returns:
        Access token and token type.

    Raises:
        HTTPException: If credentials are invalid or rate limit exceeded.
    """
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not auth_service.verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = auth_service.create_access_token(data={"sub": str(user.id)})
    return Token(access_token=token)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user.

    Args:
        current_user: The authenticated user from the JWT token.

    Returns:
        Current user data.
    """
    return current_user


@router.get("/users", response_model=list[UserResponse])
async def list_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """List users in the same organization as the current user.

    Users are scoped to their organization for data isolation.
    Users without an organization can only see themselves.

    Args:
        db: Database session.
        current_user: The authenticated user from the JWT token.

    Returns:
        List of users in the same organization.
    """
    # If user has no organization, return only themselves
    if not current_user.organization_id:
        return [current_user]

    # Return users in the same organization
    users = db.query(User).filter(
        User.organization_id == current_user.organization_id
    ).all()
    return users
