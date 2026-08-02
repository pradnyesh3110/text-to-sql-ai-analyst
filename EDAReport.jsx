// frontend/src/EDAReport.jsx
import { useState } from "react"

export default function EDAReport({ visible }) {
  const [eda,     setEda]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [tab,     setTab]     = useState("overview")
  console.log("EDAReport rendered");

  const fetchEDA = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/eda', {
        method: 'get'
        
      })
      const data = await res.json()
      if (data.error) setError(data.error)
      else { setEda(data); setTab("overview") }
    } catch (e) {
      setError("Failed: " + e.message)
    }
    setLoading(false)
  }

  if (!visible) return null

  return (
    <div style={s.card}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <p style={s.stepLabel}>Auto EDA</p>
          <h2 style={s.title}>📊 Exploratory Data Analysis</h2>
          <p style={s.sub}>
            Automatic statistical analysis of your uploaded data
          </p>
        </div>
        <button onClick={fetchEDA}
          disabled={loading} style={s.loadBtn}>
          {loading ? "⏳ Analyzing..." : "🔍 Run EDA"}
        </button>
      </div>

      {/* Empty state */}
      {!eda && !loading && !error && (
        <div style={{ textAlign:"center", padding:"30px 0" }}>
          <p style={{ fontSize:40, margin:"0 0 10px" }}>📊</p>
          <p style={{
            fontSize:13, color:"#9CA3AF", margin:"0 0 16px"
          }}>
            Upload a file first, then click Run EDA
          </p>
          <button onClick={fetchEDA} style={{
            padding:"10px 24px", background:"#7F77DD",
            color:"#fff", border:"none", borderRadius:8,
            fontSize:13, fontWeight:600, cursor:"pointer"
          }}>
            🔍 Run EDA Report
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={s.errorBox}>❌ {error}</div>
      )}

      {/* Content */}
      {eda && (
        <>
          {/* Tabs */}
          <div style={{
            display:"flex", gap:0, marginBottom:16,
            borderBottom:"2px solid #E5E7EB"
          }}>
            {[
              ["overview",     "📋 Overview"],
              ["columns",      "🔢 Columns"],
              ["correlations", "🔗 Correlations"],
              ["insights",     "💡 Insights"]
            ].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)}
                style={{
                  padding     : "9px 18px",
                  border      : "none",
                  background  : "transparent",
                  fontSize    : 13,
                  fontWeight  : tab===key ? 700 : 400,
                  color       : tab===key ? "#7F77DD" : "#6B7280",
                  cursor      : "pointer",
                  borderBottom: tab===key
                    ? "2px solid #7F77DD"
                    : "2px solid transparent",
                  marginBottom: -2
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* ── Overview ── */}
          {tab === "overview" && (
            <div>
              <div style={{
                display:"grid",
                gridTemplateColumns:"repeat(4,1fr)",
                gap:10, marginBottom:16
              }}>
                {[
                  ["Total Rows",   eda?.overview?.total_rows ?? 0,        "#2563EB"],
                  ["Columns",      eda?.overview?.total_columns ?? 0,     "#7C3AED"],
                  ["Missing %",    eda?.overview?.missing_pct ? eda.overview.missing_pct + "%" : "0%", eda?.overview?.missing_pct > 10 ? "#DC2626" : "#059669"],
                  ["Duplicates",   eda?.overview?.duplicate_rows ?? 0,    eda?.overview?.duplicate_rows > 0 ? "#D97706" : "#059669"],
                  ["Numeric Cols", eda?.overview?.numeric_columns ?? 0,   "#0891B2"],
                  ["Text Cols",    eda?.overview?.text_columns ?? 0,      "#BE185D"],
                  ["Memory KB",    eda?.overview?.memory_kb ?? 0,         "#374151"],
                  ["Total Cells",  eda?.overview?.total_cells?.toLocaleString() ?? "0", "#374151"]
                ].map(([label, val, color]) => (
                  <div key={label} style={{
                    background  : "#F8FAFC",
                    border      : "1px solid #E2E8F0",
                    borderRadius: 10,
                    padding     : "12px 14px",
                    borderTop   : `3px solid ${color}`
                  }}>
                    <div style={{
                      fontSize:20, fontWeight:700,
                      color, margin:"0 0 4px"
                    }}>
                      {val}
                    </div>
                    <div style={{
                      fontSize:11, color:"#64748B"
                    }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>

              {/* AI Narrative */}
              {eda.narrative && (
                <div style={{
                  background  : "#F0F9FF",
                  border      : "1px solid #BAE6FD",
                  borderRadius: 10,
                  padding     : "14px 16px",
                  marginBottom: 10
                }}>
                  <p style={{
                    fontSize:12, fontWeight:700,
                    color:"#0369A1", margin:"0 0 8px"
                  }}>
                    🤖 AI Analysis Summary (Llama 3.2)
                  </p>
                  <p style={{
                    fontSize:13, color:"#1E293B",
                    lineHeight:1.7, margin:0
                  }}>
                    {eda.narrative}
                  </p>
                </div>
              )}

              <p style={{
                fontSize:11, color:"#9CA3AF",
                textAlign:"right"
              }}>
                Generated: {eda.generated_at}
              </p>
            </div>
          )}

          {/* ── Columns ── */}
          {tab === "columns" && (
            <div style={{
              display:"flex", flexDirection:"column", gap:10
            }}>
              {eda.columns.map((col, i) => (
                <div key={i} style={{
                  background  : "#F8FAFC",
                  border      : "1px solid #E2E8F0",
                  borderRadius: 10,
                  padding     : "14px 16px"
                }}>
                  <div style={{
                    display       : "flex",
                    justifyContent: "space-between",
                    alignItems    : "center",
                    marginBottom  : 8
                  }}>
                    <div style={{
                      display:"flex", alignItems:"center", gap:8
                    }}>
                      <code style={{
                        fontSize:13, fontWeight:700,
                        color:"#1E293B", background:"#E2E8F0",
                        padding:"2px 8px", borderRadius:4
                      }}>
                        {col.name}
                      </code>
                      <span style={{
                        fontSize:11, padding:"2px 8px",
                        borderRadius:20, fontWeight:500,
                        background: col.type==="numeric"
                          ? "#DBEAFE" : "#FEF3C7",
                        color: col.type==="numeric"
                          ? "#1D4ED8" : "#92400E"
                      }}>
                        {col.type}
                      </span>
                    </div>
                    {col.missing_pct > 0 && (
                      <span style={{
                        fontSize:11, fontWeight:500,
                        color: col.missing_pct > 20
                          ? "#DC2626" : "#D97706"
                      }}>
                        ⚠️ {col.missing_pct}% missing
                      </span>
                    )}
                  </div>

                  <div style={{
                    display:"flex", gap:16,
                    flexWrap:"wrap", fontSize:12,
                    color:"#64748B", marginBottom:8
                  }}>
                    <span>Unique: <strong>{col.unique}</strong></span>
                    <span>Missing: <strong>{col.missing}</strong></span>
                    {col.type === "numeric" && (<>
                      <span>Min: <strong>{col.min}</strong></span>
                      <span>Max: <strong>{col.max}</strong></span>
                      <span>Mean: <strong>{col.mean}</strong></span>
                      <span>Median: <strong>{col.median}</strong></span>
                      {col.outliers > 0 && (
                        <span style={{ color:"#DC2626" }}>
                          Outliers: <strong>{col.outliers}</strong>
                        </span>
                      )}
                      {col.shape && col.shape !== "normal" && (
                        <span style={{ color:"#D97706" }}>
                          Shape: <strong>{col.shape}</strong>
                        </span>
                      )}
                    </>)}
                  </div>

                  {col.top_values?.length > 0 && (
                    <div>
                      <p style={{
                        fontSize:10, color:"#94A3B8",
                        margin:"0 0 5px", fontWeight:600,
                        textTransform:"uppercase",
                        letterSpacing:"0.05em"
                      }}>
                        Top Values
                      </p>
                      <div style={{
                        display:"flex", gap:6, flexWrap:"wrap"
                      }}>
                        {col.top_values.slice(0,5).map((v,j)=>(
                          <span key={j} style={{
                            fontSize:11, padding:"2px 8px",
                            borderRadius:20, background:"#fff",
                            border:"1px solid #E2E8F0",
                            color:"#374151"
                          }}>
                            {v.value} ({v.freq})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Correlations ── */}
          {tab === "correlations" && (
            <div>
              {eda.correlations?.length > 0 ? (
                <div style={{
                  display:"flex", flexDirection:"column", gap:8
                }}>
                  <p style={{
                    fontSize:12, color:"#64748B",
                    margin:"0 0 10px"
                  }}>
                    Top {eda.correlations.length} correlations
                    between numeric columns
                  </p>
                  {eda.correlations.map((c, i) => (
                    <div key={i} style={{
                      display:"flex", alignItems:"center",
                      gap:12, padding:"10px 14px",
                      background:"#F8FAFC",
                      border:"1px solid #E2E8F0",
                      borderRadius:8
                    }}>
                      <div style={{
                        width:60, textAlign:"center",
                        fontSize:15, fontWeight:700,
                        color: Math.abs(c.correlation) > 0.7
                          ? "#DC2626"
                          : Math.abs(c.correlation) > 0.4
                          ? "#D97706" : "#059669"
                      }}>
                        {c.correlation}
                      </div>
                      <div style={{ flex:1 }}>
                        <p style={{
                          fontSize:13, fontWeight:500,
                          color:"#1E293B", margin:"0 0 3px"
                        }}>
                          <code>{c.col1}</code>
                          {" ↔ "}
                          <code>{c.col2}</code>
                        </p>
                        <p style={{
                          fontSize:11, color:"#64748B", margin:0
                        }}>
                          {c.strength} {c.direction} correlation
                        </p>
                      </div>
                      <span style={{
                        fontSize:11, padding:"3px 10px",
                        borderRadius:20, fontWeight:600,
                        background: c.strength==="strong"
                          ? "#FEE2E2"
                          : c.strength==="moderate"
                          ? "#FEF3C7" : "#F0FDF4",
                        color: c.strength==="strong"
                          ? "#DC2626"
                          : c.strength==="moderate"
                          ? "#D97706" : "#059669"
                      }}>
                        {c.strength}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  textAlign:"center", padding:"30px 0",
                  color:"#9CA3AF", fontSize:13
                }}>
                  Need at least 2 numeric columns
                  for correlation analysis
                </div>
              )}
            </div>
          )}

          {/* ── Insights ── */}
          {tab === "insights" && (
            <div style={{
              display:"flex", flexDirection:"column", gap:8
            }}>
              {eda.insights?.map((ins, i) => (
                <div key={i} style={{
                  display    : "flex",
                  alignItems : "flex-start",
                  gap        : 12,
                  padding    : "12px 14px",
                  background : ins.type==="warning"
                    ? "#FFFBEB"
                    : ins.type==="success"
                    ? "#F0FDF4" : "#F0F9FF",
                  border     : `1px solid ${
                    ins.type==="warning" ? "#F59E0B"
                    : ins.type==="success" ? "#86EFAC"
                    : "#BAE6FD"
                  }`,
                  borderRadius: 8
                }}>
                  <span style={{
                    fontSize:20, flexShrink:0
                  }}>
                    {ins.icon}
                  </span>
                  <p style={{
                    fontSize:13, color:"#1E293B",
                    margin:0, lineHeight:1.6
                  }}>
                    {ins.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const s = {
  card    : {
    background:"#fff", border:"1px solid #E5E7EB",
    borderRadius:14, padding:"22px 26px",
    marginBottom:16, boxShadow:"0 1px 4px rgba(0,0,0,.06)"
  },
  header  : {
    display:"flex", justifyContent:"space-between",
    alignItems:"flex-start", marginBottom:16
  },
  stepLabel:{ fontSize:11, fontWeight:600, color:"#7F77DD",
    textTransform:"uppercase", letterSpacing:".08em",
    margin:"0 0 4px" },
  title   : { fontSize:17, fontWeight:600,
    margin:"0 0 4px", color:"#1a1a2e" },
  sub     : { fontSize:13, color:"#9CA3AF", margin:0 },
  loadBtn : { padding:"8px 16px", background:"#7F77DD",
    color:"#fff", border:"none", borderRadius:8,
    fontSize:12, fontWeight:600, cursor:"pointer" },
  errorBox: { padding:"10px 14px", background:"#FEF2F2",
    border:"1px solid #FECACA", borderRadius:8,
    fontSize:13, color:"#DC2626" }
}