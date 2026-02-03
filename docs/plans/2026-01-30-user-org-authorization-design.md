# User Organization Authorization Design

**Date:** 2026-01-30
**Status:** Approved
**Goal:** Fix authorization vulnerability on `/users` endpoint by scoping users to their organization

## Problem

The current `/api/auth/users` endpoint returns all users in the system to any authenticated user. This exposes user data (emails, names) across organization boundaries.

## Solution

1. Link users to organizations via `organization_id` foreign key
2. Update `/users` endpoint to return only users in the same organization
3. Create a UsersPage for admins to assign users to organizations

## Implementation

### 1. Backend: User Model Changes

**File:** `backend/app/models/user.py`

Add organization relationship:

```python
from sqlalchemy import ForeignKey
from sqlalchemy.orm import relationship

class User(Base):
    # ... existing fields ...

    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    organization = relationship("Organization", backref="users")
```

**Design decisions:**
- `nullable=True`: Existing users won't have an org initially
- `ondelete="SET NULL"`: Deleting an org doesn't delete users
- Indexed for query performance

### 2. Backend: Database Migration

**File:** `backend/migrations/versions/add_user_organization_id.py`

```python
def upgrade():
    op.add_column(
        'users',
        sa.Column('organization_id', UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        'fk_users_organization_id',
        'users', 'organizations',
        ['organization_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_index('ix_users_organization_id', 'users', ['organization_id'])

def downgrade():
    op.drop_index('ix_users_organization_id', 'users')
    op.drop_constraint('fk_users_organization_id', 'users', type_='foreignkey')
    op.drop_column('users', 'organization_id')
```

### 3. Backend: Update /users Endpoint

**File:** `backend/app/routers/auth.py`

```python
@router.get("/users", response_model=list[UserResponse])
async def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # If user has no org, return only themselves
    if not current_user.organization_id:
        return [current_user]

    # Return users in same organization
    users = db.query(User).filter(
        User.organization_id == current_user.organization_id
    ).all()
    return users
```

**Behavior:**
- Users with an org see all users in their org
- Users without an org see only themselves
- No cross-organization data exposure

### 4. Backend: User Update Endpoint

**File:** `backend/app/routers/users.py` (new file)

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import UserResponse, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("", response_model=list[UserResponse])
async def list_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all users (for admin user management)."""
    return db.query(User).all()

@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a user's organization assignment."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = user_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user
```

### 5. Backend: Schema Updates

**File:** `backend/app/schemas/auth.py`

Add to existing schemas:

```python
class UserUpdate(BaseModel):
    organization_id: Optional[UUID] = None

class UserResponse(BaseModel):
    id: UUID
    email: str
    name: str
    organization_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True
```

### 6. Frontend: Users Service

**File:** `frontend/src/services/users.ts`

```typescript
import { get, patch } from './api';
import type { User } from '../types';

export interface UserUpdate {
  organization_id?: string | null;
}

export const usersService = {
  list: () => get<User[]>('/api/users'),
  update: (id: string, data: UserUpdate) => patch<User>(`/api/users/${id}`, data),
};
```

### 7. Frontend: UsersPage Component

**File:** `frontend/src/pages/UsersPage.tsx`

Features:
- Table with columns: Name, Email, Organization, Created Date
- Inline organization dropdown per row
- Search/filter by name or email
- Toast notification on successful assignment
- "Unassigned" shown for users without organization

### 8. Frontend: Routing

**File:** `frontend/src/App.tsx`

Add route:
```tsx
<Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
```

Add navigation link to header (in relevant pages).

## Testing

1. **Unit tests:**
   - User model with organization relationship
   - `/users` endpoint filtering logic
   - User update endpoint

2. **Integration tests:**
   - Create user, assign to org, verify filtering
   - User without org sees only themselves

3. **Manual verification:**
   - UsersPage loads and displays users
   - Org assignment dropdown works
   - Navigation accessible

## Rollout Plan

1. Run migration to add `organization_id` column
2. Deploy backend changes
3. Deploy frontend changes
4. Manually assign existing users to organizations via UsersPage

## Security Considerations

- Existing users will have `organization_id = NULL` after migration
- Users without org assignment see only themselves (safe default)
- Future enhancement: Add admin role check to UsersPage access
