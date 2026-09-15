from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from .. import crud, schemas, auth, models

router = APIRouter(prefix="/api/departments", tags=["Departments"])

@router.get("", response_model=List[schemas.DepartmentOut])
def list_departments(db: Session = Depends(get_db)):
    return crud.get_departments(db)

@router.get("/officers", response_model=List[schemas.OfficerOut])
def list_assignable_officers(
    district: str = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["district_admin", "state_admin", "reviewer"]))
):
    """Return real officer records used by the Central Room assignment desk."""
    return crud.get_officers(db, district=district)

@router.post("", response_model=schemas.DepartmentOut)
def add_department(
    dept: schemas.DepartmentCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["district_admin", "state_admin"]))
):
    db_dept = crud.get_department_by_code(db, code=dept.code)
    if db_dept:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Department with code {dept.code} already exists"
        )
    new_dept = crud.create_department(db, dept)
    
    crud.create_audit_log(
        db,
        user_id=current_user.id,
        action="CREATE_DEPARTMENT",
        target_type="department",
        target_id=new_dept.id,
        details=f"Created department: {new_dept.name} ({new_dept.code})"
    )
    return new_dept
