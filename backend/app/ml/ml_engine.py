import logging
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
import asyncio

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import (
    accuracy_score, f1_score, mean_squared_error, r2_score, silhouette_score
)
import xgboost as xgb

try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    shap = None
    SHAP_AVAILABLE = False

try:
    import lightgbm as lgb
except ImportError:
    lgb = None

from app.ml.data_processor import DataProcessor

logger = logging.getLogger(__name__)
processor = DataProcessor()


class MLEngine:
    def __init__(self):
        self.models = {}

    async def run_pipeline(
        self,
        file_path: str,
        file_type: str,
        model_type: str,
        target_column: str,
        feature_columns: List[str],
        # ✅ Fix: parameter name matches frontend field `model_config` (not `config`)
        model_config: Dict[str, Any],
    ) -> Dict[str, Any]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            self._run_sync,
            file_path,
            file_type,
            model_type,
            target_column,
            feature_columns,
            model_config,
        )

    def _run_sync(
        self,
        file_path: str,
        file_type: str,
        model_type: str,
        target_column: str,
        feature_columns: List[str],
        config: Dict[str, Any],
    ) -> Dict[str, Any]:
        df = processor.load_dataframe(file_path, file_type)
        df = df.drop_duplicates()

        logger.info(
            "Pipeline started | model_type=%s | target=%s | features=%s | rows=%d",
            model_type, target_column, feature_columns, len(df),
        )

        # ✅ Fix: validate target column exists before any processing
        if model_type in ("regression", "classification", "forecasting"):
            if target_column not in df.columns:
                raise ValueError(
                    f"Target column '{target_column}' not found in dataset. "
                    f"Available columns: {list(df.columns)}"
                )

        # ✅ Fix: validate feature columns
        missing_features = [c for c in feature_columns if c not in df.columns]
        if missing_features:
            raise ValueError(
                f"Feature columns not found in dataset: {missing_features}"
            )

        # ✅ Fix: warn if target column is datetime/string for regression
        if model_type == "regression" and target_column in df.columns:
            dtype = df[target_column].dtype
            if dtype == "object" or np.issubdtype(dtype, np.datetime64):
                raise ValueError(
                    f"Target column '{target_column}' has dtype '{dtype}'. "
                    "Regression requires a numeric target column. "
                    "For datetime targets, use model_type='forecasting' instead."
                )

        if model_type == "forecasting":
            return self._run_forecasting(df, target_column, config)
        elif model_type == "clustering":
            return self._run_clustering(df, feature_columns, config)
        elif model_type == "classification":
            return self._run_classification(df, target_column, feature_columns, config)
        elif model_type == "regression":
            return self._run_regression(df, target_column, feature_columns, config)
        else:
            raise ValueError(
                f"Unknown model_type: '{model_type}'. "
                "Valid options: regression, classification, clustering, forecasting"
            )

    def _prepare_features(
        self,
        df: pd.DataFrame,
        feature_columns: List[str],
        target_column: Optional[str] = None,
    ):
        cols = [c for c in feature_columns if c in df.columns]
        if not cols:
            raise ValueError("No valid feature columns found in dataset.")

        X = df[cols].copy()
        y = df[target_column].copy() if (target_column and target_column in df.columns) else None

        # Fill numeric missing values with median
        for col in X.select_dtypes(include=[np.number]).columns:
            X[col] = X[col].fillna(X[col].median())

        # Encode categorical columns
        for col in X.select_dtypes(include="object").columns:
            X[col] = X[col].fillna("unknown")
            le = LabelEncoder()
            X[col] = le.fit_transform(X[col].astype(str))

        # ✅ Fix: also handle datetime feature columns — convert to numeric timestamp
        for col in X.select_dtypes(include=["datetime64", "datetimetz"]).columns:
            X[col] = pd.to_datetime(X[col], errors="coerce").astype(np.int64) // 10**9
            X[col] = X[col].fillna(X[col].median())

        if y is not None:
            if y.dtype == "object":
                y = y.fillna(y.mode()[0])
                le = LabelEncoder()
                y = pd.Series(le.fit_transform(y.astype(str)), name=target_column)
            elif np.issubdtype(y.dtype, np.datetime64):
                # datetime target → convert to Unix timestamp (seconds)
                y = pd.to_numeric(
                    pd.to_datetime(y, errors="coerce").astype(np.int64) // 10**9,
                    errors="coerce",
                )
                y = y.fillna(y.median())
            else:
                y = pd.to_numeric(y, errors="coerce")
                y = y.fillna(y.median())

        return X, y

    # ─────────────────────────────────────────────
    # CLASSIFICATION
    # ─────────────────────────────────────────────
    def _run_classification(
        self,
        df: pd.DataFrame,
        target_column: str,
        feature_columns: List[str],
        config: Dict[str, Any],
    ) -> Dict[str, Any]:
        X, y = self._prepare_features(df, feature_columns, target_column)
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        models_to_try = [
            (
                "xgboost",
                xgb.XGBClassifier(
                    n_estimators=100,
                    random_state=42,
                    eval_metric="logloss",
                    use_label_encoder=False,
                ),
            ),
            (
                "random_forest",
                RandomForestClassifier(n_estimators=100, random_state=42),
            ),
        ]
        if lgb is not None:
            models_to_try.insert(
                1,
                (
                    "lightgbm",
                    lgb.LGBMClassifier(n_estimators=100, random_state=42, verbose=-1),
                ),
            )

        best_model, best_score, best_name = None, -1.0, ""
        training_errors: Dict[str, str] = {}

        for name, model in models_to_try:
            try:
                model.fit(X_train, y_train)
                score = accuracy_score(y_test, model.predict(X_test))
                logger.info("Classification | %s | accuracy=%.4f", name, score)
                if score > best_score:
                    best_score, best_model, best_name = score, model, name
            except Exception as e:
                # ✅ Fix: log error per model, don't silently swallow
                logger.warning("Classification | %s failed: %s", name, e)
                training_errors[name] = str(e)
                continue

        # ✅ Fix: explicit None guard with actionable error
        if best_model is None:
            raise RuntimeError(
                "All classification models failed to train. "
                f"Errors per model: {training_errors}. "
                "Check that your target column contains valid class labels "
                "and feature columns contain numeric or categorical data."
            )

        logger.info("Best classification model: %s (accuracy=%.4f)", best_name, best_score)

        preds = best_model.predict(X_test)
        metrics = {
            "accuracy": round(float(accuracy_score(y_test, preds)), 4),
            "f1_score": round(float(f1_score(y_test, preds, average="weighted", zero_division=0)), 4),
            "best_model": best_name,
            "test_size": len(X_test),
        }

        fi = self._get_feature_importance(best_model, list(X.columns))
        shap_vals = self._get_shap(best_model, X_test) if SHAP_AVAILABLE else {}
        predictions = [
            {"index": int(i), "predicted": int(p), "actual": int(a)}
            for i, (p, a) in enumerate(zip(preds[:100], y_test.values[:100]))
        ]

        return {
            "metrics": metrics,
            "feature_importance": fi,
            "shap_values": shap_vals,
            "predictions_data": predictions,
            "forecast_data": [],
        }

    # ─────────────────────────────────────────────
    # REGRESSION
    # ─────────────────────────────────────────────
    def _run_regression(
        self,
        df: pd.DataFrame,
        target_column: str,
        feature_columns: List[str],
        config: Dict[str, Any],
    ) -> Dict[str, Any]:
        X, y = self._prepare_features(df, feature_columns, target_column)
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        models_to_try = [
            (
                "xgboost",
                xgb.XGBRegressor(n_estimators=100, random_state=42),
            ),
            (
                "random_forest",
                RandomForestRegressor(n_estimators=100, random_state=42),
            ),
        ]
        if lgb is not None:
            models_to_try.insert(
                1,
                (
                    "lightgbm",
                    lgb.LGBMRegressor(n_estimators=100, random_state=42, verbose=-1),
                ),
            )

        best_model, best_r2, best_name = None, -999.0, ""
        training_errors: Dict[str, str] = {}

        for name, model in models_to_try:
            try:
                model.fit(X_train, y_train)
                r2 = r2_score(y_test, model.predict(X_test))
                logger.info("Regression | %s | r2=%.4f", name, r2)
                if r2 > best_r2:
                    best_r2, best_model, best_name = r2, model, name
            except Exception as e:
                # ✅ Fix: log error per model, don't silently swallow
                logger.warning("Regression | %s failed: %s", name, e)
                training_errors[name] = str(e)
                continue

        # ✅ Fix: explicit None guard with actionable error
        if best_model is None:
            raise RuntimeError(
                "All regression models failed to train. "
                f"Errors per model: {training_errors}. "
                "Make sure the target column is numeric (not a date/string). "
                "For datetime targets use model_type='forecasting'."
            )

        logger.info("Best regression model: %s (r2=%.4f)", best_name, best_r2)

        preds = best_model.predict(X_test)
        mse = mean_squared_error(y_test, preds)
        metrics = {
            "r2_score": round(float(best_r2), 4),
            "rmse": round(float(np.sqrt(mse)), 4),
            "mae": round(float(np.mean(np.abs(y_test.values - preds))), 4),
            "best_model": best_name,
        }

        fi = self._get_feature_importance(best_model, list(X.columns))
        shap_vals = self._get_shap(best_model, X_test) if SHAP_AVAILABLE else {}
        predictions = [
            {"index": int(i), "predicted": round(float(p), 4), "actual": round(float(a), 4)}
            for i, (p, a) in enumerate(zip(preds[:100], y_test.values[:100]))
        ]

        return {
            "metrics": metrics,
            "feature_importance": fi,
            "shap_values": shap_vals,
            "predictions_data": predictions,
            "forecast_data": [],
        }

    # ─────────────────────────────────────────────
    # CLUSTERING
    # ─────────────────────────────────────────────
    def _run_clustering(
        self,
        df: pd.DataFrame,
        feature_columns: List[str],
        config: Dict[str, Any],
    ) -> Dict[str, Any]:
        from sklearn.cluster import KMeans

        X, _ = self._prepare_features(df, feature_columns)
        n_clusters = int(config.get("n_clusters", 3))

        if n_clusters < 2:
            raise ValueError("n_clusters must be >= 2 for clustering.")
        if len(X) < n_clusters:
            raise ValueError(
                f"Dataset has only {len(X)} rows but n_clusters={n_clusters}. "
                "Reduce n_clusters or use a larger dataset."
            )

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X.fillna(0))

        model = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = model.fit_predict(X_scaled)

        sil = silhouette_score(X_scaled, labels) if len(set(labels)) > 1 else 0.0
        predictions = [
            {"index": int(i), "cluster": int(label)}
            for i, label in enumerate(labels[:200])
        ]

        return {
            "metrics": {
                "silhouette_score": round(float(sil), 4),
                "n_clusters": n_clusters,
                "inertia": round(float(model.inertia_), 2),
            },
            "feature_importance": {},
            "shap_values": {},
            "predictions_data": predictions,
            "forecast_data": [],
        }

    # ─────────────────────────────────────────────
    # FORECASTING
    # ─────────────────────────────────────────────
    def _run_forecasting(
        self,
        df: pd.DataFrame,
        target_column: str,
        config: Dict[str, Any],
    ) -> Dict[str, Any]:
        try:
            from prophet import Prophet
        except ImportError:
            return {
                "error": "Prophet not installed. Run: pip install prophet",
                "metrics": {},
                "feature_importance": {},
                "shap_values": {},
                "predictions_data": [],
                "forecast_data": [],
            }

        date_cols = [
            c for c in df.columns
            if "date" in c.lower() or "time" in c.lower() or c.lower() == "ds"
        ]

        if not date_cols:
            logger.warning("No date column found; generating synthetic date range.")
            df = df.copy()
            df["ds"] = pd.date_range(start="2023-01-01", periods=len(df), freq="D")
            ds_col = "ds"
        else:
            ds_col = date_cols[0]

        if target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' not found for forecasting.")

        prophet_df = (
            df[[ds_col, target_column]]
            .rename(columns={ds_col: "ds", target_column: "y"})
            .copy()
        )
        prophet_df["ds"] = pd.to_datetime(prophet_df["ds"], errors="coerce")
        prophet_df["y"] = pd.to_numeric(prophet_df["y"], errors="coerce")
        prophet_df = prophet_df.dropna().sort_values("ds").reset_index(drop=True)

        if len(prophet_df) < 10:
            raise ValueError(
                f"Need at least 10 valid rows for forecasting, got {len(prophet_df)}. "
                "Check that your date and target columns have valid data."
            )

        m = Prophet(yearly_seasonality=True, weekly_seasonality=True)
        m.fit(prophet_df)

        periods = int(config.get("forecast_periods", 30))
        future = m.make_future_dataframe(periods=periods)
        forecast = m.predict(future)

        forecast_data = (
            forecast[["ds", "yhat", "yhat_lower", "yhat_upper"]]
            .tail(periods)
            .copy()
        )
        forecast_data["ds"] = forecast_data["ds"].astype(str)
        forecast_records = forecast_data.to_dict(orient="records")

        historical = prophet_df.tail(100).copy()
        historical["ds"] = historical["ds"].astype(str)
        historical_records = historical.to_dict(orient="records")

        predicted_train = m.predict(prophet_df[["ds"]])["yhat"].values
        mae = float(np.mean(np.abs(prophet_df["y"].values - predicted_train)))

        return {
            "metrics": {
                "mae": round(mae, 4),
                "periods_forecasted": periods,
            },
            "feature_importance": {},
            "shap_values": {},
            "predictions_data": historical_records,
            "forecast_data": forecast_records,
        }

    # ─────────────────────────────────────────────
    # HELPERS
    # ─────────────────────────────────────────────
    def _get_feature_importance(
        self, model: Any, feature_names: List[str]
    ) -> Dict[str, float]:
        try:
            if hasattr(model, "feature_importances_"):
                fi = dict(zip(feature_names, model.feature_importances_.tolist()))
                return {
                    k: round(float(v), 6)
                    for k, v in sorted(fi.items(), key=lambda x: -x[1])[:20]
                }
        except Exception as e:
            logger.warning("Feature importance extraction failed: %s", e)
        return {}

    def _get_shap(self, model: Any, X: pd.DataFrame) -> Dict[str, float]:
        try:
            explainer = shap.TreeExplainer(model)
            shap_values = explainer.shap_values(X.iloc[:50])
            if isinstance(shap_values, list):
                shap_values = shap_values[0]
            mean_shap = np.abs(shap_values).mean(axis=0)
            return {col: round(float(v), 6) for col, v in zip(X.columns, mean_shap)}
        except Exception as e:
            logger.warning("SHAP extraction failed: %s", e)
            return {}


ml_engine = MLEngine()