# 🛡️ SCRB Crime Analytics Platform
### Intelligent Conversational AI for Karnataka Crime Data

> Built for the State Crime Records Bureau (SCRB) — Karnataka
> Transforming 1.6M+ FIR records into actionable intelligence

---

## 🎯 Problem Statement

Karnataka's 1100+ police stations generate massive crime data daily.
Current systems rely on **static dashboards and manual queries** — limiting
deep analysis, pattern discovery, and real-time insights for investigators.

---

## 💡 Solution

An intelligent conversational AI platform enabling investigators to query
crime data using **natural language**, uncover hidden patterns, and get
predictive insights — in English or Kannada.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🤖 AI Chatbot | Natural language queries in English + Kannada |
| 🗺️ Hotspot Map | Real FIR GPS points + district crime density |
| 📈 Predictive Analytics | District-level risk scores using ML |
| 🕸️ Criminal Network | Co-accused relationship graph from FIR data |
| 📄 PDF Export | Download full conversation as report |
| 🔐 Role-based Access | Analyst / Officer / Admin views |

---

## 📦 Dataset Used

| # | Dataset | Source | Purpose |
|---|---|---|---|
| 1 | Crime_Data.csv | SCRB | Crime type & monthly counts |
| 2 | crime_review.csv | SCRB | Year-on-year comparisons |
| 3 | karnataka_model_ready.csv | SCRB | ML-ready district features |
| 4 | FIR Details (1.6M rows) | Kaggle | Core case-level records |
| 5 | NCRB Crime in India | Kaggle | Demographics & victim data |
| 6 | Karnataka Districts GeoJSON | GitHub (DataMeet) | Map visualization |
| 7 | India Census 2011 | Kaggle | Socio-economic overlay |

---

## 🛠️ Tech Stack

### Frontend
- React 18
- Recharts (data visualization)
- Leaflet (interactive maps)
- jsPDF (PDF export)

### Backend
- FastAPI (Python)
- Pandas + GeoPandas (data processing)
- PostgreSQL + PostGIS (storage)

### AI / ML
- Claude API — claude-sonnet-4-6 (NL chatbot)
- XGBoost / LSTM (crime prediction)
- DBSCAN (hotspot clustering)
- NetworkX (criminal network graph)
- SHAP (explainable AI)

### Voice & Language
- Whisper STT (voice input)
- English + Kannada support

---

## 🏗️ Architecture
