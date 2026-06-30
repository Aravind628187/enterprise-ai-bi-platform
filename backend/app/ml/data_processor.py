import json
import asyncio
from typing import Dict, Any

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest


# ══════════════════════════════════════════════════════════════════════════════
#  JSON SAFETY HELPER
#  Converts ALL pandas/numpy types (Timestamp, int64, float64, NaN, etc.)
#  into plain Python types that PostgreSQL JSON columns can store.
# ══════════════════════════════════════════════════════════════════════════════

def json_safe(obj):
    """
    Convert any pandas / numpy object into a JSON-serializable Python object.
    Uses json.dumps(default=str) to stringify anything that isn't natively
    serializable (Timestamp, np.int64, np.float64, etc.), then loads it back
    so the result is a plain dict / list / str / int / float / None.
    """
    return json.loads(
        json.dumps(obj, default=str)
    )


# ══════════════════════════════════════════════════════════════════════════════
#  DATA PROCESSOR
# ══════════════════════════════════════════════════════════════════════════════

class DataProcessor:

    # ── Public async interface ─────────────────────────────────────────────────

    async def process(self, file_path: str, ext: str) -> Dict[str, Any]:
        """
        Async entry point — runs the heavy sync work in a thread pool
        so it never blocks the event loop.
        """
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None, self._process_sync, file_path, ext
        )

    async def get_stats(self, file_path: str, file_type: str) -> Dict[str, Any]:
        """
        Async entry point for descriptive stats + correlation matrix.
        """
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None, self._stats_sync, file_path, file_type
        )

    # ── Core sync processing ───────────────────────────────────────────────────

    def _process_sync(self, file_path: str, ext: str) -> Dict[str, Any]:
        """
        Load → clean → profile → return a fully JSON-safe dict.
        Every value is safe to store in a PostgreSQL JSON / JSONB column.
        """
        df = self._load_file(file_path, ext)
        df = self._clean(df)

        # ── Per-column info ────────────────────────────────────────────────────
        columns_info: Dict[str, Any] = {}
        for col in df.columns:
            dtype = str(df[col].dtype)
            col_data: Dict[str, Any] = {
                "dtype":        dtype,
                "non_null":     int(df[col].notna().sum()),
                "null_count":   int(df[col].isna().sum()),
                "unique_count": int(df[col].nunique()),
                # FIX: json_safe converts Timestamp / np types in sample values
                "sample_values": json_safe(
                    df[col].dropna().head(5).tolist()
                ),
            }
            if pd.api.types.is_numeric_dtype(df[col]):
                s = df[col].dropna()
                col_data.update({
                    "min":  float(s.min())  if len(s) else None,
                    "max":  float(s.max())  if len(s) else None,
                    "mean": float(s.mean()) if len(s) else None,
                    "std":  float(s.std())  if len(s) else None,
                })
            columns_info[col] = col_data

        # ── Missing values ─────────────────────────────────────────────────────
        missing_values = {
            col: int(df[col].isna().sum())
            for col in df.columns
            if df[col].isna().sum() > 0
        }

        # ── Outliers + quality ─────────────────────────────────────────────────
        outliers      = self._detect_outliers(df)
        quality_score = self._compute_quality(df)

        # ── Preview — FIX: json_safe converts Timestamp → string ──────────────
        preview = json_safe(
            df.head(10)
              .replace({np.nan: None})
              .to_dict(orient="records")
        )

        # ── Schema ─────────────────────────────────────────────────────────────
        schema = json_safe(
            self._infer_schema(df)
        )

        return {
            "row_count":          len(df),
            "column_count":       len(df.columns),
            # FIX: wrap every dict/list in json_safe before returning
            "columns_info":       json_safe(columns_info),
            "missing_values":     json_safe(missing_values),
            "outliers_detected":  int(outliers),
            "data_quality_score": float(quality_score),
            "preview_data":       preview,
            "schema_info":        schema,
        }

    def _stats_sync(self, file_path: str, file_type: str) -> Dict[str, Any]:
        """
        Descriptive statistics + correlation matrix — fully JSON-safe.
        """
        df      = self._load_file(file_path, file_type)
        df      = self._clean(df)
        numeric = df.select_dtypes(include=[np.number])

        # FIX: json_safe handles np.float64 / NaN in describe()
        desc = json_safe(
            numeric.describe()
                   .replace({np.nan: None})
                   .to_dict()
        )

        corr: Dict = {}
        if len(numeric.columns) >= 2:
            corr_matrix = (
                numeric.corr(numeric_only=True)
                       .replace({np.nan: None})
            )
            # FIX: json_safe handles np.float64 in correlation matrix
            corr = json_safe(corr_matrix.to_dict())

        return {
            "descriptive_stats":  desc,
            "correlation_matrix": corr,
            "shape": {
                "rows":    len(df),
                "columns": len(df.columns),
            },
            # FIX: str(dtype) already a string — json_safe is still safe to call
            "dtypes": json_safe(
                {col: str(df[col].dtype) for col in df.columns}
            ),
            "missing_pct": json_safe({
                col: round(float(df[col].isna().mean() * 100), 2)
                for col in df.columns
            }),
        }

    # ── File loader ────────────────────────────────────────────────────────────

    def _load_file(self, file_path: str, ext: str) -> pd.DataFrame:
        ext = ext.lstrip(".")
        if ext == "csv":
            return pd.read_csv(file_path, low_memory=False, thousands=",")
        elif ext in ["xlsx", "xls"]:
            return pd.read_excel(file_path)
        elif ext == "json":
            return pd.read_json(file_path)
        raise ValueError(f"Unsupported file type: .{ext}")

    # ── Data cleaner ───────────────────────────────────────────────────────────

    def _clean(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Clean a raw DataFrame:
          1. Remove exact duplicate rows.
          2. Strip whitespace from string columns.
          3. Strip currency symbols & convert to numeric where possible.
          4. Force-convert 'amount' column to float.
          5. Parse 'date' column to datetime.

        FIX: Removed the intermediate astype(str) → back-to-float pattern
        that triggered "Setting an item of incompatible dtype" warnings.
        """
        df = df.copy()

        # 1. Drop duplicate rows
        df = df.drop_duplicates()

        # 2 & 3. Clean object/string columns
        CURRENCY_CHARS = {"$", "₹", "€", "£"}
        for col in df.select_dtypes(include="object").columns:

            # Strip whitespace and replace bare "nan" strings with NaN
            df[col] = (
                df[col]
                .astype(str)
                .str.strip()
                .replace("nan", np.nan)
            )

            # Remove currency symbols and thousands commas
            cleaned = df[col].astype(str)
            for ch in CURRENCY_CHARS:
                cleaned = cleaned.str.replace(ch, "", regex=False)
            cleaned = cleaned.str.replace(",", "", regex=False).str.strip()

            # Try converting to numeric — only if ≥50 % of values convert
            numeric = pd.to_numeric(cleaned, errors="coerce")
            if numeric.notna().sum() >= len(df) * 0.5:
                df[col] = numeric

        # 4. Force 'amount' column to numeric (handles mixed $1,234.56 formats)
        if "amount" in df.columns:
            amount_str = df["amount"].astype(str)
            for ch in CURRENCY_CHARS:
                amount_str = amount_str.str.replace(ch, "", regex=False)
            amount_str = amount_str.str.replace(",", "", regex=False).str.strip()
            # Assign directly to avoid dtype-mismatch warning
            df["amount"] = pd.to_numeric(amount_str, errors="coerce")

        # 5. Parse 'date' column to datetime
        if "date" in df.columns:
            df["date"] = pd.to_datetime(df["date"], errors="coerce")

        return df

    # ── Outlier detection ──────────────────────────────────────────────────────

    def _detect_outliers(self, df: pd.DataFrame) -> int:
        """
        Use IsolationForest on all numeric columns to count outlier rows.
        Returns 0 if there are not enough rows or no numeric columns.
        """
        numeric = df.select_dtypes(include=[np.number])
        if numeric.empty or len(numeric) < 10:
            return 0
        try:
            clf           = IsolationForest(contamination=0.05, random_state=42)
            numeric_filled = numeric.fillna(numeric.median())
            preds         = clf.fit_predict(numeric_filled)
            return int((preds == -1).sum())
        except Exception:
            return 0

    # ── Data quality score ─────────────────────────────────────────────────────

    def _compute_quality(self, df: pd.DataFrame) -> float:
        """
        Quality score 0–100 based on:
          - Completeness (70 % weight): proportion of non-missing cells
          - Uniqueness   (30 % weight): proportion of non-duplicate rows
        """
        if df.empty:
            return 0.0
        total_cells  = df.size
        missing      = df.isna().sum().sum()
        completeness = 1 - (missing / total_cells)
        dup_ratio    = 1 - (df.duplicated().sum() / len(df))
        score        = (completeness * 0.7 + dup_ratio * 0.3) * 100
        return round(min(100.0, max(0.0, score)), 2)

    # ── Schema inference ───────────────────────────────────────────────────────

    def _infer_schema(self, df: pd.DataFrame) -> Dict[str, str]:
        """
        Map each column to a simple type string:
        float | integer | datetime | string
        """
        schema: Dict[str, str] = {}
        for col in df.columns:
            dtype_str = str(df[col].dtype)
            if df[col].dtype in [np.float64, np.float32]:
                schema[col] = "float"
            elif df[col].dtype in [np.int64, np.int32]:
                schema[col] = "integer"
            elif "datetime" in dtype_str:
                schema[col] = "datetime"
            else:
                schema[col] = "string"
        return schema

    # ── Convenience loader ─────────────────────────────────────────────────────

    def load_dataframe(self, file_path: str, file_type: str) -> pd.DataFrame:
        """Load and clean a file, returning a ready-to-use DataFrame."""
        df = self._load_file(file_path, file_type)
        return self._clean(df)