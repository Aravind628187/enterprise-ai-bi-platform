from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
import os, uuid, traceback

import aiofiles

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import User, Dataset, DatasetStatus
from app.schemas.schemas import DatasetResponse, DatasetUpdate
from app.core.config import settings
from app.ml.data_processor import DataProcessor

# ── FIX 4a: redirect_slashes=False ───────────────────────────────────────────
# Without this, FastAPI issues a 307 Temporary Redirect when the client calls
# GET /api/v1/datasets  (no trailing slash).
# The 307 redirect causes the browser/axios to drop the Authorization header,
# so the redirected request arrives as 401 Unauthorized.
# The axios interceptor then tries to refresh the token, which also redirects
# → creating an infinite 307 → 401 → refresh → 307 → 401 loop.
# Setting redirect_slashes=False makes both /datasets and /datasets/ work
# directly with no redirect.
router = APIRouter(redirect_slashes=False)

processor = DataProcessor()


# ── Upload ────────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=DatasetResponse, status_code=201)
async def upload_dataset(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed_exts = {".csv", ".json", ".xlsx", ".xls"}
    ext = os.path.splitext(file.filename or "")[1].lower()

    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    file_id   = str(uuid.uuid4())
    file_path = os.path.join(settings.UPLOAD_DIR, f"{file_id}{ext}")

    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large")

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    dataset = Dataset(
        id=file_id,
        name=name,
        description=description,
        file_path=file_path,
        file_name=file.filename,
        file_size=len(content),
        file_type=ext.lstrip("."),
        status=DatasetStatus.PROCESSING,
        owner_id=current_user.id,
    )
    db.add(dataset)
    await db.commit()
    await db.refresh(dataset)

    background_tasks.add_task(process_dataset, dataset.id, file_path, ext)

    return dataset


# ── Background processing ─────────────────────────────────────────────────────

async def process_dataset(dataset_id: str, file_path: str, ext: str):
    """
    FIX 4b: The original code had a critical scoping bug.

    Original code:
        async with AsyncSessionLocal() as db:
            result = await db.execute(...)
            dataset = result.scalar_one_or_none()
            if not dataset:
                return
            import traceback        ← ❌ db session CLOSED here (exits `with` block)

        try:                        ← dataset object is now DETACHED from session
            info = await processor.process(...)
            dataset.status = ...    ← ❌ modifying detached object
            db.add(dataset)         ← ❌ adding to closed session → SQLAlchemy error
            await db.commit()       ← ❌ commits nothing / raises

    Fix: Open ONE session, fetch the dataset, process, update, commit — all
    inside the SAME `async with` block so the session stays open throughout.
    """
    from app.core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        # 1. Fetch dataset inside the session that will stay open
        result  = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
        dataset = result.scalar_one_or_none()
        if not dataset:
            print(f"[process_dataset] Dataset {dataset_id} not found — skipping")
            return

        try:
            print("=" * 60)
            print(f"PROCESSING: {dataset_id}")

            info = await processor.process(file_path, ext)

            # 2. Update all fields
            dataset.status             = DatasetStatus.READY
            dataset.row_count          = info["row_count"]
            dataset.column_count       = info["column_count"]
            dataset.columns_info       = info["columns_info"]
            dataset.data_quality_score = info["data_quality_score"]
            dataset.missing_values     = info["missing_values"]
            dataset.outliers_detected  = info["outliers_detected"]
            dataset.preview_data       = info["preview_data"]
            dataset.schema_info        = info["schema_info"]

            print("Saving dataset...")
            db.add(dataset)
            await db.commit()
            await db.refresh(dataset)

            print("Commit successful")
            print(f"Status={dataset.status}  rows={dataset.row_count}  cols={dataset.column_count}")

        except Exception:
            traceback.print_exc()
            dataset.status = DatasetStatus.FAILED
            db.add(dataset)
            await db.commit()


# ── List datasets ─────────────────────────────────────────────────────────────

@router.get("/", response_model=List[DatasetResponse])
@router.get("",  response_model=List[DatasetResponse])   # FIX 4c: handle both with and without slash
async def list_datasets(
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    FIX 4d: Two routes registered (with and without trailing slash) so that
    any client variation works without a redirect.
    """
    result = await db.execute(
        select(Dataset)
        .where(Dataset.owner_id == current_user.id)
        .order_by(Dataset.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


# ── Get single dataset ────────────────────────────────────────────────────────

@router.get("/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(
    dataset_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id,
            Dataset.owner_id == current_user.id,
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset


# ── Update dataset ────────────────────────────────────────────────────────────

@router.patch("/{dataset_id}", response_model=DatasetResponse)
async def update_dataset(
    dataset_id: str,
    updates: DatasetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id,
            Dataset.owner_id == current_user.id,
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    for k, v in updates.model_dump(exclude_none=True).items():
        setattr(dataset, k, v)

    db.add(dataset)
    await db.commit()
    await db.refresh(dataset)
    return dataset


# ── Delete dataset ────────────────────────────────────────────────────────────

@router.delete("/{dataset_id}")
async def delete_dataset(
    dataset_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id,
            Dataset.owner_id == current_user.id,
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if dataset.file_path and os.path.exists(dataset.file_path):
        os.remove(dataset.file_path)

    await db.delete(dataset)
    await db.commit()
    return {"message": "Dataset deleted"}


# ── Columns ───────────────────────────────────────────────────────────────────

@router.get("/{dataset_id}/columns")
async def get_columns(
    dataset_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id,
            Dataset.owner_id == current_user.id,
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return {"columns": dataset.columns_info or {}}


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/{dataset_id}/stats")
async def get_stats(
    dataset_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id,
            Dataset.owner_id == current_user.id,
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if not dataset.file_path or not os.path.exists(dataset.file_path):
        raise HTTPException(status_code=404, detail="Dataset file not found on disk")

    stats = await processor.get_stats(dataset.file_path, dataset.file_type)
    return stats