SCRB Crime Analytics Platform — Setup Guide
Folder Structure
```
scrb-demo/
├── public/
│   ├── index.html
│   └── karnataka.geojson       ← Your GeoJSON file here
├── src/
│   ├── App.jsx                 ← Full React app (5 pages)
│   ├── index.js
│   └── data/
│       └── crimes.json         ← Pre-processed data (auto-generated)
├── backend/
│   ├── main.py                 ← FastAPI backend
│   └── requirements.txt
├── data/                       ← Put your raw data files here
│   ├── archive__4_.zip         ← FIR data (1.6M rows)
│   ├── archive__5_.zip         ← NCRB demographics
│   ├── archive__6_.zip         ← Census 2011
│   ├── Crime_Data.csv
│   ├── crime_review.csv
│   └── karnataka_model_ready.csv
└── package.json
```
---
Step 1 — Install Node dependencies
```bash
cd scrb-demo
npm install
```
Step 2 — Start React frontend
```bash
npm start
# Opens at http://localhost:3000
```
Step 3 — Start FastAPI backend (optional, for live API)
```bash
cd backend
pip install -r requirements.txt
ANTHROPIC_API_KEY=sk-ant-... uvicorn main:app --reload --port 8000
```
Step 4 — Connect Claude API in chatbot (optional)
Open the app → AI Chatbot page
Click "Connect Claude API"
Paste your `sk-ant-...` key
Full AI mode activates (demo mode works without a key)
---
Pages & Features
Page	What it shows
Dashboard	Stats overview, trend charts, top crimes, district bar chart
AI Chatbot	NL query bot (demo mode or full Claude API), PDF export
Hotspot map	Leaflet choropleth + individual FIR points on Karnataka map
Analytics	District filter, year filter, multi-year monthly comparison, ML risk scores
Network	Canvas-based crime co-occurrence network visualization
---
Tech Stack
Layer	Technology
Frontend	React 18 + Recharts + Leaflet
Backend	FastAPI (Python)
AI	Claude claude-sonnet-4-6 via Anthropic API
Maps	Leaflet + CartoDB dark tiles + GeoJSON
Data	Pandas (ETL), pre-processed JSON for frontend
PDF export	jsPDF
---
Environment Variables (backend)
```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
```
---
Hackathon Demo Tips
The app works fully in demo mode without any API key
Click quick-question chips in chatbot for instant impressive answers
The hotspot map loads instantly from pre-processed JSON
PDF export works in the chatbot page
For judges: explain the 7-dataset architecture (shown in architecture diagram)
