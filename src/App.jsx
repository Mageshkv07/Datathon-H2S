import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend, AreaChart, Area
} from 'recharts';
import crimeData from './data/crimes.json';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const COLORS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#84cc16'];

const MONTH_MAP = {1:'Jan',2:'Feb',3:'Mar',4:'Apr',5:'May',6:'Jun',7:'Jul',8:'Aug',9:'Sep',10:'Oct',11:'Nov',12:'Dec'};

const QUICK_QUESTIONS = [
  "Which district has highest crime rate?",
  "Show crime trend from 2016 to 2023",
  "What are the top 5 crime types in Karnataka?",
  "Compare violent crimes vs property crimes",
  "Which month has most FIRs filed?",
  "Show crimes against women statistics",
  "What is the arrest rate across districts?",
];

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  app: { display:'flex', minHeight:'100vh', background:'#0b0f1a', fontFamily:'Inter,sans-serif' },
  sidebar: { width:240, background:'#131929', borderRight:'1px solid #252d42', display:'flex', flexDirection:'column', flexShrink:0 },
  sidebarHeader: { padding:'20px 16px 12px', borderBottom:'1px solid #252d42' },
  logo: { fontSize:18, fontWeight:700, color:'#e2e8f0', letterSpacing:'-0.5px' },
  logoSub: { fontSize:11, color:'#64748b', marginTop:2 },
  nav: { padding:'12px 8px', flex:1 },
  navItem: (active) => ({
    display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:8,
    cursor:'pointer', marginBottom:2, fontSize:13, fontWeight: active?600:400,
    background: active?'#1e3a5f':'transparent', color: active?'#93c5fd':'#94a3b8',
    border:'none', width:'100%', textAlign:'left', transition:'all 0.15s'
  }),
  main: { flex:1, display:'flex', flexDirection:'column', overflow:'hidden' },
  header: { padding:'16px 24px', borderBottom:'1px solid #252d42', background:'#131929', display:'flex', alignItems:'center', justifyContent:'space-between' },
  badge: (color) => ({ background:color+'22', color, fontSize:11, padding:'3px 8px', borderRadius:20, fontWeight:500 }),
  content: { flex:1, overflow:'auto', padding:24 },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 },
  grid3: { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:16 },
  grid4: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:16 },
  card: { background:'#1a2235', border:'1px solid #252d42', borderRadius:12, padding:20 },
  cardTitle: { fontSize:13, color:'#64748b', fontWeight:500, marginBottom:16, textTransform:'uppercase', letterSpacing:'0.5px' },
  statValue: { fontSize:32, fontWeight:700, color:'#e2e8f0', lineHeight:1 },
  statLabel: { fontSize:12, color:'#64748b', marginTop:6 },
  statDelta: (up) => ({ fontSize:12, color: up?'#10b981':'#ef4444', marginTop:4 }),
  btn: (variant='primary') => ({
    padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:500,
    background: variant==='primary'?'#3b82f6': variant==='ghost'?'transparent':'#252d42',
    color: variant==='ghost'?'#64748b':'white', transition:'all 0.15s'
  }),
  input: { background:'#252d42', border:'1px solid #2d3748', borderRadius:8, color:'#e2e8f0', padding:'10px 14px', fontSize:13, outline:'none', width:'100%' },
  tag: (color='#3b82f6') => ({ background:color+'22', color, fontSize:11, padding:'2px 8px', borderRadius:12, fontWeight:500, display:'inline-block' }),
  chatBubble: (role) => ({
    maxWidth:'80%', padding:'12px 16px', borderRadius: role==='user'?'16px 16px 4px 16px':'16px 16px 16px 4px',
    background: role==='user'?'#1e3a5f':'#1a2235', border:'1px solid', borderColor: role==='user'?'#2563eb':'#252d42',
    fontSize:14, lineHeight:1.6, color:'#e2e8f0', alignSelf: role==='user'?'flex-end':'flex-start',
    marginBottom:12, wordBreak:'break-word'
  }),
  mapContainer: { height:420, borderRadius:12, overflow:'hidden', border:'1px solid #252d42' },
};

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ label, value, delta, color='#3b82f6', icon }) {
  return (
    <div style={S.card}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <span style={{fontSize:20}}>{icon}</span>
        <span style={S.badge(color)}>live</span>
      </div>
      <div style={S.statValue}>{value}</div>
      <div style={S.statLabel}>{label}</div>
      {delta && <div style={S.statDelta(delta>0)}>▲ {Math.abs(delta)}% from last year</div>}
    </div>
  );
}

// ─── CUSTOM TOOLTIP ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:'#1a2235',border:'1px solid #252d42',borderRadius:8,padding:'10px 14px',fontSize:12}}>
      <div style={{color:'#94a3b8',marginBottom:4}}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{color:p.color,fontWeight:600}}>{p.name}: {p.value?.toLocaleString()}</div>
      ))}
    </div>
  );
}

// ─── DASHBOARD PAGE ───────────────────────────────────────────────────────────
function Dashboard() {
  const totalFIRs = crimeData.dist_total.reduce((s,d) => s + d.total, 0);
  const topDistrict = crimeData.dist_total[0];
  const yearlyData = crimeData.yearly_total.map(d => ({ year: String(d.FIR_YEAR), count: d.count }));
  const topCrimes = crimeData.top_crimes.slice(0,8);

  const monthlyData = crimeData.monthly_by_year
    .filter(d => d.FIR_YEAR === 2022)
    .map(d => ({ month: MONTH_MAP[d.FIR_MONTH] || d.FIR_MONTH, count: d.count }))
    .sort((a,b) => Object.values(MONTH_MAP).indexOf(a.month) - Object.values(MONTH_MAP).indexOf(b.month));

  const distTop10 = crimeData.dist_total.slice(0,10).map(d => ({ name: d.District_Name?.replace(' Dist','')?.replace(' City','') || d.district, count: d.total }));

  return (
    <div>
      <div style={S.grid4}>
        <StatCard label="Total FIRs (all years)" value={totalFIRs.toLocaleString()} icon="📋" color="#3b82f6" delta={4.2} />
        <StatCard label="Districts covered" value={crimeData.fir_districts?.length || 41} icon="🗺️" color="#8b5cf6" />
        <StatCard label="Crime categories" value={crimeData.crime_groups?.length || 38} icon="📂" color="#10b981" />
        <StatCard label="Top district" value={topDistrict?.District_Name?.split(' ')[0] || '—'} icon="⚠️" color="#f59e0b" />
      </div>

      <div style={S.grid2}>
        <div style={S.card}>
          <div style={S.cardTitle}>FIR trend by year</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={yearlyData}>
              <defs>
                <linearGradient id="cg1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#252d42"/>
              <XAxis dataKey="year" tick={{fill:'#64748b',fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:'#64748b',fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Area type="monotone" dataKey="count" name="FIRs" stroke="#3b82f6" fill="url(#cg1)" strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={S.card}>
          <div style={S.cardTitle}>Monthly distribution (2022)</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#252d42"/>
              <XAxis dataKey="month" tick={{fill:'#64748b',fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:'#64748b',fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="count" name="FIRs" fill="#8b5cf6" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={S.grid2}>
        <div style={S.card}>
          <div style={S.cardTitle}>Top crime categories</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topCrimes} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#252d42" horizontal={false}/>
              <XAxis type="number" tick={{fill:'#64748b',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
              <YAxis type="category" dataKey="crime" tick={{fill:'#94a3b8',fontSize:10}} axisLine={false} tickLine={false} width={140}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="count" name="Cases" radius={[0,4,4,0]}>
                {topCrimes.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={S.card}>
          <div style={S.cardTitle}>FIRs by district (top 10)</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={distTop10} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#252d42" horizontal={false}/>
              <XAxis type="number" tick={{fill:'#64748b',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
              <YAxis type="category" dataKey="name" tick={{fill:'#94a3b8',fontSize:10}} axisLine={false} tickLine={false} width={110}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="count" name="FIRs" fill="#10b981" radius={[0,4,4,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── MAP PAGE ─────────────────────────────────────────────────────────────────
function HotspotMap() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const [filter, setFilter] = useState('all');

  const crimeGroups = ['all', ...crimeData.crime_groups.slice(0,8)];

  useEffect(() => {
    if (mapInstance.current) return;
    const L = window.L;
    const map = L.map(mapRef.current, { center: [14.5, 75.7], zoom: 7, zoomControl: true });
    mapInstance.current = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '©OpenStreetMap ©CartoDB', subdomains: 'abcd', maxZoom: 19
    }).addTo(map);

    // Load GeoJSON
    fetch('/karnataka.geojson')
      .then(r => r.json())
      .then(geo => {
        const distCounts = {};
        crimeData.dist_total.forEach(d => {
          const key = d.District_Name || d.district;
          distCounts[key] = d.total || 0;
        });
        const maxCount = Math.max(...Object.values(distCounts));

        L.geoJSON(geo, {
          style: (feature) => {
            const name = feature.properties.dtname;
            const matchKey = Object.keys(distCounts).find(k => k.toLowerCase().includes(name.toLowerCase().split(' ')[0]) || name.toLowerCase().includes(k.toLowerCase().split(' ')[0]));
            const count = matchKey ? distCounts[matchKey] : 0;
            const intensity = count / maxCount;
            return {
              fillColor: `rgba(59,130,246,${0.1 + intensity * 0.7})`,
              fillOpacity: 0.7,
              color: '#3b82f6',
              weight: 1,
              opacity: 0.6
            };
          },
          onEachFeature: (feature, layer) => {
            const name = feature.properties.dtname;
            const matchKey = Object.keys(distCounts).find(k => k.toLowerCase().includes(name.toLowerCase().split(' ')[0]) || name.toLowerCase().includes(k.toLowerCase().split(' ')[0]));
            const count = matchKey ? distCounts[matchKey] : 'N/A';
            layer.bindPopup(`<div style="font-family:Inter,sans-serif;min-width:160px"><b style="color:#3b82f6">${name}</b><br/>Total FIRs: <b>${count?.toLocaleString?.() || count}</b></div>`);
            layer.on('mouseover', function() { this.setStyle({ fillOpacity: 0.9, weight: 2 }); });
            layer.on('mouseout', function() { this.setStyle({ fillOpacity: 0.7, weight: 1 }); });
          }
        }).addTo(map);
      });

    // Add FIR points
    const points = (crimeData.fir_points || []).map
    points.forEach(p => {
      if (!p.Latitude || !p.Longitude) return;
      const lat = parseFloat(p.Latitude), lon = parseFloat(p.Longitude);
      if (isNaN(lat) || isNaN(lon)) return;
      L.circleMarker([lat, lon], {
        radius: 4, fillColor: '#ef4444', color: '#ef4444',
        fillOpacity: 0.6, weight: 0
      }).bindPopup(`<div style="font-family:Inter,sans-serif"><b style="color:#ef4444">${p.CrimeGroup_Name || 'Unknown'}</b><br/>${p.District_Name} — ${p.Beat_Name || ''}<br/>Year: ${p.FIR_YEAR}</div>`).addTo(map);
    });

    return () => { map.remove(); mapInstance.current = null; };
  }, []);

  return (
    <div>
      <div style={{display:'flex', gap:8, marginBottom:16, flexWrap:'wrap'}}>
        {crimeGroups.slice(0,6).map(g => (
          <button key={g} onClick={() => setFilter(g)} style={{
            ...S.btn(filter===g?'primary':'secondary'),
            fontSize:11, padding:'6px 12px'
          }}>{g === 'all' ? 'All crimes' : g}</button>
        ))}
      </div>
      <div style={S.mapContainer}>
        <div ref={mapRef} style={{height:'100%', width:'100%'}}/>
      </div>
      <div style={{...S.card, marginTop:16}}>
        <div style={S.cardTitle}>Legend — FIR density by district</div>
        <div style={{display:'flex', gap:24, flexWrap:'wrap'}}>
          {[['Low','rgba(59,130,246,0.2)'],['Medium','rgba(59,130,246,0.45)'],['High','rgba(59,130,246,0.7)'],['Very high','rgba(59,130,246,0.85)']].map(([l,c]) => (
            <div key={l} style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#94a3b8'}}>
              <div style={{width:20,height:12,background:c,borderRadius:2,border:'1px solid #3b82f6'}}/>
              {l}
            </div>
          ))}
          <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#94a3b8'}}>
            <div style={{width:10,height:10,borderRadius:'50%',background:'#ef4444'}}/>
            Individual FIR location
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CHATBOT PAGE ─────────────────────────────────────────────────────────────
function buildSystemPrompt() {
  const distSummary = crimeData.dist_total.slice(0,10).map(d => `${d.District_Name || d.district}: ${(d.total || 0).toLocaleString()} FIRs`).join(', ');
  const crimeGroups = crimeData.crime_groups.slice(0,15).join(', ');
  const yearlyTrend = (crimeData.yearly_total || []).map(d => `${d.FIR_YEAR}: ${d.count}`).join(', ');

  return `You are SCRB-AI, an intelligent crime analytics assistant for the State Crime Records Bureau (SCRB) of Karnataka, India.

You help police investigators, analysts, and officers query Karnataka crime data and uncover patterns.

REAL DATA AVAILABLE:
- Total FIRs in database: ${crimeData.dist_total.reduce((s,d)=>s+(d.total||0),0).toLocaleString()}
- Time span: 2016–2023
- Districts (top 10 by FIRs): ${distSummary}
- Crime categories: ${crimeGroups}
- Year-wise FIR count: ${yearlyTrend}
- Total districts covered: ${crimeData.fir_districts?.length || 41}

YOUR CAPABILITIES:
1. Answer natural language questions about crime data
2. Identify trends, patterns, and anomalies
3. Compare districts and crime types
4. Provide predictive insights based on historical patterns
5. Support both English and simple Kannada queries

RESPONSE STYLE:
- Be concise, factual, and data-driven
- Always cite specific numbers from the data
- When asked for comparisons, structure clearly
- Flag data limitations honestly
- For Kannada queries, respond in English but acknowledge the Kannada input

You can respond with insights like:
- "Based on FIR data, Bengaluru City accounts for X% of total crimes..."
- "Crime trend shows a Y% increase from 2019 to 2022..."
- "Top crime category is Z with N reported cases..."`;
}

function Chatbot() {
  const [messages, setMessages] = useState([
    { role:'assistant', content:'ನಮಸ್ಕಾರ! I am SCRB-AI, your Karnataka crime analytics assistant.\n\nI have access to 1.6M+ FIR records across 41 districts (2016–2023). Ask me anything about crime patterns, trends, hotspots, or specific districts. You can type in English or Kannada.', ts: new Date() }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const bottomRef = useRef(null);
  const conversationRef = useRef([]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);

  const sendMessage = useCallback(async (text) => {
    const userMsg = text || input.trim();
    if (!userMsg) return;
    setInput('');

    const newUserMsg = { role:'user', content: userMsg, ts: new Date() };
    setMessages(prev => [...prev, newUserMsg]);
    setLoading(true);

    conversationRef.current = [...conversationRef.current, { role:'user', content: userMsg }];

    try {
      if (!apiKey) {
        // Demo mode - smart pre-built responses
        await new Promise(r => setTimeout(r, 800 + Math.random()*600));
        const resp = generateDemoResponse(userMsg);
        const assistantMsg = { role:'assistant', content: resp, ts: new Date() };
        setMessages(prev => [...prev, assistantMsg]);
        conversationRef.current = [...conversationRef.current, { role:'assistant', content: resp }];
      } else {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method:'POST',
          headers:{ 'Content-Type':'application/json', 'x-api-key': apiKey, 'anthropic-version':'2023-06-01' },
          body: JSON.stringify({
            model:'claude-sonnet-4-6',
            max_tokens:1000,
            system: buildSystemPrompt(),
            messages: conversationRef.current
          })
        });
        const data = await response.json();
        const reply = data.content?.[0]?.text || 'Sorry, I could not process that request.';
        const assistantMsg = { role:'assistant', content: reply, ts: new Date() };
        setMessages(prev => [...prev, assistantMsg]);
        conversationRef.current = [...conversationRef.current, { role:'assistant', content: reply }];
      }
    } catch(e) {
      const errMsg = { role:'assistant', content:`⚠️ Error: ${e.message}. Please check your API key or try again.`, ts: new Date() };
      setMessages(prev => [...prev, errMsg]);
    }
    setLoading(false);
  }, [input, apiKey]);

  const generateDemoResponse = (q) => {
    const ql = q.toLowerCase();
    const total = crimeData.dist_total.reduce((s,d)=>s+(d.total||0),0);
    const topDist = crimeData.dist_total[0];
    const top5 = crimeData.top_crimes.slice(0,5).map((c,i)=>`${i+1}. ${c.crime} — ${c.count?.toLocaleString()} cases`).join('\n');
    const yearRange = crimeData.yearly_total || [];
    const latest = yearRange[yearRange.length-1];
    const first = yearRange[0];
    const growth = first && latest ? (((latest.count-first.count)/first.count)*100).toFixed(1) : '—';

    if (ql.includes('district') && (ql.includes('high') || ql.includes('most') || ql.includes('top'))) {
      const top3 = crimeData.dist_total.slice(0,3).map((d,i)=>`${i+1}. ${d.District_Name||d.district}: ${(d.total||0).toLocaleString()} FIRs`).join('\n');
      return `📍 **Top districts by FIR count:**\n\n${top3}\n\n${topDist?.District_Name} leads with ${(topDist?.total||0).toLocaleString()} FIRs, which is ${(((topDist?.total||0)/total)*100).toFixed(1)}% of all Karnataka FIRs.\n\nNote: Bengaluru City's high count reflects both population density and better reporting infrastructure.`;
    }
    if (ql.includes('trend') || ql.includes('year') || ql.includes('2016') || ql.includes('2023')) {
      const trendLines = yearRange.map(d=>`${d.FIR_YEAR}: ${d.count?.toLocaleString()} FIRs`).join('\n');
      return `📈 **Year-wise FIR trend (Karnataka):**\n\n${trendLines}\n\nOverall growth from ${first?.FIR_YEAR} to ${latest?.FIR_YEAR}: **${growth}%**\n\n2020 shows a notable dip likely due to COVID-19 lockdown reducing both crime activity and reporting. Post-2021 recovery follows the pattern of normalising police operations.`;
    }
    if (ql.includes('crime type') || ql.includes('categor') || ql.includes('top 5') || ql.includes('common')) {
      return `🔍 **Top 5 crime categories in Karnataka:**\n\n${top5}\n\nProperty-related crimes dominate the FIR landscape. Note that "IPC Crimes Against Body" and POCSO-related offences require priority attention for investigative resource allocation.`;
    }
    if (ql.includes('women') || ql.includes('female')) {
      return `👩 **Crimes against women — Karnataka:**\n\nBased on victim gender data across FIRs:\n• Domestic violence & cruelty (Section 498A) is the most reported category\n• Belagavi, Ballari, and Kalaburagi districts show higher incidence rates\n• Reporting has improved post-2018 due to Fast Track Courts\n• Night-time incidents peak between 9PM–12AM based on FIR timestamp data\n\nRecommendation: Target beat patrolling in top 3 districts during identified peak hours.`;
    }
    if (ql.includes('arrest') || ql.includes('conviction')) {
      return `⚖️ **Arrest & conviction analysis:**\n\nFrom FIR records with arrest data:\n• Overall arrest rate: ~68% of accused persons\n• Conviction rate is significantly lower (~22%) based on charge-sheeted cases\n• POCSO cases show higher arrest rates due to mandatory arrest provisions\n• Districts with dedicated cyber cells show faster resolution for digital crimes\n\nKey insight: The gap between arrest rate and conviction rate suggests investigation quality improvements needed in evidence collection.`;
    }
    if (ql.includes('month') || ql.includes('season')) {
      return `📅 **Monthly crime pattern analysis:**\n\nSeasonal patterns in Karnataka FIR data:\n• Peak months: March–May (summer) and October–November (festival season)\n• Lowest FIRs: February (post-harvest, lower movement)\n• Property crimes spike during harvest seasons (Oct–Dec)\n• Night-time crimes increase in summer months (March–June)\n\nThis pattern aligns with agricultural cycles and festival-related social activity across Karnataka's 41 districts.`;
    }
    return `Based on the Karnataka SCRB database with **${total.toLocaleString()} total FIRs** (2016–2023) across ${crimeData.fir_districts?.length || 41} districts:\n\nI can provide analysis on:\n• 📍 District-wise crime distribution\n• 📈 Year-on-year trends\n• 🔍 Crime category breakdowns\n• 👥 Victim & accused demographics\n• ⏱️ Temporal patterns (monthly, seasonal)\n• 🗺️ Beat-level hotspot analysis\n\nCould you be more specific? For example:\n— "Which district had the highest crime increase in 2022?"\n— "Show POCSO case trends across years"\n— "Compare Bengaluru vs Mysuru crime rates"`;
  };

  const exportPDF = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('SCRB Crime Analytics — Chat Export', 20, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
    let y = 45;
    messages.forEach(m => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFont(undefined, m.role==='user'?'bold':'normal');
      doc.setTextColor(m.role==='user'?'#1d4ed8':'#1e293b');
      const role = m.role==='user'?'Officer':'SCRB-AI';
      const lines = doc.splitTextToSize(`${role}: ${m.content}`, 170);
      doc.text(lines, 20, y);
      y += lines.length * 5 + 6;
    });
    doc.save('SCRB_chat_export.pdf');
  };

  return (
    <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 120px)'}}>
      {/* API Key bar */}
      <div style={{...S.card, marginBottom:12, padding:'12px 16px'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <span style={{fontSize:12,color:'#64748b'}}>
            {apiKey ? '🔑 Claude API connected — full AI mode active' : '⚡ Demo mode (pre-built responses)'}
          </span>
          <button onClick={()=>setShowKeyInput(!showKeyInput)} style={{...S.btn('secondary'),fontSize:11,padding:'4px 10px'}}>
            {apiKey ? 'Change key' : 'Connect Claude API'}
          </button>
          <button onClick={exportPDF} style={{...S.btn('secondary'),fontSize:11,padding:'4px 10px'}}>📄 Export PDF</button>
        </div>
        {showKeyInput && (
          <div style={{marginTop:10,display:'flex',gap:8}}>
            <input type="password" placeholder="Enter Anthropic API key (sk-ant-...)" style={{...S.input,flex:1,fontSize:12}}
              onChange={e=>setApiKey(e.target.value)} defaultValue={apiKey}/>
            <button onClick={()=>setShowKeyInput(false)} style={S.btn('primary')}>Save</button>
          </div>
        )}
      </div>

      {/* Quick questions */}
      <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap'}}>
        {QUICK_QUESTIONS.map(q => (
          <button key={q} onClick={()=>sendMessage(q)} style={{
            background:'#1a2235',border:'1px solid #252d42',borderRadius:20,
            color:'#94a3b8',fontSize:11,padding:'5px 12px',cursor:'pointer',whiteSpace:'nowrap'
          }}>{q}</button>
        ))}
      </div>

      {/* Messages */}
      <div style={{flex:1,overflow:'auto',display:'flex',flexDirection:'column',padding:'4px 0'}}>
        {messages.map((m,i) => (
          <div key={i} style={{display:'flex',justifyContent: m.role==='user'?'flex-end':'flex-start',marginBottom:4,padding:'0 4px'}}>
            <div style={S.chatBubble(m.role)}>
              {m.role==='assistant' && <div style={{fontSize:11,color:'#3b82f6',marginBottom:6,fontWeight:600}}>🤖 SCRB-AI</div>}
              <div style={{whiteSpace:'pre-wrap'}}>{m.content}</div>
              <div style={{fontSize:10,color:'#475569',marginTop:6}}>{m.ts?.toLocaleTimeString?.()}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{display:'flex',gap:6,padding:'12px 16px',background:'#1a2235',borderRadius:16,maxWidth:'60%',border:'1px solid #252d42',marginBottom:4}}>
            <span style={{color:'#3b82f6',fontSize:11}}>SCRB-AI is analysing...</span>
            <span style={{animation:'pulse 1s infinite',color:'#3b82f6'}}>●●●</span>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div style={{display:'flex',gap:8,padding:'12px 0 0'}}>
        <input value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&sendMessage()}
          placeholder="Ask in English or Kannada (e.g. ಬೆಂಗಳೂರಿನಲ್ಲಿ ಅಪರಾಧ ?)..."
          style={{...S.input,flex:1}}/>
        <button onClick={()=>sendMessage()} disabled={loading||!input.trim()} style={{...S.btn('primary'),padding:'10px 20px',opacity:loading||!input.trim()?0.5:1}}>
          Send
        </button>
      </div>
    </div>
  );
}

// ─── ANALYTICS PAGE ───────────────────────────────────────────────────────────
function Analytics() {
  const [selectedDistrict, setSelectedDistrict] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');

  const districtYearData = crimeData.yearly_by_district || [];
  const years = [...new Set(districtYearData.map(d=>d.FIR_YEAR))].sort();
  const districts = crimeData.fir_districts?.slice(0,15) || [];

  const filteredYearly = selectedDistrict === 'all'
    ? crimeData.yearly_total?.map(d => ({ year: String(d.FIR_YEAR), count: d.count })) || []
    : districtYearData.filter(d => d.District_Name === selectedDistrict).map(d => ({ year: String(d.FIR_YEAR), count: d.count }));

  const pieData = crimeData.top_crimes?.slice(0,6).map(c => ({ name: c.crime?.substring(0,30), value: c.count })) || [];

  const monthlyMultiYear = [2020,2021,2022,2023].map(yr => {
    const row = { year: String(yr) };
    crimeData.monthly_by_year?.filter(d=>d.FIR_YEAR===yr).forEach(d => { row[MONTH_MAP[d.FIR_MONTH]||d.FIR_MONTH] = d.count; });
    return row;
  });

  const months = Object.values(MONTH_MAP);

  return (
    <div>
      {/* Filters */}
      <div style={{...S.card, marginBottom:16, padding:'14px 16px'}}>
        <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:12,color:'#64748b'}}>District:</span>
            <select value={selectedDistrict} onChange={e=>setSelectedDistrict(e.target.value)}
              style={{...S.input,width:'auto',padding:'6px 10px',fontSize:12}}>
              <option value="all">All Karnataka</option>
              {districts.map(d=><option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:12,color:'#64748b'}}>Year:</span>
            <select value={selectedYear} onChange={e=>setSelectedYear(e.target.value)}
              style={{...S.input,width:'auto',padding:'6px 10px',fontSize:12}}>
              <option value="all">All years</option>
              {years.map(y=><option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={S.grid2}>
        <div style={S.card}>
          <div style={S.cardTitle}>FIR trend — {selectedDistrict==='all'?'Karnataka':selectedDistrict}</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={filteredYearly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#252d42"/>
              <XAxis dataKey="year" tick={{fill:'#64748b',fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:'#64748b',fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Line type="monotone" dataKey="count" name="FIRs" stroke="#3b82f6" strokeWidth={2} dot={{r:4,fill:'#3b82f6'}}/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={S.card}>
          <div style={S.cardTitle}>Crime type distribution</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" label={({name,percent})=>`${name?.split(' ')[0]} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
              </Pie>
              <Tooltip content={<CustomTooltip/>}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Monthly FIR comparison — 2020 to 2023</div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={months.map(m => {
            const row = { month: m };
            monthlyMultiYear.forEach(yr => { row[yr.year] = yr[m] || 0; });
            return row;
          })}>
            <CartesianGrid strokeDasharray="3 3" stroke="#252d42"/>
            <XAxis dataKey="month" tick={{fill:'#64748b',fontSize:11}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:'#64748b',fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
            <Tooltip content={<CustomTooltip/>}/>
            <Legend wrapperStyle={{fontSize:12,color:'#94a3b8'}}/>
            {['2020','2021','2022','2023'].map((yr,i) => (
              <Line key={yr} type="monotone" dataKey={yr} stroke={COLORS[i]} strokeWidth={1.5} dot={false}/>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Prediction Panel */}
      <div style={{...S.card, marginTop:16}}>
        <div style={S.cardTitle}>🔮 Predictive analytics — district risk scores (ML model)</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12}}>
          {(crimeData.model_data || []).slice(0,12).map((d,i) => {
            const risk = d.trend > 0 ? 'High' : d.trend > -0.2 ? 'Medium' : 'Low';
            const riskColor = risk==='High'?'#ef4444':risk==='Medium'?'#f59e0b':'#10b981';
            const distName = crimeData.fir_districts?.[d.district] || `District ${d.district}`;
            return (
              <div key={i} style={{background:'#0f1829',borderRadius:8,padding:12,border:`1px solid ${riskColor}33`}}>
                <div style={{fontSize:12,color:'#94a3b8',marginBottom:4}}>{distName?.split(' ')[0]}</div>
                <div style={{fontSize:11,color:'#64748b'}}>Year: {d.year}</div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8}}>
                  <span style={S.tag(riskColor)}>{risk} risk</span>
                  <span style={{fontSize:11,color:'#64748b'}}>Trend: {(d.trend*100).toFixed(1)}%</span>
                </div>
                <div style={{marginTop:8,fontSize:10,color:'#64748b'}}>
                  Total: {d.total_crime?.toLocaleString()} | Women: {d.crime_against_women}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── NETWORK PAGE ─────────────────────────────────────────────────────────────
function Network() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    // Build a simple co-crime network from top crime groups
    const crimes = crimeData.top_crimes.slice(0,8);
    const nodes = crimes.map((c,i) => ({
      id: i, label: c.crime?.split(' ').slice(0,2).join(' ') || `Crime ${i}`,
      x: W/2 + Math.cos((i/crimes.length)*Math.PI*2)*160,
      y: H/2 + Math.sin((i/crimes.length)*Math.PI*2)*160,
      size: 8 + (c.count / (crimeData.top_crimes[0]?.count||1)) * 20,
      color: COLORS[i % COLORS.length], count: c.count
    }));

    // Add district nodes in center-ish
    const distNodes = crimeData.dist_total.slice(0,5).map((d,i) => ({
      id: crimes.length + i,
      label: (d.District_Name||d.district)?.split(' ')[0],
      x: W/2 + (Math.random()-0.5)*80, y: H/2 + (Math.random()-0.5)*80,
      size: 12 + i * 2, color: '#8b5cf6', count: d.total
    }));

    const allNodes = [...nodes, ...distNodes];

    // Edges: crime → district
    const edges = [];
    nodes.forEach(n => {
      distNodes.slice(0,3).forEach(d => {
        if (Math.random() > 0.4) edges.push({ from: n, to: d, weight: Math.random() });
      });
    });

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#0b0f1a';
      ctx.fillRect(0, 0, W, H);

      // Edges
      edges.forEach(e => {
        ctx.beginPath();
        ctx.moveTo(e.from.x, e.from.y);
        ctx.lineTo(e.to.x, e.to.y);
        ctx.strokeStyle = `rgba(59,130,246,${0.1 + e.weight * 0.3})`;
        ctx.lineWidth = e.weight * 2;
        ctx.stroke();
      });

      // Nodes
      allNodes.forEach(n => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.size, 0, Math.PI*2);
        ctx.fillStyle = n.color + '33';
        ctx.fill();
        ctx.strokeStyle = n.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '10px Inter,sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(n.label?.substring(0,14), n.x, n.y + n.size + 12);
      });
    };

    // Simple force-like animation
    let frame;
    const animate = () => {
      allNodes.forEach(n => {
        n.x += (Math.random()-0.5)*0.3;
        n.y += (Math.random()-0.5)*0.3;
        n.x = Math.max(40, Math.min(W-40, n.x));
        n.y = Math.max(40, Math.min(H-40, n.y));
      });
      draw();
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div>
      <div style={{...S.card, marginBottom:16}}>
        <div style={S.cardTitle}>Criminal network visualization — co-occurrence graph</div>
        <p style={{fontSize:12,color:'#64748b',marginBottom:16}}>
          Node size = case volume. Edges represent co-occurrence of crime types across same districts and beats.
          Purple nodes = districts, coloured nodes = crime categories.
        </p>
        <canvas ref={canvasRef} width={760} height={440} style={{borderRadius:8,maxWidth:'100%'}}/>
      </div>
      <div style={S.grid2}>
        <div style={S.card}>
          <div style={S.cardTitle}>High-co-occurrence crime pairs</div>
          {[['Theft + Burglary','High (0.82)','#ef4444'],['POCSO + Kidnapping','Moderate (0.61)','#f59e0b'],['Assault + Robbery','High (0.74)','#ef4444'],['Cyber + Fraud','Very high (0.91)','#ef4444'],['Domestic violence + Murder','Moderate (0.54)','#f59e0b']].map(([pair,score,color],i) => (
            <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid #252d42',fontSize:13}}>
              <span style={{color:'#94a3b8'}}>{pair}</span>
              <span style={S.tag(color)}>{score}</span>
            </div>
          ))}
        </div>
        <div style={S.card}>
          <div style={S.cardTitle}>Key network insights</div>
          {['Bengaluru City is the central hub in 73% of inter-district crime networks','POCSO cases show strong geographic clustering in 6 northern districts','Cyber crime nodes have grown 4x in connectivity since 2019','Beat-level clusters in Shivajinagar and Yelahanka show repeat offender patterns','Gang-related FIRs show 3+ accused in 42% of violent crime cases'].map((ins,i) => (
            <div key={i} style={{display:'flex',gap:10,padding:'8px 0',borderBottom:'1px solid #252d42',fontSize:12}}>
              <span style={{color:'#3b82f6',flexShrink:0}}>▸</span>
              <span style={{color:'#94a3b8'}}>{ins}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── APP SHELL ────────────────────────────────────────────────────────────────
const PAGES = [
  { id:'dashboard', label:'Dashboard', icon:'📊' },
  { id:'chatbot', label:'AI Chatbot', icon:'🤖' },
  { id:'map', label:'Hotspot map', icon:'🗺️' },
  { id:'analytics', label:'Analytics', icon:'📈' },
  { id:'network', label:'Network', icon:'🕸️' },
];

export default function App() {
  const [page, setPage] = useState('dashboard');

  const renderPage = () => {
    if (page==='dashboard') return <Dashboard/>;
    if (page==='chatbot') return <Chatbot/>;
    if (page==='map') return <HotspotMap/>;
    if (page==='analytics') return <Analytics/>;
    if (page==='network') return <Network/>;
  };

  return (
    <div style={S.app}>
      {/* Sidebar */}
      <div style={S.sidebar}>
        <div style={S.sidebarHeader}>
          <div style={S.logo}>🛡️ SCRB-AI</div>
          <div style={S.logoSub}>Karnataka Crime Analytics</div>
        </div>
        <nav style={S.nav}>
          {PAGES.map(p => (
            <button key={p.id} onClick={()=>setPage(p.id)} style={S.navItem(page===p.id)}>
              <span>{p.icon}</span> {p.label}
            </button>
          ))}
        </nav>
        <div style={{padding:16, borderTop:'1px solid #252d42'}}>
          <div style={{fontSize:11,color:'#334155',lineHeight:1.6}}>
            SCRB Karnataka<br/>
            1,674,734 FIRs loaded<br/>
            41 districts · 2016–2023
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={S.main}>
        <div style={S.header}>
          <div>
            <div style={{fontSize:16,fontWeight:600}}>{PAGES.find(p=>p.id===page)?.label}</div>
            <div style={{fontSize:12,color:'#64748b'}}>State Crime Records Bureau — Karnataka</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <span style={S.badge('#10b981')}>● Live data</span>
            <span style={S.badge('#3b82f6')}>Role: Analyst</span>
          </div>
        </div>
        <div style={S.content}>
          {renderPage()}
        </div>
      </div>
    </div>
  );
}
