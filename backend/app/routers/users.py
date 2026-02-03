"""User management router for admin functions.

All endpoints require admin access.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.database import get_db
from app.dependencies import require_admin
from app.models.user import User
from app.schemas.auth import UserResponse, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserResponse])
async def list_all_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """List all users for admin user management.

    Requires admin access.

    Args:
        db: Database session.
        _admin: Admin user (verified by require_admin dependency).

    Returns:
        List of all users.
    """
    return db.query(User).all()


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Get a specific user by ID.

    Requires admin access.

    Args:
        user_id: The user's UUID.
        db: Database session.
        _admin: Admin user (verified by require_admin dependency).

    Returns:
        The user data.

    Raises:
        HTTPException: If user not found.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Update a user's organization assignment.

    Requires admin access.

    Args:
        user_id: The user's UUID.
        user_data: Fields to update (organization_id).
        db: Database session.
        _admin: Admin user (verified by require_admin dependency).

    Returns:
        The updated user data.

    Raises:
        HTTPException: If user not found.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = user_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Delete a user.

    Requires admin access. Admins cannot delete themselves.

    Args:
        user_id: The user's UUID.
        db: Database session.
        admin: Admin user (verified by require_admin dependency).

    Raises:
        HTTPException: If user not found or trying to delete self.
    """
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()
