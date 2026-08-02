// frontend/src/BatchPanel.jsx
import { useState } from "react"
import ChartPanel from "./ChartPanel"

export default function BatchPanel() {
  const [text, setText]       = useState(
    "what is total sales by product?\nwhich region has highest sales?\nhow many units sold in Pune?"
  )
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error,   setError]   = useState(null)

  const runBatch = async () => {
    const questions = text
      .split("\n")
      .map(q => q.trim())
      .filter(q => q.length > 0)

    if (questions.length === 0) return
    if (questions.length > 15) {
      setError("Max 15 questions per batch")
      return
    }

    setLoading(true)
    setResults(null)
    setError(null)

    try {
      const response = await fetch("http://127.0.0.1:8000/batch", {
        method  : "POST",
        headers : { "Content-Type": "application/json" },
        body    : JSON.stringify({ questions })
      })
      const data = await response.json()
      setResults(data)
    } catch (err) {
      setError("Batch error: " + err.message)
    }

    setLoading(false)
  }

  return (
    <div style={s.card}>

      {/* Header */}
      <p style={s.stepLabel}>Batch Mode</p>
      <h2 style={s.title}>Run Multiple Questions</h2>
      <p style={s.sub}>
        One question per line — max 15.
        Each question runs automatically (~4 sec gap between each).
      </p>

      {/* Textarea */}
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={6}
        disabled={loading}
        placeholder="One question per line..."
        style={s.textarea}
      />

      {/* Run button */}
      <button
        onClick={runBatch}
        disabled={loading}
        style={{ ...s.btn, opacity: loading ? 0.7 : 1 }}
      >
        {loading
          ? `⏳ Running... (~4 sec per question)`
          : "▶ Run All Questions"}
      </button>

      {/* Error */}
      {error && (
        <div style={s.errorBox}>❌ {error}</div>
      )}

      {/* Summary */}
      {results && (
        <div style={{ marginTop: 16 }}>
          <p style={s.summary}>
            ✅ {results.success} success
            {results.failed > 0 && (
              <span style={{ color: "#DC2626" }}>
                &nbsp;· ❌ {results.failed} failed
              </span>
            )}
            <span style={{ color: "#9CA3AF", fontWeight: 400 }}>
              &nbsp;· {results.total} total
            </span>
          </p>

          {/* Individual results */}
          {results.results.map((r, i) => (
            <div key={i} style={{
              ...s.resultCard,
              borderLeft: `3px solid ${
                r.status === "success" ? "#1D9E75" : "#DC2626"
              }`
            }}>

              {/* Question */}
              <p style={s.qLabel}>
                Q{i + 1}: {r.question}
              </p>

              {r.status === "success" ? (
                <>
                  {/* SQL */}
                  <pre style={s.sql}>{r.sql}</pre>

                  {/* Row count */}
                  <p style={s.rowCount}>
                    {r.result?.rows?.length ?? 0} rows returned
                  </p>

                  {/* Chart */}
                  {r.result?.rows?.length > 0 && (
                    <ChartPanel
                      columns={r.result.columns}
                      rows={r.result.rows}
                    />
                  )}

                  {/* Table */}
                  {r.result?.rows?.length > 0 && (
                    <div style={{ overflowX: "auto", marginTop: 10 }}>
                      <table style={s.table}>
                        <thead>
                          <tr>
                            {r.result.columns.map(c => (
                              <th key={c} style={s.th}>{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {r.result.rows.slice(0, 5).map((row, j) => (
                            <tr key={j}
                              style={{ background: j%2===0?"#fff":"#FAFAFA" }}>
                              {r.result.columns.map(c => (
                                <td key={c} style={s.td}>
                                  {row[c] ?? "—"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {r.result.rows.length > 5 && (
                        <p style={{ fontSize: 11, color: "#9CA3AF",
                          margin: "4px 0 0" }}>
                          showing 5 of {r.result.rows.length} rows
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p style={{ fontSize: 12, color: "#DC2626", margin: 0 }}>
                  ❌ {r.error}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const s = {
  card      : { background:"#fff", border:"1px solid #E5E7EB",
                borderRadius:14, padding:"22px 26px",
                marginBottom:16,
                boxShadow:"0 1px 4px rgba(0,0,0,.06)" },
  stepLabel : { fontSize:11, fontWeight:600, color:"#1D9E75",
                textTransform:"uppercase",
                letterSpacing:".08em", margin:"0 0 4px" },
  title     : { fontSize:17, fontWeight:600, margin:"0 0 4px" },
  sub       : { fontSize:13, color:"#9CA3AF", margin:"0 0 12px",
                lineHeight:1.5 },
  textarea  : { width:"100%", padding:"10px 12px", borderRadius:8,
                border:"1px solid #D1D5DB", fontSize:13,
                fontFamily:"monospace", resize:"vertical",
                outline:"none" },
  btn       : { marginTop:10, padding:"10px 22px",
                background:"#1D9E75", color:"#fff",
                border:"none", borderRadius:8,
                fontSize:13, fontWeight:600, cursor:"pointer" },
  errorBox  : { marginTop:10, padding:"10px 14px",
                background:"#FEF2F2",
                border:"1px solid #FECACA",
                borderRadius:8, fontSize:13, color:"#DC2626" },
  summary   : { fontSize:13, fontWeight:600,
                color:"#374151", margin:"0 0 12px" },
  resultCard: { background:"#F9FAFB", borderRadius:10,
                padding:"14px 16px", marginBottom:12 },
  qLabel    : { fontSize:13, fontWeight:600,
                color:"#1a1a2e", margin:"0 0 8px" },
  sql       : { fontSize:11, fontFamily:"monospace",
                background:"#F3F4F6", padding:"8px 10px",
                borderRadius:6, overflowX:"auto",
                color:"#374151", margin:"0 0 6px",
                whiteSpace:"pre-wrap" },
  rowCount  : { fontSize:12, color:"#6B7280", margin:"0 0 4px" },
  table     : { width:"100%", borderCollapse:"collapse",
                fontSize:12 },
  th        : { background:"#F3F4F6", padding:"8px 12px",
                textAlign:"left", fontWeight:600,
                color:"#374151",
                borderBottom:"1px solid #E5E7EB" },
  td        : { padding:"7px 12px", color:"#4B5563",
                borderBottom:"1px solid #F3F4F6" }
}