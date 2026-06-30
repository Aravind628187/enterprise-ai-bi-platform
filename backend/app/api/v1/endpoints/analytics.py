from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
import pandas as pd
import numpy as np

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import User, Dataset, Prediction, KPI
from app.ml.ai_engine import ai_engine
from app.ml.data_processor import DataProcessor

router = APIRouter()
processor = DataProcessor()


@router.get("/dashboard")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Total datasets
    total_datasets = (
        await db.execute(
            select(func.count(Dataset.id))
            .where(Dataset.owner_id == current_user.id)
        )
    ).scalar() or 0

    # Total predictions
    total_predictions = (
        await db.execute(
            select(func.count(Prediction.id))
            .where(Prediction.owner_id == current_user.id)
        )
    ).scalar() or 0

    # Get ALL datasets
    result = await db.execute(
        select(Dataset)
        .where(Dataset.owner_id == current_user.id)
        .order_by(Dataset.created_at.desc())
    )

    datasets = result.scalars().all()

    storage_used = sum(d.file_size or 0 for d in datasets)

    ready = len([d for d in datasets if str(d.status).lower().endswith("ready")])
    processing = len([d for d in datasets if str(d.status).lower().endswith("processing")])
    failed = len([d for d in datasets if str(d.status).lower().endswith("failed")])

    return {
        "stats": {
            "total_datasets": total_datasets,
            "total_predictions": total_predictions,
            "storage_used_mb": round(storage_used / 1024 / 1024, 2),
            "ready_datasets": ready,
            "processing_datasets": processing,
            "failed_datasets": failed,
        },
        "recent_datasets": [
            {
                "id": d.id,
                "name": d.name,
                "status": d.status,
                "row_count": d.row_count,
                "column_count": d.column_count,
                "quality_score": d.data_quality_score,
                "created_at": d.created_at,
            }
            for d in datasets[:10]
        ],
    }


@router.get("/insights/{dataset_id}")
async def get_insights(
    dataset_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Dataset).where(Dataset.id == dataset_id, Dataset.owner_id == current_user.id)
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    insights = await ai_engine.generate_insights(dataset.file_path, dataset.file_type)
    return {"insights": insights}


@router.get("/kpis/{dataset_id}")
async def get_kpis(
    dataset_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Dataset).where(Dataset.id == dataset_id, Dataset.owner_id == current_user.id)
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    kpis = await ai_engine.generate_kpis(dataset.file_path, dataset.file_type)
    return {"kpis": kpis}


@router.get("/charts/{dataset_id}")
async def get_chart_data(
    dataset_id: str,
    chart_type: str = "line",
    x_col: Optional[str] = None,
    y_col: Optional[str] = None,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Dataset).where(Dataset.id == dataset_id, Dataset.owner_id == current_user.id)
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        import asyncio
        loop = asyncio.get_event_loop()
        df = await loop.run_in_executor(None, processor.load_dataframe, dataset.file_path, dataset.file_type)

        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        all_cols = df.columns.tolist()

        x = x_col if x_col in all_cols else (all_cols[0] if all_cols else None)
        y = y_col if y_col in numeric_cols else (numeric_cols[0] if numeric_cols else None)

        if not x or not y:
            return {"data": [], "columns": all_cols, "numeric_columns": numeric_cols}

        data = df[[x, y]].dropna().head(limit)
        chart_data = data.replace({np.nan: None}).to_dict(orient="records")

        return {
            "data": chart_data,
            "x_col": x,
            "y_col": y,
            "columns": all_cols,
            "numeric_columns": numeric_cols,
            "chart_type": chart_type,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/correlation/{dataset_id}")
async def get_correlation(
    dataset_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Dataset).where(Dataset.id == dataset_id, Dataset.owner_id == current_user.id)
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    try:
        import asyncio
        loop = asyncio.get_event_loop()
        df = await loop.run_in_executor(None, processor.load_dataframe, dataset.file_path, dataset.file_type)
        numeric = df.select_dtypes(include=[np.number]).iloc[:, :12]
        if len(numeric.columns) < 2:
            return {"matrix": {}, "columns": []}
        corr = numeric.corr().round(3).replace({np.nan: 0})
        return {"matrix": corr.to_dict(), "columns": list(corr.columns)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/datasets")
async def dashboard_datasets(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Dataset)
        .where(Dataset.owner_id == current_user.id)
        .order_by(Dataset.created_at.desc())
    )

    datasets = result.scalars().all()

    return [
        {
            "id": d.id,
            "name": d.name,
            "status": d.status,
            "rows": d.row_count,
            "columns": d.column_count,
            "quality": d.data_quality_score,
            "size": d.file_size,
            "created_at": d.created_at,
        }
        for d in datasets
    ]