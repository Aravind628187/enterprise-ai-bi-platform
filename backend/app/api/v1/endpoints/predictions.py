from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import uuid

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import User, Dataset, Prediction
from app.schemas.schemas import PredictionCreate, PredictionResponse
from app.ml.ml_engine import ml_engine

router = APIRouter()


# -----------------------------
# Create Prediction
# -----------------------------
@router.post("/", response_model=PredictionResponse, status_code=201)
async def create_prediction(
    pred_in: PredictionCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == pred_in.dataset_id,
            Dataset.owner_id == current_user.id,
        )
    )

    dataset = result.scalar_one_or_none()

    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    prediction = Prediction(
        id=str(uuid.uuid4()),
        name=pred_in.name,
        model_type=pred_in.model_type,
        target_column=pred_in.target_column,
        feature_columns=pred_in.feature_columns,
        model_config=pred_in.config,
        status="running",
        dataset_id=pred_in.dataset_id,
        owner_id=current_user.id,
    )

    db.add(prediction)
    await db.commit()
    await db.refresh(prediction)

    background_tasks.add_task(
        run_prediction,
        prediction.id,
        dataset.file_path,
        dataset.file_type,
        pred_in.model_type,
        pred_in.target_column,
        pred_in.feature_columns,
        pred_in.config,
    )

    return prediction


# -----------------------------
# Background Training
# -----------------------------
async def run_prediction(
    pred_id,
    file_path,
    file_type,
    model_type,
    target_col,
    feature_cols,
    config,
):
    from app.core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:

        result = await db.execute(
            select(Prediction).where(Prediction.id == pred_id)
        )

        pred = result.scalar_one_or_none()

        if not pred:
            return

        try:
            output = await ml_engine.run_pipeline(
                file_path,
                file_type,
                model_type,
                target_col,
                feature_cols,
                config,
            )

            pred.metrics = output.get("metrics", {})
            pred.feature_importance = output.get("feature_importance", {})
            pred.shap_values = output.get("shap_values", {})
            pred.predictions_data = output.get("predictions_data", [])
            pred.forecast_data = output.get("forecast_data", [])
            pred.status = "completed"

        except Exception as e:

            pred.status = "failed"
            pred.metrics = {"error": str(e)}

        db.add(pred)
        await db.commit()


# -----------------------------
# List Predictions
# -----------------------------
@router.get("/", response_model=List[PredictionResponse])
async def list_predictions(
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Prediction)
        .where(Prediction.owner_id == current_user.id)
        .offset(skip)
        .limit(limit)
    )

    return result.scalars().all()


# -----------------------------
# Get Prediction
# -----------------------------
@router.get("/{pred_id}", response_model=PredictionResponse)
async def get_prediction(
    pred_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Prediction).where(
            Prediction.id == pred_id,
            Prediction.owner_id == current_user.id,
        )
    )

    prediction = result.scalar_one_or_none()

    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")

    return prediction


# -----------------------------
# Delete Prediction
# -----------------------------
@router.delete("/{pred_id}", status_code=204)
async def delete_prediction(
    pred_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Prediction).where(
            Prediction.id == pred_id,
            Prediction.owner_id == current_user.id,
        )
    )

    prediction = result.scalar_one_or_none()

    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")

    await db.delete(prediction)
    await db.commit()

    return None