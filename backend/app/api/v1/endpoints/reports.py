from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import uuid, os

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import User, Dataset, Report, ReportStatus
from app.schemas.schemas import ReportCreate, ReportResponse

router = APIRouter()


@router.post("/", response_model=ReportResponse, status_code=201)
async def create_report(
    report_in: ReportCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = Report(
        id=str(uuid.uuid4()),
        name=report_in.name,
        description=report_in.description,
        report_type=report_in.report_type,
        file_type=report_in.file_type,
        config=report_in.config,
        dataset_id=report_in.dataset_id,
        owner_id=current_user.id,
        status=ReportStatus.PENDING,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    background_tasks.add_task(generate_report, report.id)
    return report


async def generate_report(report_id: str):
    from app.core.database import AsyncSessionLocal
    from app.ml.ai_engine import ai_engine
    from app.ml.data_processor import DataProcessor

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Report).where(Report.id == report_id))
        report = result.scalar_one_or_none()
        if not report:
            return

        report.status = ReportStatus.GENERATING
        db.add(report)
        await db.commit()

        try:
            dataset = None
            if report.dataset_id:
                ds_result = await db.execute(select(Dataset).where(Dataset.id == report.dataset_id))
                dataset = ds_result.scalar_one_or_none()

            ai_summary = "AI-powered report generated successfully."
            insights = []

            if dataset:
                insights = await ai_engine.generate_insights(dataset.file_path, dataset.file_type)
                ai_summary = f"Analysis of {dataset.name}: {dataset.row_count} rows, {dataset.column_count} columns. Data quality score: {dataset.data_quality_score:.1f}%."

            os.makedirs("reports", exist_ok=True)
            file_path = f"reports/{report_id}.{report.file_type}"

            if report.file_type == "pdf":
                _generate_pdf(file_path, report.name, ai_summary, insights, dataset)
            elif report.file_type == "csv" and dataset:
                _generate_csv(file_path, dataset)
            elif report.file_type == "xlsx" and dataset:
                _generate_xlsx(file_path, dataset)
            else:
                with open(file_path, "w") as f:
                    f.write(f"Report: {report.name}\n\n{ai_summary}\n")

            report.file_path = file_path
            report.ai_summary = ai_summary
            report.insights = insights
            report.status = ReportStatus.READY
        except Exception as e:
            report.status = ReportStatus.FAILED
            report.ai_summary = str(e)

        db.add(report)
        await db.commit()


def _generate_pdf(file_path, name, summary, insights, dataset):
    from fpdf import FPDF
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", "B", 16)
    pdf.cell(0, 10, name[:80], ln=True)
    pdf.set_font("Arial", "", 12)
    pdf.ln(5)
    pdf.multi_cell(0, 8, f"Executive Summary:\n{summary}")
    pdf.ln(5)
    if dataset:
        pdf.set_font("Arial", "B", 12)
        pdf.cell(0, 8, "Dataset Overview", ln=True)
        pdf.set_font("Arial", "", 11)
        pdf.cell(0, 7, f"  Rows: {dataset.row_count}", ln=True)
        pdf.cell(0, 7, f"  Columns: {dataset.column_count}", ln=True)
        pdf.cell(0, 7, f"  Data Quality Score: {dataset.data_quality_score:.1f}%", ln=True)
        pdf.cell(0, 7, f"  Outliers Detected: {dataset.outliers_detected}", ln=True)
        pdf.ln(5)
    if insights:
        pdf.set_font("Arial", "B", 12)
        pdf.cell(0, 8, "AI Insights", ln=True)
        pdf.set_font("Arial", "", 11)
        for ins in insights[:5]:
            pdf.multi_cell(0, 7, f"  [{ins.get('type','').upper()}] {ins.get('title','')}: {ins.get('description','')}")
    pdf.output(file_path)


def _generate_csv(file_path, dataset):
    import pandas as pd
    from app.ml.data_processor import DataProcessor
    p = DataProcessor()
    df = p.load_dataframe(dataset.file_path, dataset.file_type)
    df.to_csv(file_path, index=False)


def _generate_xlsx(file_path, dataset):
    import pandas as pd
    from app.ml.data_processor import DataProcessor
    p = DataProcessor()
    df = p.load_dataframe(dataset.file_path, dataset.file_type)
    df.to_excel(file_path, index=False)


@router.get("/", response_model=List[ReportResponse])
async def list_reports(
    skip: int = 0, limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Report).where(Report.owner_id == current_user.id).order_by(Report.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.owner_id == current_user.id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.get("/{report_id}/download")
async def download_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.owner_id == current_user.id)
    )
    report = result.scalar_one_or_none()
    if not report or not report.file_path or not os.path.exists(report.file_path):
        raise HTTPException(status_code=404, detail="Report file not found")
    return FileResponse(report.file_path, filename=f"{report.name}.{report.file_type}")
