// frontend/src/DAXPanel.jsx
import { useState } from "react"

export default function DAXPanel() {
  const [question,   setQuestion]   = useState("")
  const [loading,    setLoading]    = useState(false)
  const [result,     setResult]     = useState(null)
  const [copied,     setCopied]     = useState(false)
  const [error,      setError]      = useState(null)
  const [daxHistory, setDaxHistory] = useState([])
  const [downloading,setDownloading]= useState(false)

  const generate = async () => {
    if (!question.trim()) return
    setLoading(true)
    setResult(null)
    setError(null)
    setCopied(false)

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/dax", {
        method  : "POST",
        headers : { "Content-Type": "application/json" },
        body    : JSON.stringify({ question })
      })
      const data = await response.json()
      setResult(data)

      // save to history for batch download
      if (data.dax) {
        setDaxHistory(prev => [
          ...prev,
          {
            name     : question.slice(0, 30),
            dax      : data.dax,
            question : question,
            chart    : data.chart_type
          }
        ])
      }
    } catch (err) {
      setError("Error: " + err.message)
    }
    setLoading(false)
  }

  const copyDAX = () => {
    if (!result?.dax) return
    navigator.clipboard.writeText(result.dax)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadTemplate = async () => {
    if (daxHistory.length === 0) return
    setDownloading(true)

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/download-pbi-template", {
        method  : "POST",
        headers : { "Content-Type": "application/json" },
        body    : JSON.stringify({
          dax_measures : daxHistory,
          chart_type   : result?.chart_type || "bar",
          table_name   : "user_data"
        })
      })

      // download the file
      const blob = await response.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = "AI_Dashboard.pbit"
      a.click()
      URL.revokeObjectURL(url)

    } catch (err) {
      setError("Download error: " + err.message)
    }
    setDownloading(false)
  }

  const clearHistory = () => setDaxHistory([])

  return (
    <div style={s.card}>

      {/* Header */}
      <div style={s.header}>
        <div>
          <p style={s.stepLabel}>Power BI Integration</p>
          <h2 style={s.title}>📐 DAX Generator</h2>
          <p style={s.sub}>
            Ask questions → get DAX measures →
            download ready-made Power BI template
          </p>
        </div>
        <span style={s.pbiBadge}>Power BI</span>
      </div>

      {/* Input */}
      <div style={s.inputRow}>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === "Enter" && generate()}
          placeholder="e.g. show sales trend by month"
          style={s.input}
          disabled={loading}
        />
        <button
          onClick={generate}
          disabled={loading || !question.trim()}
          style={{
            ...s.btn,
            opacity: loading || !question.trim() ? 0.6 : 1
          }}
        >
          {loading ? "Generating..." : "Generate DAX"}
        </button>
      </div>

      {/* Quick questions */}
      <div style={s.exRow}>
        {[
          "sales trend by month",
          "top product by revenue",
          "sales by region",
          "average order value",
          "monthly growth rate"
        ].map((q, i) => (
          <button key={i}
            onClick={() => setQuestion(q)}
            style={s.exBtn}>
            {q}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={s.errorBox}>❌ {error}</div>
      )}

      {/* Result */}
      {result && (
        <div style={{ marginTop: 16 }}>

          {/* Chart recommendation */}
          {result.chart_type && (
            <div style={s.chartRec}>
              <strong>
                📊 Power BI Visual: {result.pbi_visual}
              </strong>
              <br/>
              <span style={{ fontSize:12, color:"#6B7280" }}>
                {result.chart_reason}
              </span>
            </div>
          )}

          {/* DAX code */}
          <div style={s.daxHeader}>
            <p style={s.daxLabel}>DAX Measure:</p>
            <button onClick={copyDAX} style={s.copyBtn}>
              {copied ? "✅ Copied!" : "📋 Copy DAX"}
            </button>
          </div>
          <pre style={s.daxBox}>{result.dax}</pre>

          {/* Instructions */}
          <div style={s.instrBox}>
            <p style={s.instrTitle}>
              📋 Steps in Power BI Desktop:
            </p>
            {result.instructions?.map((step, i) => (
              <p key={i} style={s.instrStep}>{step}</p>
            ))}
          </div>
        </div>
      )}

      {/* DAX History + Download Template */}
      {daxHistory.length > 0 && (
        <div style={s.historyBox}>
          <div style={s.historyHeader}>
            <p style={s.historyTitle}>
              📦 DAX Measures Generated ({daxHistory.length})
            </p>
            <div style={{ display:"flex", gap:8 }}>
              <button
                onClick={downloadTemplate}
                disabled={downloading}
                style={s.downloadBtn}>
                {downloading
                  ? "Generating..."
                  : "⬇️ Download Power BI Template (.pbit)"}
              </button>
              <button
                onClick={clearHistory}
                style={s.clearBtn}>
                Clear
              </button>
            </div>
          </div>

          {daxHistory.map((h, i) => (
            <div key={i} style={s.historyItem}>
              <span style={s.historyNum}>
                {i + 1}
              </span>
              <div>
                <p style={s.historyQ}>{h.question}</p>
                <p style={s.historyDax}>
                  {h.dax.slice(0, 60)}...
                </p>
              </div>
              <span style={{
                ...s.chartTag,
                background: h.chart === "line"
                  ? "#DBEAFE"
                  : h.chart === "pie"
                  ? "#FCE7F3"
                  : "#DCFCE7"
              }}>
                {h.chart}
              </span>
            </div>
          ))}

          <p style={s.historyNote}>
            💡 Generate multiple DAX measures then download
            one template with all of them included
          </p>
        </div>
      )}
    </div>
  )
}

const s = {
  card        : { background:"#fff",
                  border:"1px solid #E5E7EB",
                  borderRadius:14, padding:"22px 26px",
                  marginBottom:16,
                  boxShadow:"0 1px 4px rgba(0,0,0,.06)" },
  header      : { display:"flex",
                  justifyContent:"space-between",
                  alignItems:"flex-start",
                  marginBottom:14 },
  stepLabel   : { fontSize:11, fontWeight:600,
                  color:"#B45309",
                  textTransform:"uppercase",
                  letterSpacing:".08em", margin:"0 0 4px" },
  title       : { fontSize:17, fontWeight:600,
                  margin:"0 0 4px" },
  sub         : { fontSize:13, color:"#9CA3AF",
                  margin:0, lineHeight:1.5 },
  pbiBadge    : { fontSize:11, padding:"4px 12px",
                  borderRadius:20, background:"#F2C811",
                  color:"#1a1a2e", fontWeight:700,
                  whiteSpace:"nowrap" },
  inputRow    : { display:"flex", gap:8,
                  marginBottom:10 },
  input       : { flex:1, padding:"11px 14px",
                  borderRadius:8,
                  border:"1px solid #D1D5DB",
                  fontSize:14, outline:"none" },
  btn         : { padding:"11px 18px",
                  background:"#F2C811",
                  color:"#1a1a2e", border:"none",
                  borderRadius:8, fontSize:13,
                  fontWeight:700, cursor:"pointer",
                  whiteSpace:"nowrap" },
  exRow       : { display:"flex", flexWrap:"wrap",
                  gap:6, marginBottom:12 },
  exBtn       : { fontSize:11, padding:"4px 10px",
                  borderRadius:20,
                  border:"1px solid #E5E7EB",
                  background:"#F9FAFB",
                  cursor:"pointer", color:"#374151" },
  errorBox    : { marginTop:10, padding:"10px 14px",
                  background:"#FEF2F2",
                  border:"1px solid #FECACA",
                  borderRadius:8, fontSize:13,
                  color:"#DC2626" },
  chartRec    : { background:"#F0FDF4",
                  border:"1px solid #86EFAC",
                  borderRadius:8, padding:"10px 14px",
                  marginBottom:12, fontSize:13,
                  color:"#166534" },
  daxHeader   : { display:"flex",
                  justifyContent:"space-between",
                  alignItems:"center",
                  margin:"0 0 8px" },
  daxLabel    : { fontSize:13, fontWeight:600,
                  color:"#374151", margin:0 },
  copyBtn     : { fontSize:12, padding:"5px 14px",
                  borderRadius:6,
                  border:"1px solid #D1D5DB",
                  background:"transparent",
                  cursor:"pointer", color:"#374151" },
  daxBox      : { background:"#1a1a2e",
                  color:"#F2C811",
                  padding:"16px 18px", borderRadius:10,
                  fontSize:13,
                  fontFamily:"'Fira Code', monospace",
                  overflowX:"auto", lineHeight:1.8,
                  margin:"0 0 14px",
                  whiteSpace:"pre-wrap" },
  instrBox    : { background:"#FFFBEB",
                  border:"1px solid #F2C811",
                  borderRadius:10, padding:"14px 16px",
                  marginBottom:12 },
  instrTitle  : { fontSize:13, fontWeight:600,
                  color:"#92400E", margin:"0 0 10px" },
  instrStep   : { fontSize:12, color:"#78350F",
                  margin:"4px 0", lineHeight:1.6 },
  historyBox  : { marginTop:16, background:"#F9FAFB",
                  border:"1px solid #E5E7EB",
                  borderRadius:10, padding:"14px 16px" },
  historyHeader:{ display:"flex",
                  justifyContent:"space-between",
                  alignItems:"center",
                  marginBottom:12, flexWrap:"wrap",
                  gap:8 },
  historyTitle: { fontSize:13, fontWeight:600,
                  color:"#374151", margin:0 },
  downloadBtn : { padding:"8px 16px",
                  background:"#F2C811",
                  color:"#1a1a2e", border:"none",
                  borderRadius:8, fontSize:12,
                  fontWeight:700, cursor:"pointer" },
  clearBtn    : { padding:"8px 12px",
                  background:"transparent",
                  color:"#6B7280",
                  border:"1px solid #E5E7EB",
                  borderRadius:8, fontSize:12,
                  cursor:"pointer" },
  historyItem : { display:"flex", alignItems:"center",
                  gap:10, padding:"8px 0",
                  borderBottom:"0.5px solid #E5E7EB" },
  historyNum  : { width:22, height:22,
                  borderRadius:"50%",
                  background:"#F2C811",
                  color:"#1a1a2e", fontSize:11,
                  fontWeight:700,
                  display:"flex",
                  alignItems:"center",
                  justifyContent:"center",
                  flexShrink:0 },
  historyQ    : { fontSize:12, fontWeight:500,
                  color:"#374151", margin:"0 0 2px" },
  historyDax  : { fontSize:11, color:"#9CA3AF",
                  margin:0, fontFamily:"monospace" },
  chartTag    : { fontSize:10, padding:"2px 8px",
                  borderRadius:20, fontWeight:500,
                  color:"#374151", flexShrink:0 },
  historyNote : { fontSize:11, color:"#9CA3AF",
                  margin:"10px 0 0",
                  fontStyle:"italic" }
}