"""
SCRB Crime Analytics Platform — FastAPI Backend
Run: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import anthropic
import json
import os

app = FastAPI(title="SCRB Crime Analytics API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── LOAD PRE-PROCESSED DATA ──────────────────────────────────────────────────
DATA_PATH = os.path.join(os.path.dirname(__file__), "../src/data/crimes.json")
_data = None

def load_data():
    global _data
    if _data is not None:
        return
    if os.path.exists(DATA_PATH):
        with open(DATA_PATH) as f:
            _data = json.load(f)
        print(f"✅ crimes.json loaded")
    else:
        _data = {}
        print("⚠️ crimes.json not found — using empty data")

@app.on_event("startup")
async def startup():
    load_data()

# ─── SCHEMAS ──────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[dict]] = []
    language: Optional[str] = "en"

# ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
def build_system_prompt() -> str:
    d = _data or {}
    total = sum(x.get("total", 0) for x in d.get("dist_total", []))
    top_districts = ", ".join(
        x.get("District_Name", x.get("district", ""))
        for x in d.get("dist_total", [])[:10]
    )
    top_crimes = ", ".join(
        x.get("crime", "") for x in d.get("top_crimes", [])[:8]
    )
    yearly = ", ".join(
        f"{x.get('FIR_YEAR')}: {x.get('count')}"
        for x in d.get("yearly_total", [])
    )

    return f"""You are SCRB-AI, an intelligent crime analytics assistant for the
State Crime Records Bureau (SCRB) of Karnataka, India.

REAL DATABASE SUMMARY:
- Total FIRs: {total:,}
- Top districts: {top_districts}
- Top crime categories: {top_crimes}
- Year-wise FIR counts: {yearly}
- Data range: 2016 to 2023
- Total districts covered: 41

YOUR ROLE:
Help police investigators and analysts with:
1. Natural language crime data queries
2. Pattern detection and trend analysis
3. District-level comparisons
4. Predictive risk insights
5. Bilingual support — English and Kannada

RESPONSE STYLE:
- Always cite specific numbers from the data
- Be concise and factual
- For Kannada queries, respond in English but acknowledge the Kannada input
- Flag data limitations honestly"""

# ─── ROUTES ───────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "status": "SCRB Analytics API running",
        "version": "1.0.0",
        "endpoints": [
            "/api/summary",
            "/api/district-stats",
            "/api/yearly-trend",
            "/api/crime-groups",
            "/api/hotspots",
            "/api/monthly",
            "/api/predict",
            "/api/chat",
            "/api/districts",
            "/api/network",
        ]
    }

@app.get("/api/summary")
def get_summary():
    d = _data or {}
    total = sum(x.get("total", 0) for x in d.get("dist_total", []))
    return {
        "total_firs": total,
        "districts": len(d.get("fir_districts", [])),
        "crime_groups": len(d.get("crime_groups", [])),
        "years": list(range(2016, 2024)),
        "last_updated": datetime.now().isoformat(),
    }

@app.get("/api/district-stats")
def district_stats(year: Optional[int] = None):
    d = _data or {}
    result = d.get("dist_total", [])
    return result[:20]

@app.get("/api/yearly-trend")
def yearly_trend(district: Optional[str] = None):
    d = _data or {}
    if district:
        return [
            {"year": x["FIR_YEAR"], "count": x["count"]}
            for x in d.get("yearly_by_district", [])
            if x.get("District_Name") == district
        ]
    return [
        {"year": x["FIR_YEAR"], "count": x["count"]}
        for x in d.get("yearly_total", [])
    ]

@app.get("/api/crime-groups")
def crime_groups(top_n: int = 10):
    d = _data or {}
    return d.get("top_crimes", [])[:top_n]

@app.get("/api/hotspots")
def hotspots(limit: int = 300):
    d = _data or {}
    return d.get("fir_points", [])[:limit]

@app.get("/api/monthly")
def monthly_trend(year: Optional[int] = None):
    d = _data or {}
    data = d.get("monthly_by_year", [])
    if year:
        data = [x for x in data if x.get("FIR_YEAR") == year]
    return data

@app.get("/api/predict")
def predict_risk(district: str):
    d = _data or {}
    yearly = [
        x for x in d.get("yearly_by_district", [])
        if x.get("District_Name") == district
    ]
    if not yearly:
        raise HTTPException(status_code=404, detail=f"District '{district}' not found")

    counts = [x["count"] for x in sorted(yearly, key=lambda x: x["FIR_YEAR"])]
    trend = ((counts[-1] - counts[0]) / max(counts[0], 1)) if len(counts) >= 2 else 0
    risk_label = "High" if trend > 0.1 else "Medium" if trend > -0.1 else "Low"
    risk_color = {"High": "#ef4444", "Medium": "#f59e0b", "Low": "#10b981"}[risk_label]

    return {
        "district": district,
        "yearly_counts": {x["FIR_YEAR"]: x["count"] for x in yearly},
        "trend_pct": round(trend * 100, 2),
        "risk_level": risk_label,
        "risk_color": risk_color,
    }

@app.post("/api/chat")
async def chat(req: ChatRequest):
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=501, detail="ANTHROPIC_API_KEY not set")

    client = anthropic.Anthropic(api_key=api_key)
    history = req.conversation_history or []
    history.append({"role": "user", "content": req.message})

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        system=build_system_prompt(),
        messages=history,
    )
    return {
        "reply": response.content[0].text,
        "timestamp": datetime.now().isoformat(),
        "model": "claude-sonnet-4-6",
    }

@app.get("/api/districts")
def list_districts():
    d = _data or {}
    return sorted(d.get("fir_districts", []))

@app.get("/api/crime-group-list")
def list_crime_groups():
    d = _data or {}
    return sorted(d.get("crime_groups", []))

@app.get("/api/network")
def crime_network():
    d = _data or {}
    crimes = d.get("top_crimes", [])[:10]
    nodes = [{"id": c["crime"], "count": c["count"]} for c in crimes]
    edges = []
    for i in range(len(nodes)):
        for j in range(i + 1, min(i + 3, len(nodes))):
            edges.append({
                "source": nodes[i]["id"],
                "target": nodes[j]["id"],
                "weight": abs(nodes[i]["count"] - nodes[j]["count"])
            })
    return {"nodes": nodes, "edges": edges}
