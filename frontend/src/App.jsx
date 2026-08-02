import { useState } from "react"
import { uploadFile } from "./api"
import ChartPanel   from "./ChartPanel"
import BatchPanel   from "./BatchPanel"
import DAXPanel     from "./DAXPanel"
import Dashboard    from "./Dashboard"
import SchemaViewer from "./SchemaViewer"
import MultiUpload  from "./MultiUpload"
import EDAReport    from "./EDAReport"
import AutoMLPanel  from "./AutoMLPanel"
import PredictPanel from "./predictpanel"

// ── API Base URL ─────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || "https://text-to-sql-ai-analyst-2.onrender.com"

// ── Nav tabs ────────────────────────────────────
const TABS = [
  { id:"upload",    label:"📁 Upload",    desc:"Upload your data file" },
  { id:"query",     label:"💬 Query",     desc:"Ask questions in English" },
  { id:"eda",       label:"📊 EDA",       desc:"Auto data analysis" },
  { id:"schema",    label:"🗂️ Schema",    desc:"Database schema explorer" },
  { id:"automl",    label:"🧠 AutoML",    desc:"Auto machine learning" },
  { id:"predict",   label:"🔮 Predict",   desc:"Forecast future trends" },
  { id:"dax",       label:"📐 DAX",       desc:"Power BI DAX generator" },
  { id:"dashboard", label:"📊 Dashboard", desc:"Full visual dashboard" },
]

export default function App() {
  const [activeTab,    setActiveTab]    = useState("upload")
  const [uploadStatus, setUploadStatus] = useState(null)
  const [uploadError,  setUploadError]  = useState(null)
  const [columns,      setColumns]      = useState([])
  const [question,     setQuestion]     = useState("")
  const [loading,      setLoading]      = useState(false)
  const [result,       setResult]       = useState(null)
  const [queryError,   setQueryError]   = useState(null)
  const [showDashboard,setShowDashboard]= useState(false)
  const [dashboardData,setDashboardData]= useState(null)
  const [dbLoading,    setDbLoading]    = useState(false)
  const [qualityIssues,setQualityIssues]= useState([])
  const [fixStatus,    setFixStatus]    = useState(null)
  const [fixing,       setFixing]       = useState(false)

  // ── Upload ──────────────────────────────────
  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadStatus("Uploading...")
    setUploadError(null)
    setColumns([])
    setResult(null)
    setQualityIssues([])
    setFixStatus(null)
    try {
      const data = await uploadFile(file)
      if (data.success) {
        setUploadStatus("✅ " + data.message)
        setColumns(data.columns)
        setQualityIssues(data.issues || [])
      } else {
        setUploadError(data.error || "Upload failed")
        setUploadStatus(null)
      }
    } catch (err) {
      setUploadError("Network error — backend may be starting up, wait 30 seconds and try again")
      setUploadStatus(null)
    }
  }

  // ── Ask ─────────────────────────────────────
  const handleAsk = async () => {
    if (!question.trim()) return
    setLoading(true)
    setQueryError(null)
    setResult(null)
    try {
      const res = await fetch(`${API_BASE}/query`, {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({ question })
      })
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setQueryError("Query failed — " + err.message)
    }
    setLoading(false)
  }

  // ── Dashboard ────────────────────────────────
  const handleViewDashboard = async () => {
    setDbLoading(true)
    try {
      const res  = await fetch(`${API_BASE}/query`, {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({ question: "show all data from user_data" })
      })
      const data = await res.json()
      setDashboardData(data)
      setShowDashboard(true)
    } catch (err) {
      alert("Dashboard error: " + err.message)
    }
    setDbLoading(false)
  }

  // ── Auto Fix ─────────────────────────────────
  const handleFixAll = async () => {
    setFixing(true)
    try {
      const res  = await fetch(`${API_BASE}/clean`, {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({ actions: qualityIssues })
      })
      const data = await res.json()
      if (data.success) {
        setFixStatus(
          `✅ Fixed! ${data.rows_removed} rows removed. ` +
          `${data.remaining_issues.length} issues remaining.`
        )
        setQualityIssues(data.remaining_issues)
      } else {
        setFixStatus("❌ " + data.error)
      }
    } catch (err) {
      setFixStatus("❌ " + err.message)
    }
    setFixing(false)
  }

  // ── Multi upload success ──────────────────────
  const handleMultiSuccess = (data) => {
    setColumns(data.columns || [])
    setUploadStatus("✅ " + data.message)
    setQualityIssues(data.issues || [])
    setUploadError(null)
  }

  return (
    <div style={{
      minHeight  : "100vh",
      background : "#F8FAFC",
      fontFamily : "Inter, sans-serif"
    }}>

      {/* ── TOP HEADER ── */}
      <div style={{
        background: "#1E293B",
        padding   : "0 24px",
        boxShadow : "0 2px 8px rgba(0,0,0,0.15)"
      }}>
        <div style={{
          maxWidth      : 1100,
          margin        : "0 auto",
          display       : "flex",
          alignItems    : "center",
          justifyContent: "space-between",
          height        : 56
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:22 }}>🤖</span>
            <span style={{ fontSize:18, fontWeight:700, color:"#fff" }}>
              AI Data Analyst
            </span>
            {columns.length > 0 && (
              <span style={{
                fontSize:11, padding:"2px 10px",
                borderRadius:20, background:"#2563EB",
                color:"#fff", fontWeight:500
              }}>
                {columns.length} columns loaded
              </span>
            )}
          </div>
          <div style={{ fontSize:11, color:"#94A3B8" }}>
            {uploadStatus
              ? <span style={{ color:"#4ADE80" }}>{uploadStatus}</span>
              : "No data loaded"}
          </div>
        </div>

        {/* ── NAV TABS ── */}
        <div style={{
          maxWidth:1100, margin:"0 auto",
          display:"flex", gap:2, overflowX:"auto"
        }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding     : "10px 16px",
                border      : "none",
                background  : "transparent",
                color       : activeTab===tab.id ? "#fff" : "#94A3B8",
                fontSize    : 13,
                fontWeight  : activeTab===tab.id ? 600 : 400,
                cursor      : "pointer",
                borderBottom: activeTab===tab.id
                  ? "2px solid #7F77DD"
                  : "2px solid transparent",
                whiteSpace  : "nowrap",
                transition  : "all 0.15s"
              }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── PAGE CONTENT ── */}
      <div style={{
        maxWidth:900, margin:"0 auto",
        padding:"24px 16px 80px"
      }}>

        {/* ── UPLOAD PAGE ── */}
        {activeTab === "upload" && (
          <div>
            <PageTitle icon="📁" title="Upload Your Data"
              desc="Upload any CSV, Excel, JSON, PDF or TSV file" />

            <div style={s.card}>
              <p style={s.stepLabel}>Single File</p>
              <h2 style={s.cardTitle}>Choose a file</h2>
              <p style={s.cardSub}>CSV, Excel (.xlsx), JSON, PDF, TSV supported</p>

              <input
                type="file"
                accept=".csv,.xlsx,.xls,.json,.pdf,.tsv,.txt"
                onChange={handleUpload}
                style={{ fontSize:13, cursor:"pointer" }}
              />

              {uploadStatus && (
                <div style={s.successBox}>{uploadStatus}</div>
              )}
              {uploadError && (
                <div style={s.errorBox}>❌ {uploadError}</div>
              )}

              {columns.length > 0 && (
                <div style={{
                  marginTop:"12px", display:"flex",
                  flexWrap:"wrap", gap:6, alignItems:"center"
                }}>
                  <span style={{ fontSize:12, color:"#6B7280", fontWeight:500 }}>
                    Columns:
                  </span>
                  {columns.map(c => (
                    <span key={c} style={s.colTag}>{c}</span>
                  ))}
                </div>
              )}

              {/* Data quality */}
              {qualityIssues.length > 0 && (
                <div style={{
                  marginTop:14, padding:"14px 16px",
                  background:"#FFFBEB",
                  border:"1px solid #F59E0B", borderRadius:10
                }}>
                  <p style={{
                    fontSize:13, fontWeight:600,
                    color:"#92400E", margin:"0 0 10px"
                  }}>
                    ⚠️ {qualityIssues.length} data quality issue
                    {qualityIssues.length > 1 ? "s" : ""} found
                  </p>
                  {qualityIssues.map((issue, i) => (
                    <div key={i} style={{
                      fontSize:12, color:"#78350F",
                      padding:"5px 0",
                      borderBottom:"0.5px solid #FDE68A",
                      display:"flex", justifyContent:"space-between", gap:10
                    }}>
                      <div>
                        <strong>{issue.type.replace(/_/g," ").toUpperCase()}</strong>
                        {issue.column !== "all" && <span> — <code>{issue.column}</code></span>}
                        <span style={{ color:"#B45309" }}>
                          {" "}({issue.count} rows, {issue.percentage}%)
                        </span>
                        <br/>
                        <span style={{ fontSize:11, opacity:0.8 }}>💡 {issue.suggestion}</span>
                      </div>
                      <span style={{
                        fontSize:11, padding:"2px 8px",
                        borderRadius:20, fontWeight:500, flexShrink:0,
                        background: issue.severity==="high" ? "#FEE2E2"
                          : issue.severity==="medium" ? "#FEF3C7" : "#F0FDF4",
                        color: issue.severity==="high" ? "#DC2626"
                          : issue.severity==="medium" ? "#D97706" : "#059669"
                      }}>
                        {issue.severity}
                      </span>
                    </div>
                  ))}
                  <div style={{ marginTop:12, display:"flex", gap:8 }}>
                    <button onClick={handleFixAll} disabled={fixing}
                      style={{
                        padding:"8px 16px",
                        background: fixing ? "#94A3B8" : "#F59E0B",
                        color:"#fff", border:"none", borderRadius:8,
                        fontSize:12, fontWeight:600,
                        cursor: fixing ? "not-allowed" : "pointer"
                      }}>
                      {fixing ? "⏳ Fixing..." : "✨ Auto Fix All"}
                    </button>
                    <button onClick={() => setQualityIssues([])}
                      style={{
                        padding:"8px 16px", background:"transparent",
                        color:"#92400E", border:"1px solid #F59E0B",
                        borderRadius:8, fontSize:12, cursor:"pointer"
                      }}>
                      Skip
                    </button>
                  </div>
                  {fixStatus && (
                    <div style={{
                      marginTop:10, padding:"8px 12px",
                      background:"#F0FDF4", border:"1px solid #86EFAC",
                      borderRadius:6, fontSize:12, color:"#166534"
                    }}>
                      {fixStatus}
                    </div>
                  )}
                </div>
              )}
            </div>

            <MultiUpload onSuccess={handleMultiSuccess} />

            {columns.length > 0 && (
              <div style={{ ...s.card, background:"#EFF6FF", border:"1px solid #BFDBFE" }}>
                <p style={{ fontSize:13, fontWeight:600, color:"#1D4ED8", margin:"0 0 12px" }}>
                  ✅ Data loaded! Go to:
                </p>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {[["💬 Query","query"],["📊 EDA","eda"],["🗂️ Schema","schema"],
                    ["🧠 AutoML","automl"],["🔮 Predict","predict"]].map(([label,id]) => (
                    <button key={id} onClick={() => setActiveTab(id)}
                      style={{
                        padding:"8px 16px", background:"#2563EB", color:"#fff",
                        border:"none", borderRadius:8, fontSize:13,
                        fontWeight:500, cursor:"pointer"
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── QUERY PAGE ── */}
        {activeTab === "query" && (
          <div>
            <PageTitle icon="💬" title="Ask a Question"
              desc="Type in plain English — get SQL + chart + table" />
            <div style={s.card}>
              <p style={s.cardSub}>
                {columns.length > 0
                  ? `Available columns: ${columns.join(", ")}`
                  : "Upload a file first from the Upload tab"}
              </p>
              <div style={{ display:"flex", gap:8 }}>
                <input
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && handleAsk()}
                  placeholder="e.g. Which product has highest sales?"
                  style={s.textInput}
                  disabled={loading}
                />
                <button onClick={handleAsk}
                  disabled={loading || !question.trim()}
                  style={{ ...s.askBtn, opacity: loading||!question.trim() ? 0.6 : 1 }}>
                  {loading ? "Thinking..." : "Ask →"}
                </button>
              </div>
              {loading && (
                <p style={{ marginTop:8, fontSize:13, color:"#9CA3AF" }}>
                  ⏳ Generating SQL...
                </p>
              )}
            </div>

            {queryError && (
              <div style={{ ...s.errorBox, marginBottom:16 }}>❌ {queryError}</div>
            )}

            {result && (
              <div style={s.card}>
                <p style={s.sectionLabel}>Generated SQL:</p>
                <pre style={s.sqlBox}>{result.sql}</pre>
                {result.result?.rows?.length > 0 ? (
                  <>
                    <ChartPanel columns={result.result.columns} rows={result.result.rows} />
                    <p style={{ ...s.sectionLabel, marginTop:20 }}>
                      Data — <span style={{ fontWeight:400, color:"#6B7280" }}>
                        {result.result.rows.length} rows
                      </span>
                    </p>
                    <div style={{ overflowX:"auto" }}>
                      <table style={s.table}>
                        <thead>
                          <tr>{result.result.columns.map(c=>(
                            <th key={c} style={s.th}>{c}</th>
                          ))}</tr>
                        </thead>
                        <tbody>
                          {result.result.rows.map((row,i)=>(
                            <tr key={i} style={{ background:i%2===0?"#fff":"#FAFAFA" }}>
                              {result.result.columns.map(c=>(
                                <td key={c} style={s.td}>{row[c]??"—"}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p style={{ color:"#9CA3AF", fontSize:13 }}>No rows returned.</p>
                )}
              </div>
            )}
            <BatchPanel />
          </div>
        )}

        {activeTab === "eda" && (
          <div>
            <PageTitle icon="📊" title="Exploratory Data Analysis"
              desc="Auto statistical analysis of your uploaded data" />
            <EDAReport visible={true} />
          </div>
        )}

        {activeTab === "schema" && (
          <div>
            <PageTitle icon="🗂️" title="Schema Explorer"
              desc="View database structure, column roles and schema pattern" />
            <SchemaViewer visible={true} />
          </div>
        )}

        {activeTab === "automl" && (
          <div>
            <PageTitle icon="🧠" title="Auto Machine Learning"
              desc="Ollama recommends best ML model → trains until target accuracy" />
            <AutoMLPanel columns={columns} />
          </div>
        )}

        {activeTab === "predict" && (
          <div>
            <PageTitle icon="🔮" title="Predictive Analytics"
              desc="Auto-detect time series and forecast future values" />
            <PredictPanel columns={columns} />
          </div>
        )}

        {activeTab === "dax" && (
          <div>
            <PageTitle icon="📐" title="Power BI DAX Generator"
              desc="Generate DAX measures → download Power BI template" />
            <DAXPanel />
          </div>
        )}

        {activeTab === "dashboard" && (
          <div>
            <PageTitle icon="📊" title="Visual Dashboard"
              desc="Full interactive dashboard with charts and filters" />
            <div style={s.card}>
              <p style={{ fontSize:13, color:"#6B7280", margin:"0 0 16px" }}>
                Opens a full-screen dashboard with KPI cards, charts, filters and dark/light mode.
              </p>
              <button onClick={handleViewDashboard} disabled={dbLoading}
                style={{
                  padding:"12px 28px",
                  background: dbLoading ? "#94A3B8" : "#1E293B",
                  color:"#fff", border:"none", borderRadius:8,
                  fontSize:14, fontWeight:600,
                  cursor: dbLoading ? "not-allowed" : "pointer"
                }}>
                {dbLoading ? "⏳ Loading..." : "📊 Open Full Dashboard"}
              </button>
              {columns.length > 0 && (
                <div style={{
                  marginTop:16, padding:"10px 14px",
                  background:"#F0FDF4", border:"1px solid #86EFAC",
                  borderRadius:8, fontSize:12, color:"#166534"
                }}>
                  ✅ Data ready: {columns.length} columns loaded
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {showDashboard && dashboardData && (
        <Dashboard data={dashboardData} onClose={() => setShowDashboard(false)} />
      )}
    </div>
  )
}

function PageTitle({ icon, title, desc }) {
  return (
    <div style={{ marginBottom:20 }}>
      <h1 style={{
        fontSize:24, fontWeight:700, color:"#1E293B",
        margin:"0 0 4px", display:"flex", alignItems:"center", gap:10
      }}>
        <span>{icon}</span>{title}
      </h1>
      <p style={{ fontSize:14, color:"#64748B", margin:0 }}>{desc}</p>
    </div>
  )
}

const s = {
  card        : { background:"#fff", border:"1px solid #E5E7EB",
                  borderRadius:14, padding:"22px 26px", marginBottom:16,
                  boxShadow:"0 1px 4px rgba(0,0,0,.06)" },
  stepLabel   : { fontSize:11, fontWeight:600, color:"#7F77DD",
                  textTransform:"uppercase", letterSpacing:".08em", margin:"0 0 4px" },
  cardTitle   : { fontSize:17, fontWeight:600, margin:"0 0 4px", color:"#1a1a2e" },
  cardSub     : { fontSize:13, color:"#9CA3AF", margin:"0 0 14px" },
  successBox  : { marginTop:10, padding:"10px 14px", background:"#F0FDF4",
                  border:"1px solid #86EFAC", borderRadius:8, fontSize:13,
                  color:"#166534", fontWeight:500 },
  errorBox    : { marginTop:10, padding:"10px 14px", background:"#FEF2F2",
                  border:"1px solid #FECACA", borderRadius:8, fontSize:13, color:"#DC2626" },
  colTag      : { fontSize:11, padding:"2px 9px", borderRadius:20,
                  background:"#EEF2FF", color:"#4338CA", fontWeight:500 },
  textInput   : { flex:1, padding:"11px 14px", borderRadius:8,
                  border:"1px solid #D1D5DB", fontSize:14, outline:"none" },
  askBtn      : { padding:"11px 22px", background:"#7F77DD", color:"#fff",
                  border:"none", borderRadius:8, fontSize:14, fontWeight:600,
                  cursor:"pointer", whiteSpace:"nowrap" },
  sectionLabel: { fontSize:13, fontWeight:600, color:"#374151", margin:"0 0 6px" },
  sqlBox      : { background:"#F8FAFC", border:"1px solid #E5E7EB", borderRadius:8,
                  padding:"12px 14px", fontSize:12, fontFamily:"monospace",
                  overflowX:"auto", marginBottom:16, lineHeight:1.6, whiteSpace:"pre-wrap" },
  table       : { width:"100%", borderCollapse:"collapse", fontSize:13 },
  th          : { background:"#F9FAFB", padding:"10px 14px", textAlign:"left",
                  fontWeight:600, color:"#374151", borderBottom:"2px solid #E5E7EB",
                  whiteSpace:"nowrap" },
  td          : { padding:"9px 14px", color:"#4B5563", borderBottom:"1px solid #F3F4F6" }
}
