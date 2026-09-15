from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta

from ..database import get_db
from .. import crud, schemas, models, auth

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/register", response_model=schemas.UserOut)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    db_email = crud.get_user_by_email(db, email=user.email)
    if db_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create User
    new_user = crud.create_user(db, user)
    
    # If registering as an officer, auto-provision Officer entity if details are in extra context
    # Usually in production this is admin-driven, but for testing we provision a mock department/district
    if new_user.role == "officer":
        # Create default mock officer links if none exist
        default_dept = db.query(models.Department).first()
        dept_id = default_dept.id if default_dept else 1
        officer_data = schemas.OfficerCreate(
            user_id=new_user.id,
            department_id=dept_id,
            district="Hyderabad"
        )
        crud.create_officer(db, officer_data)
        
    crud.create_audit_log(
        db, 
        user_id=new_user.id, 
        action="USER_REGISTRATION", 
        target_type="user", 
        target_id=new_user.id,
        details=f"Registered user: {new_user.username} with role: {new_user.role}"
    )
    return new_user

@router.post("/login", response_model=schemas.Token)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_username(db, username=form_data.username)
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.username, "role": user.role}, 
        expires_delta=access_token_expires
    )
    
    crud.create_audit_log(
        db,
        user_id=user.id,
        action="USER_LOGIN",
        target_type="user",
        target_id=user.id
    )
    
    # Serialize and return
    user_out = schemas.UserOut.model_validate(user)
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": user_out
    }

@router.get("/me", response_model=schemas.UserOut)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user
