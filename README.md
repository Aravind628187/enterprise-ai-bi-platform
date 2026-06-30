# Enterprise AI Business Intelligence Platform

A production-ready, full-stack AI-powered BI platform built with FastAPI, React, and cutting-edge ML.

---

## 🚀 Quick Start (Docker — Recommended)

```bash
# 1. Clone / extract the project
cd enterprise-ai-bi-platform

# 2. Copy environment files
cp backend/.env.example backend/.env
# Edit backend/.env and add your OPENAI_API_KEY or GEMINI_API_KEY (optional)

# 3. Start everything
docker compose up --build

# 4. Open the app
# Frontend → http://localhost:3000
# API Docs  → http://localhost:8000/api/v1/docs
```

Default credentials seeded automatically:
| Role    | Email                      | Password    |
|---------|----------------------------|-------------|
| Admin   | admin@enterprise.com       | admin123!   |
| Analyst | analyst@enterprise.com     | analyst123! |
| Viewer  | viewer@enterprise.com      | viewer123!  |

---

## 🛠 Manual Setup (Without Docker)

### Prerequisites
- Python 3.12+
- Node.js 20+
- PostgreSQL 14+
- Redis 7+

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # edit DATABASE_URL, REDIS_URL, etc.
alembic upgrade head
python scripts/seed.py
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                       # Opens at http://localhost:5173
```

---

## 📁 Project Structure

```
enterprise-ai-bi-platform/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/    # REST API routes
│   │   ├── core/                # Config, security, database, redis
│   │   ├── models/              # SQLAlchemy ORM models
│   │   ├── schemas/             # Pydantic schemas
│   │   └── ml/                  # AI/ML engines
│   ├── alembic/                 # Database migrations
│   ├── scripts/                 # Seed & utility scripts
│   ├── tests/                   # Pytest test suite
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/          # Reusable React components
│   │   ├── pages/               # All pages (20+)
│   │   ├── lib/                 # API client
│   │   └── store/               # Zustand state management
│   └── package.json
├── datasets/                    # Sample datasets
├── docker-compose.yml
└── README.md
```

---

## ✨ Features

### AI / ML
- **AutoML Pipeline** — XGBoost, LightGBM, Random Forest with automatic model selection
- **Forecasting** — Prophet time-series forecasting with confidence intervals
- **Clustering** — K-Means with silhouette scoring
- **SHAP Explainability** — Feature importance visualizations
- **AI Chat** — Natural language dataset analysis via GPT-4 / Gemini
- **Anomaly Detection** — Isolation Forest outlier detection
- **Data Quality Scoring** — Automated completeness and duplication checks
- **Auto KPI Detection** — Smart identification of business metrics

### Platform
- **Authentication** — JWT + refresh tokens + RBAC (Admin / Manager / Analyst / Viewer)
- **Dataset Management** — Upload CSV, Excel, JSON up to 100MB
- **Interactive Charts** — Line, Bar, Area, Pie, Heatmap, Correlation Matrix
- **Report Generation** — PDF, CSV, Excel with AI summaries
- **Real-time Notifications** — In-app notification system
- **Admin Dashboard** — User management, audit logs, platform stats
- **Dark Mode UI** — Glassmorphism design with Framer Motion animations

---

## 🔑 Environment Variables

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/enterprise_bi
DATABASE_URL_SYNC=postgresql://postgres:postgres@localhost:5432/enterprise_bi
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your-secret-key-min-32-chars
OPENAI_API_KEY=sk-...          # Optional: enables GPT-4 AI chat
GEMINI_API_KEY=...             # Optional: enables Gemini AI chat
```

---

## 🧪 Running Tests

```bash
cd backend
pip install aiosqlite pytest-anyio
pytest tests/ -v --cov=app
```

---

## 🐳 Production Deployment

```bash
# Build images
docker compose -f docker-compose.yml up --build -d

# Scale workers
docker compose up --scale celery=3 -d
```

### Cloud Platforms
- **Railway**: Connect repo → set env vars → deploy
- **Render**: Web Service for backend, Static Site for frontend
- **AWS**: Use ECS + RDS + ElastiCache

---

## 📡 API Documentation

Interactive Swagger UI: `http://localhost:8000/api/v1/docs`

Key endpoints:
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
GET    /api/v1/datasets/
POST   /api/v1/datasets/upload
GET    /api/v1/analytics/dashboard
GET    /api/v1/analytics/insights/{dataset_id}
GET    /api/v1/analytics/kpis/{dataset_id}
GET    /api/v1/analytics/charts/{dataset_id}
GET    /api/v1/analytics/correlation/{dataset_id}
POST   /api/v1/predictions/
POST   /api/v1/chat/
POST   /api/v1/reports/
GET    /api/v1/admin/stats
```

---

## 🏗 Architecture

```
┌─────────────┐     ┌────────────────┐     ┌──────────┐
│   React UI  │────▶│  FastAPI REST  │────▶│ PostgreSQL│
│  (Vite+TS)  │     │   + WebSockets │     └──────────┘
└─────────────┘     └────────────────┘
                            │              ┌──────────┐
                            ├─────────────▶│  Redis   │
                            │              └──────────┘
                            │              ┌──────────┐
                            └─────────────▶│ ML Engine│
                                           │ XGBoost  │
                                           │ Prophet  │
                                           │ LightGBM │
                                           └──────────┘
```

---

## 📊 Sample Dataset

A sample sales dataset is included at `datasets/sample_sales.csv` with 50 rows covering:
- Date, Product, Category, Region
- Sales, Quantity, Profit, Discount
- Customer Age, Customer Satisfaction Score

Upload it via the **Upload Data** page to immediately explore all features.

---

## License

MIT
