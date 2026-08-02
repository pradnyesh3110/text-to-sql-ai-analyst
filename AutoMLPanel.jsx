// frontend/src/AutoMLPanel.jsx
import { useState } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Line, LineChart,
  ReferenceLine
} from "recharts"

export default function AutoMLPanel({ columns }) {
  const [loading,    setLoading]    = useState(false)
  const [result,     setResult]     = useState(null)
  const [error,      setError]      = useState(null)
  const [targetCol,  setTargetCol]  = useState("")
  const [targetAcc,  setTargetAcc]  = useState(85)
  const [cleanFirst, setCleanFirst] = useState(true)
  const [tab,        setTab]        = useState("overview")

  const run = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res  = await fetch("http://127.0.0.1:8000/automl", {
        method  : "POST",
        headers : { "Content-Type": "application/json" },
        body    : JSON.stringify({
          target_accuracy: targetAcc / 100,
          target_col     : targetCol,
          clean_first    : cleanFirst
        })
      })
      const data = await res.json()
      if (data.success) {
        setResult(data)
        setTab("overview")
      } else {
        setError(data.error)
      }
    } catch (e) {
      setError("Error: " + e.message)
    }
    setLoading(false)
  }

  const ml = result?.ml_result
  const rec = result?.recommendation

  return (
    <div style={s.card}>

      {/* Header */}
      <div style={s.header}>
        <div>
          <p style={s.stepLabel}>AutoML</p>
          <h2 style={s.title}>🧠 Auto Machine Learning</h2>
          <p style={s.sub}>
            Ollama recommends the best ML model →
            Auto-trains until target accuracy reached
          </p>
        </div>
        <div style={{ textAlign:"right" }}>
          <span style={{
            fontSize:11, padding:"4px 10px",
            borderRadius:20, background:"#DBEAFE",
            color:"#1D4ED8", fontWeight:600,
            display:"block", marginBottom:4
          }}>
            70% Train / 30% Test
          </span>
          <span style={{
            fontSize:11, padding:"4px 10px",
            borderRadius:20, background:"#D1FAE5",
            color:"#065F46", fontWeight:600
          }}>
            Target: {targetAcc}% accuracy
          </span>
        </div>
      </div>

      {/* Controls */}
      <div style={{
        display    : "flex",
        gap        : 12,
        flexWrap   : "wrap",
        marginBottom: 14,
        padding    : "14px 16px",
        background : "#F8FAFC",
        borderRadius: 10,
        border     : "1px solid #E2E8F0"
      }}>

        {/* Target column */}
        <div>
          <p style={s.label}>Target Column</p>
          <select
            value={targetCol}
            onChange={e => setTargetCol(e.target.value)}
            style={s.select}>
            <option value="">Auto detect</option>
            {columns?.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Target accuracy */}
        <div>
          <p style={s.label}>Target Accuracy: {targetAcc}%</p>
          <div style={{ display:"flex", gap:6 }}>
            {[70, 80, 85, 90, 95].map(a => (
              <button key={a}
                onClick={() => setTargetAcc(a)}
                style={{
                  padding     : "6px 12px",
                  borderRadius: 8,
                  border      : "none",
                  fontSize    : 12,
                  fontWeight  : 600,
                  cursor      : "pointer",
                  background  : targetAcc === a
                    ? "#7F77DD" : "#F1F5F9",
                  color       : targetAcc === a
                    ? "#fff" : "#374151"
                }}>
                {a}%
              </button>
            ))}
          </div>
        </div>

        {/* Clean first toggle */}
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <input
            type="checkbox"
            checked={cleanFirst}
            onChange={e => setCleanFirst(e.target.checked)}
            id="clean"
          />
          <label htmlFor="clean" style={{
            fontSize:13, color:"#374151", cursor:"pointer"
          }}>
            Auto-clean data first
          </label>
        </div>

        {/* Run button */}
        <button
          onClick={run}
          disabled={loading}
          style={{
            padding     : "10px 24px",
            background  : loading ? "#94A3B8" : "#7F77DD",
            color       : "#fff",
            border      : "none",
            borderRadius: 8,
            fontSize    : 13,
            fontWeight  : 700,
            cursor      : loading ? "not-allowed" : "pointer",
            alignSelf   : "flex-end"
          }}>
          {loading
            ? "⏳ Training models..."
            : "🧠 Run AutoML"}
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{
          padding    : "20px",
          textAlign  : "center",
          color      : "#6B7280",
          fontSize   : 13
        }}>
          <p style={{ fontSize:24, margin:"0 0 8px" }}>⚙️</p>
          <p style={{ margin:"0 0 4px", fontWeight:600 }}>
            AutoML running...
          </p>
          <p style={{ margin:0, fontSize:12 }}>
            Step 1: Cleaning data →
            Step 2: Ollama recommends model →
            Step 3: Training with 70/30 split →
            Step 4: Upgrading until {targetAcc}% reached
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={s.errorBox}>❌ {error}</div>
      )}

      {/* Results */}
      {result && ml && (
        <>
          {/* Tabs */}
          <div style={{
            display:"flex", gap:0,
            borderBottom:"2px solid #E5E7EB",
            marginBottom:16
          }}>
            {[
              ["overview",    "📋 Overview"],
              ["models",      "🏋️ Models"],
              ["features",    "📊 Features"],
              ["predictions", "🎯 Predictions"],
            ].map(([key, label]) => (
              <button key={key}
                onClick={() => setTab(key)}
                style={{
                  padding     : "9px 16px",
                  border      : "none",
                  background  : "transparent",
                  fontSize    : 13,
                  fontWeight  : tab===key ? 700 : 400,
                  color       : tab===key
                    ? "#7F77DD" : "#6B7280",
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

          {/* ── OVERVIEW TAB ── */}
          {tab === "overview" && (
            <div>
              {/* Ollama recommendation */}
              {rec && (
                <div style={{
                  background  : "#F0F9FF",
                  border      : "1px solid #BAE6FD",
                  borderRadius: 10,
                  padding     : "14px 16px",
                  marginBottom: 14
                }}>
                  <p style={{
                    fontSize:12, fontWeight:700,
                    color:"#0369A1", margin:"0 0 10px"
                  }}>
                    🤖 Ollama ML Recommendation
                  </p>
                  <div style={{
                    display:"grid",
                    gridTemplateColumns:"repeat(3,1fr)",
                    gap:10, marginBottom:10
                  }}>
                    {[
                      ["Problem Type", rec.problem_type],
                      ["Task",         rec.task],
                      ["Recommended",  rec.recommended_model],
                    ].map(([k,v]) => (
                      <div key={k} style={{
                        background:"#fff",
                        borderRadius:8,
                        padding:"8px 10px"
                      }}>
                        <p style={{
                          fontSize:10, color:"#64748B",
                          margin:"0 0 2px",
                          textTransform:"uppercase",
                          letterSpacing:"0.05em"
                        }}>
                          {k}
                        </p>
                        <p style={{
                          fontSize:13, fontWeight:700,
                          color:"#1E293B", margin:0,
                          textTransform:"capitalize"
                        }}>
                          {v}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p style={{
                    fontSize:12, color:"#0369A1",
                    margin:"0 0 4px"
                  }}>
                    💡 Reason: {rec.reason}
                  </p>
                  <p style={{
                    fontSize:11, color:"#64748B", margin:0
                  }}>
                    Features used: {rec.feature_columns?.join(", ")}
                  </p>
                </div>
              )}

              {/* Result stats */}
              <div style={{
                display:"grid",
                gridTemplateColumns:"repeat(4,1fr)",
                gap:10, marginBottom:14
              }}>
                {[
                  ["Best Model",    ml.best_model,          "#7F77DD"],
                  ["Best Accuracy", ml.best_accuracy_pct,   ml.reached_target ? "#059669" : "#D97706"],
                  ["Target Met",    ml.reached_target ? "✅ YES" : "⬜ NO", ml.reached_target ? "#059669" : "#D97706"],
                  ["Models Tried",  ml.models_tried?.length, "#2563EB"],
                ].map(([label, val, color]) => (
                  <div key={label} style={{
                    background  : "#F8FAFC",
                    border      : "1px solid #E2E8F0",
                    borderRadius: 10,
                    padding     : "12px 14px",
                    borderTop   : `3px solid ${color}`
                  }}>
                    <div style={{
                      fontSize:18, fontWeight:700,
                      color, margin:"0 0 4px"
                    }}>
                      {val}
                    </div>
                    <div style={{
                      fontSize:10, color:"#64748B"
                    }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Train/test info */}
              <div style={{
                display:"flex", gap:10,
                marginBottom:14
              }}>
                <div style={{
                  flex:1, padding:"10px 14px",
                  background:"#EFF6FF",
                  borderRadius:8,
                  border:"1px solid #BFDBFE"
                }}>
                  <p style={{
                    fontSize:11, color:"#1D4ED8",
                    fontWeight:600, margin:"0 0 2px"
                  }}>
                    🏋️ Training Set (70%)
                  </p>
                  <p style={{
                    fontSize:20, fontWeight:700,
                    color:"#1D4ED8", margin:0
                  }}>
                    {ml.train_rows} rows
                  </p>
                </div>
                <div style={{
                  flex:1, padding:"10px 14px",
                  background:"#F0FDF4",
                  borderRadius:8,
                  border:"1px solid #86EFAC"
                }}>
                  <p style={{
                    fontSize:11, color:"#059669",
                    fontWeight:600, margin:"0 0 2px"
                  }}>
                    🧪 Test Set (30%)
                  </p>
                  <p style={{
                    fontSize:20, fontWeight:700,
                    color:"#059669", margin:0
                  }}>
                    {ml.test_rows} rows
                  </p>
                </div>
                {result.cleaned_issues > 0 && (
                  <div style={{
                    flex:1, padding:"10px 14px",
                    background:"#FFFBEB",
                    borderRadius:8,
                    border:"1px solid #F59E0B"
                  }}>
                    <p style={{
                      fontSize:11, color:"#D97706",
                      fontWeight:600, margin:"0 0 2px"
                    }}>
                      🧹 Issues Cleaned
                    </p>
                    <p style={{
                      fontSize:20, fontWeight:700,
                      color:"#D97706", margin:0
                    }}>
                      {result.cleaned_issues}
                    </p>
                  </div>
                )}
              </div>

              {/* AI Narrative */}
              {result.narrative && (
                <div style={{
                  background  : "#F0FDF4",
                  border      : "1px solid #86EFAC",
                  borderRadius: 10,
                  padding     : "14px 16px"
                }}>
                  <p style={{
                    fontSize:12, fontWeight:700,
                    color:"#059669", margin:"0 0 8px"
                  }}>
                    🤖 AI Analysis (Llama 3.2)
                  </p>
                  <p style={{
                    fontSize:13, color:"#1E293B",
                    lineHeight:1.7, margin:0
                  }}>
                    {result.narrative}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── MODELS TAB ── */}
          {tab === "models" && (
            <div>
              <p style={{
                fontSize:12, color:"#64748B",
                margin:"0 0 12px"
              }}>
                Models tried in order — stops when
                target accuracy ({targetAcc}%) is reached
              </p>
              {ml.models_tried?.map((m, i) => (
                <div key={i} style={{
                  display       : "flex",
                  alignItems    : "center",
                  justifyContent: "space-between",
                  padding       : "10px 14px",
                  marginBottom  : 8,
                  background    : m.status === "✅"
                    ? "#F0FDF4" : "#F9FAFB",
                  border        : `1px solid ${
                    m.status === "✅"
                      ? "#86EFAC" : "#E5E7EB"
                  }`,
                  borderRadius  : 8
                }}>
                  <div style={{
                    display:"flex",
                    alignItems:"center",
                    gap:10
                  }}>
                    <span style={{ fontSize:18 }}>
                      {m.status === "✅" ? "✅" :
                       m.status === "❌" ? "❌" : "⬜"}
                    </span>
                    <div>
                      <p style={{
                        fontSize:13, fontWeight:600,
                        color:"#1E293B", margin:"0 0 2px"
                      }}>
                        {i+1}. {m.name}
                      </p>
                      {m.error && (
                        <p style={{
                          fontSize:11, color:"#DC2626",
                          margin:0
                        }}>
                          {m.error}
                        </p>
                      )}
                    </div>
                  </div>
                  {m.score !== undefined && (
                    <div style={{ textAlign:"right" }}>
                      <p style={{
                        fontSize:18, fontWeight:700,
                        color: m.status === "✅"
                          ? "#059669" : "#374151",
                        margin:"0 0 2px"
                      }}>
                        {m.score_pct}
                      </p>
                      <p style={{
                        fontSize:10, color:"#9CA3AF",
                        margin:0
                      }}>
                        {m.metric}
                      </p>
                    </div>
                  )}
                </div>
              ))}

              {/* Bar chart of model scores */}
              {ml.models_tried?.filter(m => m.score).length > 1 && (
                <div style={{ marginTop:16 }}>
                  <p style={{
                    fontSize:12, fontWeight:600,
                    color:"#374151", margin:"0 0 8px"
                  }}>
                    Model Comparison
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={ml.models_tried.filter(m => m.score)}
                      margin={{top:5,right:10,left:0,bottom:40}}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#F0F0F0"/>
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize:10 }}
                        angle={-25}
                        textAnchor="end"/>
                      <YAxis
                        domain={[0, 1]}
                        tickFormatter={v => `${(v*100).toFixed(0)}%`}
                        tick={{ fontSize:10 }}/>
                      <Tooltip
                        formatter={v =>
                          [`${(v*100).toFixed(1)}%`, "Score"]
                        }/>
                      <ReferenceLine
                        y={targetAcc/100}
                        stroke="#F59E0B"
                        strokeDasharray="4 4"
                        label={{
                          value:`Target ${targetAcc}%`,
                          fontSize:10,
                          fill:"#F59E0B"
                        }}/>
                      <Bar
                        dataKey="score"
                        fill="#7F77DD"
                        radius={[4,4,0,0]}
                        label={{
                          position:"top",
                          fontSize:10,
                          formatter: v =>
                            `${(v*100).toFixed(1)}%`
                        }}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ── FEATURES TAB ── */}
          {tab === "features" && (
            <div>
              {ml.feature_importance?.length > 0 ? (
                <>
                  <p style={{
                    fontSize:12, color:"#64748B",
                    margin:"0 0 12px"
                  }}>
                    Feature importance for best model ({ml.best_model})
                  </p>
                  {ml.feature_importance.map((f, i) => (
                    <div key={i} style={{
                      display    : "flex",
                      alignItems : "center",
                      gap        : 12,
                      padding    : "8px 0",
                      borderBottom: "1px solid #F3F4F6"
                    }}>
                      <span style={{
                        fontSize:12, fontWeight:600,
                        color:"#374151", width:140,
                        flexShrink:0
                      }}>
                        {f.feature}
                      </span>
                      <div style={{
                        flex:1, background:"#F1F5F9",
                        borderRadius:20, height:10,
                        overflow:"hidden"
                      }}>
                        <div style={{
                          width     : `${f.pct}%`,
                          background: i === 0
                            ? "#7F77DD"
                            : i === 1
                            ? "#2563EB"
                            : "#059669",
                          height    : "100%",
                          borderRadius:20,
                          transition: "width 0.5s"
                        }}/>
                      </div>
                      <span style={{
                        fontSize:12, fontWeight:700,
                        color:"#374151", width:40,
                        textAlign:"right", flexShrink:0
                      }}>
                        {f.pct}%
                      </span>
                    </div>
                  ))}
                </>
              ) : (
                <p style={{
                  color:"#9CA3AF", fontSize:13,
                  textAlign:"center", padding:"20px 0"
                }}>
                  Feature importance not available
                  for this model type
                </p>
              )}
            </div>
          )}

          {/* ── PREDICTIONS TAB ── */}
          {tab === "predictions" && (
            <div>
              {ml.actual_vs_pred?.length > 0 ? (
                <>
                  <p style={{
                    fontSize:12, color:"#64748B",
                    margin:"0 0 12px"
                  }}>
                    Actual vs Predicted — test set
                    (30% = {ml.test_rows} rows)
                  </p>

                  {/* Chart */}
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart
                      data={ml.actual_vs_pred}
                      margin={{
                        top:5, right:20, left:0, bottom:5
                      }}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#F0F0F0"/>
                      <XAxis
                        dataKey="index"
                        tick={{ fontSize:10 }}
                        label={{
                          value:"Test Samples",
                          position:"insideBottom",
                          offset:-2, fontSize:10
                        }}/>
                      <YAxis tick={{ fontSize:10 }}/>
                      <Tooltip
                        formatter={(val, name) => [
                          val?.toLocaleString(),
                          name === "actual"
                            ? "Actual" : "Predicted"
                        ]}/>
                      <Line
                        type="monotone"
                        dataKey="actual"
                        stroke="#2563EB"
                        strokeWidth={2}
                        dot={{ r:3 }}
                        name="actual"/>
                      <Line
                        type="monotone"
                        dataKey="predicted"
                        stroke="#7F77DD"
                        strokeWidth={2}
                        strokeDasharray="5 3"
                        dot={{ r:3 }}
                        name="predicted"/>
                    </LineChart>
                  </ResponsiveContainer>

                  {/* Table */}
                  <div style={{
                    overflowX:"auto", marginTop:14
                  }}>
                    <table style={{
                      width:"100%",
                      borderCollapse:"collapse",
                      fontSize:12
                    }}>
                      <thead>
                        <tr>
                          {["#","Actual","Predicted","Error"].map(h => (
                            <th key={h} style={s.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ml.actual_vs_pred
                          .slice(0,10)
                          .map((row, i) => (
                          <tr key={i} style={{
                            background: i%2===0
                              ? "#fff" : "#F9FAFB"
                          }}>
                            <td style={s.td}>{row.index+1}</td>
                            <td style={s.td}>
                              {row.actual?.toLocaleString()}
                            </td>
                            <td style={s.td}>
                              {row.predicted?.toLocaleString()}
                            </td>
                            <td style={{
                              ...s.td,
                              color: row.error > row.actual * 0.1
                                ? "#DC2626" : "#059669",
                              fontWeight:500
                            }}>
                              {row.error?.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p style={{
                      fontSize:11, color:"#9CA3AF",
                      margin:"6px 0 0"
                    }}>
                      Showing 10 of {ml.actual_vs_pred.length} test samples
                    </p>
                  </div>
                </>
              ) : ml.predictions?.length > 0 ? (
                // clustering predictions
                <div>
                  <p style={{
                    fontSize:12, color:"#64748B",
                    margin:"0 0 12px"
                  }}>
                    Cluster assignments (sample)
                  </p>
                  <div style={{ overflowX:"auto" }}>
                    <table style={{
                      width:"100%",
                      borderCollapse:"collapse",
                      fontSize:12
                    }}>
                      <thead>
                        <tr>
                          {Object.keys(
                            ml.predictions[0] || {}
                          ).map(h => (
                            <th key={h} style={s.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ml.predictions
                          .slice(0,10)
                          .map((row, i) => (
                          <tr key={i}>
                            {Object.values(row).map((v,j)=>(
                              <td key={j} style={s.td}>
                                {String(v)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p style={{
                  color:"#9CA3AF", fontSize:13,
                  textAlign:"center", padding:"20px 0"
                }}>
                  No predictions available
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const s = {
  card    : {
    background  : "#fff",
    border      : "1px solid #E5E7EB",
    borderRadius: 14,
    padding     : "22px 26px",
    marginBottom: 16,
    boxShadow   : "0 1px 4px rgba(0,0,0,.06)"
  },
  header  : {
    display       : "flex",
    justifyContent: "space-between",
    alignItems    : "flex-start",
    marginBottom  : 16
  },
  stepLabel: {
    fontSize:11, fontWeight:600, color:"#7C3AED",
    textTransform:"uppercase",
    letterSpacing:".08em", margin:"0 0 4px"
  },
  title   : {
    fontSize:17, fontWeight:600,
    margin:"0 0 4px", color:"#1a1a2e"
  },
  sub     : { fontSize:13, color:"#9CA3AF", margin:0 },
  label   : {
    fontSize:12, fontWeight:500,
    color:"#374151", margin:"0 0 5px"
  },
  select  : {
    padding:"7px 10px", borderRadius:8,
    border:"1px solid #D1D5DB",
    fontSize:12, outline:"none",
    background:"#fff", color:"#374151"
  },
  errorBox: {
    padding:"10px 14px", background:"#FEF2F2",
    border:"1px solid #FECACA", borderRadius:8,
    fontSize:13, color:"#DC2626", marginBottom:12
  },
  th      : {
    background:"#F9FAFB", padding:"8px 12px",
    textAlign:"left", fontWeight:600,
    color:"#374151", borderBottom:"2px solid #E5E7EB"
  },
  td      : {
    padding:"7px 12px", color:"#4B5563",
    borderBottom:"1px solid #F3F4F6"
  }
}