"""
SCRB Crime Analytics Platform — FastAPI Backend
Run: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List
import pandas as pd
import json
import os
import zipfile
from datetime import datetime, timedelta
import anthropic

app = FastAPI(title="SCRB Crime Analytics API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer(auto_error=False)

# ─── DATA LOADING ─────────────────────────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(__file__), "../data")

_fir_df = None
_crime_df = None
_review_df = None
_model_df = None


def load_data():
    global _fir_df, _crime_df, _review_df, _model_df
    if _fir_df is not None:
        return

    # Load FIR data (from zip)
    fir_zip = os.path.join(DATA_DIR, "archive__4_.zip")
    if os.path.exists(fir_zip):
        with zipfile.ZipFile(fir_zip) as zf:
            with zf.open(zf.namelist()[0]) as f:
                _fir_df = pd.read_csv(f, low_memory=False)
        print(f"✅ FIR data loaded: {len(_fir_df):,} rows")
    else:
        _fir_df = pd.DataFrame()

    # Crime summary
    crime_csv = os.path.join(DATA_DIR, "Crime_Data.csv")
    if os.path.exists(crime_csv):
        _crime_df = pd.read_csv(crime_csv)

    # Crime review
    review_csv = os.path.join(DATA_DIR, "crime_review.csv")
    if os.path.exists(review_csv):
        _review_df = pd.read_csv(review_csv)

    # Model ready
    model_csv = os.path.join(DATA_DIR, "karnataka_model_ready.csv")
    if os.path.exists(model_csv):
        _model_df = pd.read_csv(model_csv)


@app.on_event("startup")
async def startup():
    load_data()


# ─── SCHEMAS ──────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[dict]] = []
    language: Optional[str] = "en"


class FilterParams(BaseModel):
    district: Optional[str] = None
    year: Optional[int] = None
    crime_group: Optional[str] = None
    month: Optional[int] = None


# ─── HELPERS ──────────────────────────────────────────────────────────────────
def get_fir() -> pd.DataFrame:
    if _fir_df is None or _fir_df.empty:
        raise HTTPException(status_code=503, detail="FIR data not loaded")
    return _fir_df


def build_system_prompt(fir: pd.DataFrame) -> str:
    total = len(fir)
    districts = fir["District_Name"].dropna().unique().tolist()[:10]
    crime_groups = fir["CrimeGroup_Name"].dropna().unique().tolist()[:15]
    yr_counts = fir.groupby("FIR_YEAR").size().to_dict()

    return f"""You are SCRB-AI, an intelligent crime analytics assistant for the 
State Crime Records Bureau (SCRB) of Karnataka, India.

REAL DATABASE SUMMARY:
- Total FIRs: {total:,}
- Districts: {', '.join(districts)}
- Crime categories: {', '.join(crime_groups[:10])}
- Year-wise counts: {yr_counts}

You help investigators with:
1. Natural language crime data queries
2. Pattern detection and trend analysis
3. District comparisons
4. Predictive risk insights
5. Kannada/English bilingual support

Be concise, cite specific numbers, and flag data limitations honestly."""


# ─── ROUTES ───────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "SCRB Analytics API running", "version": "1.0.0"}


@app.get("/api/summary")
def get_summary():
    """High-level stats for dashboard"""
    fir = get_fir()
    return {
        "total_firs": int(len(fir)),
        "districts": int(fir["District_Name"].nunique()),
        "crime_groups": int(fir["CrimeGroup_Name"].nunique()),
        "years": sorted(fir["FIR_YEAR"].dropna().unique().astype(int).tolist()),
        "last_updated": datetime.now().isoformat(),
    }


@app.get("/api/district-stats")
def district_stats(year: Optional[int] = None, crime_group: Optional[str] = None):
    """FIR counts grouped by district"""
    fir = get_fir()
    if year:
        fir = fir[fir["FIR_YEAR"] == year]
    if crime_group:
        fir = fir[fir["CrimeGroup_Name"] == crime_group]

    result = (
        fir.groupby("District_Name")
        .agg(
            total=("District_Name", "count"),
            victims=("VICTIM COUNT", "sum"),
            accused=("Accused Count", "sum"),
        )
        .reset_index()
        .sort_values("total", ascending=False)
    )
    return result.fillna(0).to_dict("records")


@app.get("/api/yearly-trend")
def yearly_trend(district: Optional[str] = None):
    """Year-wise FIR trend"""
    fir = get_fir()
    if district:
        fir = fir[fir["District_Name"] == district]
    result = (
        fir.groupby("FIR_YEAR")
        .size()
        .reset_index(name="count")
        .rename(columns={"FIR_YEAR": "year"})
    )
    result = result[result["year"].between(2016, 2024)]
    return result.to_dict("records")


@app.get("/api/crime-groups")
def crime_groups(district: Optional[str] = None, year: Optional[int] = None, top_n: int = 10):
    """Top crime categories"""
    fir = get_fir()
    if district:
        fir = fir[fir["District_Name"] == district]
    if year:
        fir = fir[fir["FIR_YEAR"] == year]
    result = (
        fir["CrimeGroup_Name"]
        .value_counts()
        .head(top_n)
        .reset_index()
    )
    result.columns = ["crime", "count"]
    return result.to_dict("records")


@app.get("/api/hotspots")
def hotspots(year: Optional[int] = None, crime_group: Optional[str] = None, limit: int = 500):
    """FIR lat/lon points for map"""
    fir = get_fir()
    if year:
        fir = fir[fir["FIR_YEAR"] == year]
    if crime_group:
        fir = fir[fir["CrimeGroup_Name"] == crime_group]

    points = fir.dropna(subset=["Latitude", "Longitude"])[
        ["District_Name", "CrimeGroup_Name", "Latitude", "Longitude", "FIR_YEAR", "Beat_Name", "VICTIM COUNT"]
    ].head(limit)
    return points.to_dict("records")


@app.get("/api/monthly")
def monthly_trend(year: Optional[int] = None, district: Optional[str] = None):
    """Monthly FIR distribution"""
    fir = get_fir()
    if year:
        fir = fir[fir["FIR_YEAR"] == year]
    if district:
        fir = fir[fir["District_Name"] == district]

    result = (
        fir.groupby(["FIR_YEAR", "FIR_MONTH"])
        .size()
        .reset_index(name="count")
        .rename(columns={"FIR_YEAR": "year", "FIR_MONTH": "month"})
    )
    return result.to_dict("records")


@app.get("/api/predict")
def predict_risk(district: str):
    """Return model-based risk scores for a district"""
    if _model_df is None:
        raise HTTPException(status_code=503, detail="Model data not loaded")

    fir = get_fir()
    dist_data = fir[fir["District_Name"] == district]
    if dist_data.empty:
        raise HTTPException(status_code=404, detail=f"District '{district}' not found")

    yearly = dist_data.groupby("FIR_YEAR").size().to_dict()
    values = list(yearly.values())
    trend = ((values[-1] - values[0]) / max(values[0], 1)) if len(values) >= 2 else 0

    risk_label = "High" if trend > 0.1 else "Medium" if trend > -0.1 else "Low"
    risk_color = {"High": "#ef4444", "Medium": "#f59e0b", "Low": "#10b981"}[risk_label]

    return {
        "district": district,
        "yearly_counts": yearly,
        "trend_pct": round(trend * 100, 2),
        "risk_level": risk_label,
        "risk_color": risk_color,
        "total_firs": int(len(dist_data)),
        "top_crimes": dist_data["CrimeGroup_Name"].value_counts().head(5).to_dict(),
    }


@app.post("/api/chat")
async def chat(req: ChatRequest):
    """NL chatbot powered by Claude"""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=501, detail="ANTHROPIC_API_KEY not set")

    fir = get_fir()
    client = anthropic.Anthropic(api_key=api_key)

    history = req.conversation_history or []
    history.append({"role": "user", "content": req.message})

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        system=build_system_prompt(fir),
        messages=history,
    )
    reply = response.content[0].text
    return {
        "reply": reply,
        "timestamp": datetime.now().isoformat(),
        "model": "claude-sonnet-4-6",
    }


@app.get("/api/districts")
def list_districts():
    fir = get_fir()
    return sorted(fir["District_Name"].dropna().unique().tolist())


@app.get("/api/crime-group-list")
def list_crime_groups():
    fir = get_fir()
    return sorted(fir["CrimeGroup_Name"].dropna().unique().tolist())


@app.get("/api/network")
def crime_network(district: Optional[str] = None, year: Optional[int] = None):
    """Co-occurrence network data"""
    fir = get_fir()
    if district:
        fir = fir[fir["District_Name"] == district]
    if year:
        fir = fir[fir["FIR_YEAR"] == year]

    top_crimes = fir["CrimeGroup_Name"].value_counts().head(10).index.tolist()
    fir_top = fir[fir["CrimeGroup_Name"].isin(top_crimes)]

    # Build co-occurrence by Beat
    beat_crimes = fir_top.groupby("Beat_Name")["CrimeGroup_Name"].apply(list)
    cooccur = {}
    for crimes_in_beat in beat_crimes:
        unique_crimes = list(set(crimes_in_beat))
        for i, c1 in enumerate(unique_crimes):
            for c2 in unique_crimes[i + 1:]:
                key = tuple(sorted([c1, c2]))
                cooccur[key] = cooccur.get(key, 0) + 1

    edges = [{"source": k[0], "target": k[1], "weight": v}
             for k, v in sorted(cooccur.items(), key=lambda x: -x[1])[:30]]
    nodes = [{"id": c, "count": int(fir_top[fir_top["CrimeGroup_Name"] == c].shape[0])}
             for c in top_crimes]

    return {"nodes": nodes, "edges": edges}
