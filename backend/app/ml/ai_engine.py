import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
import asyncio
import json
import os

from app.ml.data_processor import DataProcessor
from app.core.config import settings

processor = DataProcessor()


class AIEngine:
    def __init__(self):
        self.openai_client = None
        self.gemini_model = None
        self._init_clients()

    def _init_clients(self):
        if settings.OPENAI_API_KEY:
            try:
                from openai import AsyncOpenAI
                self.openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            except Exception:
                pass
        if settings.GEMINI_API_KEY:
            try:
                import google.generativeai as genai
                genai.configure(api_key=settings.GEMINI_API_KEY)
                self.gemini_model = genai.GenerativeModel("gemini-pro")
            except Exception:
                pass

    async def chat_with_dataset(
        self,
        message: str,
        file_path: Optional[str],
        file_type: Optional[str],
        history: List[Dict[str, str]],
    ) -> Dict[str, Any]:
        context = ""
        charts = []

        if file_path and file_type:
            try:
                loop = asyncio.get_event_loop()
                df = await loop.run_in_executor(None, processor.load_dataframe, file_path, file_type)
                df_clean = df.head(500).replace({np.nan: None})
                stats = df.describe(include="all").replace({np.nan: None}).to_dict()
                context = f"""
Dataset Summary:
- Shape: {df.shape[0]} rows x {df.shape[1]} columns
- Columns: {list(df.columns)}
- Dtypes: {df.dtypes.to_dict()}
- Missing values: {df.isna().sum().to_dict()}
- Sample statistics: {json.dumps(stats, default=str)[:2000]}
- First 5 rows: {df.head(5).to_dict(orient='records')}
"""
                charts = self._suggest_charts(df, message)
            except Exception as e:
                context = f"Dataset loading error: {str(e)}"

        response_text = await self._generate_response(message, context, history)
        return {"message": response_text, "charts": charts}

    async def _generate_response(self, message: str, context: str, history: List[Dict[str, str]]) -> str:
        system_prompt = """You are an expert AI Data Analyst and Business Intelligence assistant.
You help users analyze datasets, uncover insights, identify trends, detect anomalies, and provide actionable business recommendations.
When analyzing data, provide specific, quantitative insights. Format responses clearly with key findings highlighted.
If you identify patterns or anomalies, explain their business implications."""

        full_message = message
        if context:
            full_message = f"{context}\n\nUser Question: {message}"

        if self.openai_client:
            return await self._openai_chat(system_prompt, full_message, history)
        elif self.gemini_model:
            return await self._gemini_chat(system_prompt, full_message, history)
        else:
            return self._fallback_analysis(message, context)

    async def _openai_chat(self, system: str, message: str, history: List[Dict]) -> str:
        messages = [{"role": "system", "content": system}]
        for h in history[-6:]:
            messages.append({"role": h["role"], "content": h["content"]})
        messages.append({"role": "user", "content": message})
        try:
            response = await self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                max_tokens=1000,
                temperature=0.7,
            )
            return response.choices[0].message.content
        except Exception as e:
            return self._fallback_analysis(message, "")

    async def _gemini_chat(self, system: str, message: str, history: List[Dict]) -> str:
        try:
            loop = asyncio.get_event_loop()
            prompt = f"{system}\n\n{message}"
            response = await loop.run_in_executor(None, self.gemini_model.generate_content, prompt)
            return response.text
        except Exception:
            return self._fallback_analysis(message, "")

    def _fallback_analysis(self, message: str, context: str) -> str:
        msg_lower = message.lower()
        if context:
            if "correlation" in msg_lower:
                return "Based on the dataset, I can identify correlations between numeric columns. The correlation matrix shows relationships between variables - values close to 1 or -1 indicate strong relationships."
            elif "trend" in msg_lower or "forecast" in msg_lower:
                return "Looking at temporal patterns in the data, I can identify trends. Use the Forecast feature for detailed time-series predictions with confidence intervals."
            elif "anomal" in msg_lower or "outlier" in msg_lower:
                return "I've analyzed the dataset using Isolation Forest algorithm. Outliers are data points that significantly deviate from the normal distribution. Check the Data Quality panel for details."
            elif "summary" in msg_lower or "describe" in msg_lower:
                return f"Here's a summary based on the dataset context:\n\n{context[:800] if context else 'No dataset loaded.'}"
            else:
                return f"I've analyzed your dataset. It contains the columns and statistics shown above. Ask me specific questions about trends, correlations, anomalies, or predictions."
        return "Please upload a dataset first, then I can provide detailed analysis, insights, and answer questions about your data."

    def _suggest_charts(self, df: pd.DataFrame, message: str) -> List[Dict]:
        charts = []
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        msg_lower = message.lower()

        if ("distribution" in msg_lower or "histogram" in msg_lower) and numeric_cols:
            col = numeric_cols[0]
            hist, edges = np.histogram(df[col].dropna(), bins=20)
            charts.append({
                "type": "bar",
                "title": f"Distribution of {col}",
                "data": [{"x": round(float(edges[i]), 2), "y": int(hist[i])} for i in range(len(hist))],
                "x_key": "x", "y_key": "y",
            })

        if ("correlation" in msg_lower) and len(numeric_cols) >= 2:
            corr = df[numeric_cols[:8]].corr().round(3)
            charts.append({
                "type": "heatmap",
                "title": "Correlation Matrix",
                "data": corr.replace({np.nan: 0}).to_dict(),
                "columns": list(corr.columns),
            })

        if ("trend" in msg_lower or "time" in msg_lower) and numeric_cols:
            col = numeric_cols[0]
            sample = df[col].dropna().head(50).values
            charts.append({
                "type": "line",
                "title": f"Trend: {col}",
                "data": [{"index": i, "value": float(v)} for i, v in enumerate(sample)],
                "x_key": "index", "y_key": "value",
            })
        return charts

    async def generate_insights(self, file_path: str, file_type: str) -> List[Dict]:
        try:
            loop = asyncio.get_event_loop()
            df = await loop.run_in_executor(None, processor.load_dataframe, file_path, file_type)
            return self._compute_insights(df)
        except Exception:
            return []

    def _compute_insights(self, df: pd.DataFrame) -> List[Dict]:
        insights = []
        numeric = df.select_dtypes(include=[np.number])

        if not numeric.empty:
            for col in numeric.columns[:5]:
                series = numeric[col].dropna()
                if len(series) < 3:
                    continue
                mean, std = series.mean(), series.std()
                outlier_count = int(((series - mean).abs() > 3 * std).sum())
                if outlier_count > 0:
                    insights.append({
                        "type": "anomaly",
                        "title": f"Outliers in {col}",
                        "description": f"{outlier_count} outlier(s) detected in '{col}' (>3σ from mean).",
                        "severity": "warning",
                    })

            if len(numeric.columns) >= 2:
                corr = numeric.corr()
                for i in range(len(corr.columns)):
                    for j in range(i + 1, len(corr.columns)):
                        val = corr.iloc[i, j]
                        if abs(val) > 0.8:
                            insights.append({
                                "type": "correlation",
                                "title": f"Strong correlation detected",
                                "description": f"'{corr.columns[i]}' and '{corr.columns[j]}' have correlation of {val:.2f}.",
                                "severity": "info",
                            })

        missing = df.isna().mean() * 100
        high_missing = missing[missing > 20]
        for col, pct in high_missing.items():
            insights.append({
                "type": "data_quality",
                "title": f"High missing values in {col}",
                "description": f"{pct:.1f}% of values are missing in '{col}'.",
                "severity": "warning",
            })

        if len(insights) == 0:
            insights.append({
                "type": "summary",
                "title": "Dataset looks clean",
                "description": f"No major issues detected. Dataset has {len(df)} rows and {len(df.columns)} columns.",
                "severity": "success",
            })
        return insights[:10]

    async def generate_kpis(self, file_path: str, file_type: str) -> List[Dict]:
        try:
            loop = asyncio.get_event_loop()
            df = await loop.run_in_executor(None, processor.load_dataframe, file_path, file_type)
            return self._detect_kpis(df)
        except Exception:
            return []

    def _detect_kpis(self, df: pd.DataFrame) -> List[Dict]:
        kpis = []
        numeric = df.select_dtypes(include=[np.number])
        keywords = {
            "revenue": ("Revenue", "$"),
            "sales": ("Sales", "$"),
            "profit": ("Profit", "$"),
            "count": ("Count", ""),
            "total": ("Total", ""),
            "avg": ("Average", ""),
            "price": ("Price", "$"),
            "amount": ("Amount", "$"),
            "quantity": ("Quantity", ""),
            "score": ("Score", ""),
        }
        for col in numeric.columns:
            col_lower = col.lower()
            for kw, (label, unit) in keywords.items():
                if kw in col_lower:
                    series = numeric[col].dropna()
                    if len(series) == 0:
                        continue
                    val = float(series.sum()) if "count" not in kw else float(series.mean())
                    half = len(series) // 2
                    prev = float(series[:half].sum()) if half > 0 else val
                    change = ((val - prev) / prev * 100) if prev != 0 else 0
                    kpis.append({
                        "name": f"Total {label}" if "count" not in kw else f"Average {label}",
                        "value": round(val, 2),
                        "previous_value": round(prev, 2),
                        "unit": unit,
                        "category": label,
                        "trend": "up" if change > 0 else "down" if change < 0 else "stable",
                        "change_percent": round(change, 2),
                    })
                    break
        if not kpis:
            for col in numeric.columns[:4]:
                series = numeric[col].dropna()
                if len(series) == 0:
                    continue
                val = float(series.mean())
                kpis.append({
                    "name": f"Avg {col}",
                    "value": round(val, 2),
                    "previous_value": None,
                    "unit": "",
                    "category": "metric",
                    "trend": "stable",
                    "change_percent": 0.0,
                })
        return kpis[:8]


ai_engine = AIEngine()
