// frontend/src/PredictPanel.jsx
import { useState } from "react"
import {
  ComposedChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine
} from "recharts"

export default function PredictPanel({ columns }) {
  const [periods,  setPeriods]  = useState(30)
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState(null)
  const [error,    setError]    = useState(null)
  const [dateCol,  setDateCol]  = useState("")
  const [valueCol, setValueCol] = useState("")

  const run = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res  = await fetch("http://127.0.0.1:8000/predict", {
        method  : "POST",
        headers : { "Content-Type": "application/json" },
        body    : JSON.stringify({
          periods,
          date_col : dateCol,
          value_col: valueCol
        })
      })
      const data = await res.json()
      if (data.success) setResult(data)
      else setError(data.error)
    } catch (e) {
      setError("Error: " + e.message)
    }
    setLoading(false)
  }

  // merge actual + predicted for chart
  const chartData = result ? [
    ...result.actual.map(d => ({
      date  : d.date,
      actual: d.value,
    })),
    ...result.predicted.map(d => ({
      date     : d.date,
      predicted: d.value,
      upper    : d.upper,
      lower    : d.lower,
    }))
  ] : []

  const splitDate = result?.actual?.[result.actual.length - 1]?.date

  return (
    <div style={s.card}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <p style={s.stepLabel}>Predictive Analytics</p>
          <h2 style={s.title}>🔮 Forecast Future Trends</h2>
          <p style={s.sub}>
            Auto-detects time series data and forecasts future values
          </p>
        </div>
        <span style={{
          fontSize:11, padding:"4px 12px",
          borderRadius:20, background:"#DBEAFE",
          color:"#1D4ED8", fontWeight:600
        }}>
          Prophet + Linear Regression
        </span>
      </div>

      {/* Controls */}
      <div style={{
        display    : "flex",
        gap        : 10,
        flexWrap   : "wrap",
        marginBottom: 14,
        alignItems : "flex-end"
      }}>

        {/* Date column */}
        <div>
          <p style={s.label}>Date Column</p>
          <select
            value={dateCol}
            onChange={e => setDateCol(e.target.value)}
            style={s.select}>
            <option value="">Auto detect</option>
            {columns?.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Value column */}
        <div>
          <p style={s.label}>Value Column</p>
          <select
            value={valueCol}
            onChange={e => setValueCol(e.target.value)}
            style={s.select}>
            <option value="">Auto detect</option>
            {columns?.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Forecast period */}
        <div>
          <p style={s.label}>Forecast Days</p>
          <div style={{ display:"flex", gap:6 }}>
            {[30, 60, 90].map(p => (
              <button key={p}
                onClick={() => setPeriods(p)}
                style={{
                  padding     : "8px 14px",
                  borderRadius: 8,
                  border      : "none",
                  fontSize    : 12,
                  fontWeight  : 600,
                  cursor      : "pointer",
                  background  : periods === p
                    ? "#7F77DD" : "#F1F5F9",
                  color       : periods === p
                    ? "#fff" : "#374151"
                }}>
                {p}d
              </button>
            ))}
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={run}
          disabled={loading}
          style={{
            padding     : "10px 22px",
            background  : loading ? "#94A3B8" : "#7F77DD",
            color       : "#fff",
            border      : "none",
            borderRadius: 8,
            fontSize    : 13,
            fontWeight  : 600,
            cursor      : loading ? "not-allowed" : "pointer"
          }}>
          {loading ? "⏳ Forecasting..." : "🔮 Run Forecast"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={s.errorBox}>❌ {error}</div>
      )}

      {/* Results */}
      {result && (
        <div>
          {/* Stats cards */}
          <div style={{
            display            : "grid",
            gridTemplateColumns: "repeat(5,1fr)",
            gap                : 8,
            marginBottom       : 16
          }}>
            {[
              ["Current",     result.stats.latest,
                "#2563EB"],
              ["Forecast",    result.stats.forecast_next,
                "#7C3AED"],
              ["Change %",    result.stats.trend_pct + "%",
                result.stats.trend_pct >= 0
                  ? "#059669" : "#DC2626"],
              ["Trend",       result.stats.trend_dir,
                "#D97706"],
              ["Data Points", result.stats.data_points,
                "#374151"],
            ].map(([label, val, color]) => (
              <div key={label} style={{
                background  : "#F8FAFC",
                border      : "1px solid #E2E8F0",
                borderRadius: 10,
                padding     : "10px 12px",
                borderTop   : `3px solid ${color}`
              }}>
                <div style={{
                  fontSize:16, fontWeight:700,
                  color, margin:"0 0 4px"
                }}>
                  {val}
                </div>
                <div style={{ fontSize:10, color:"#64748B" }}>
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* AI Narrative */}
          {result.narrative && (
            <div style={{
              background  : "#F0F9FF",
              border      : "1px solid #BAE6FD",
              borderRadius: 10,
              padding     : "12px 14px",
              marginBottom: 16
            }}>
              <p style={{
                fontSize:11, fontWeight:700,
                color:"#0369A1", margin:"0 0 6px"
              }}>
                🤖 AI Forecast Explanation (Llama 3.2)
              </p>
              <p style={{
                fontSize:13, color:"#1E293B",
                lineHeight:1.7, margin:0
              }}>
                {result.narrative}
              </p>
            </div>
          )}

          {/* Chart */}
          <p style={s.label}>
            {result.value_col} — Actual vs Forecast
            <span style={{
              marginLeft:8, fontSize:11,
              color:"#9CA3AF", fontWeight:400
            }}>
              ({result.actual.length} actual +{" "}
              {result.predicted.length} predicted days)
            </span>
          </p>

          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart
              data={chartData}
              margin={{ top:10, right:20, left:0, bottom:60 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#F0F0F0"/>
              <XAxis
                dataKey="date"
                tick={{ fontSize:10 }}
                angle={-35}
                textAnchor="end"
                interval={Math.floor(chartData.length / 8)}/>
              <YAxis tick={{ fontSize:10 }}/>
              <Tooltip
                contentStyle={{
                  borderRadius:8, fontSize:11
                }}
                formatter={(val, name) => [
                  val?.toLocaleString(),
                  name === "actual"    ? "Actual"      :
                  name === "predicted" ? "Forecast"    :
                  name === "upper"     ? "Upper bound" :
                                        "Lower bound"
                ]}/>
              <Legend/>

              {/* Confidence interval */}
              <Area
                type="monotone"
                dataKey="upper"
                stroke="none"
                fill="#7F77DD"
                fillOpacity={0.1}
                name="upper"
              />
              <Area
                type="monotone"
                dataKey="lower"
                stroke="none"
                fill="#ffffff"
                fillOpacity={1}
                name="lower"
              />

              {/* Actual line */}
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#2563EB"
                strokeWidth={2}
                dot={{ r:2, fill:"#2563EB" }}
                name="actual"
                connectNulls={false}
              />

              {/* Forecast line */}
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#7F77DD"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={{ r:2, fill:"#7F77DD" }}
                name="predicted"
                connectNulls={false}
              />

              {/* Split line */}
              {splitDate && (
                <ReferenceLine
                  x={splitDate}
                  stroke="#F59E0B"
                  strokeDasharray="4 4"
                  label={{
                    value    : "Today",
                    position : "top",
                    fontSize : 10,
                    fill     : "#F59E0B"
                  }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div style={{
            display  : "flex",
            gap      : 16,
            marginTop: 10,
            fontSize : 11,
            color    : "#64748B",
            flexWrap : "wrap"
          }}>
            <span>
              <span style={{
                display      : "inline-block",
                width        : 20,
                height       : 2,
                background   : "#2563EB",
                verticalAlign: "middle",
                marginRight  : 4
              }}/>
              Actual data
            </span>
            <span>
              <span style={{
                display      : "inline-block",
                width        : 20,
                height       : 0,
                borderTop    : "2px dashed #7F77DD",
                verticalAlign: "middle",
                marginRight  : 4
              }}/>
              Forecast
            </span>
            <span>
              <span style={{
                display      : "inline-block",
                width        : 14,
                height       : 10,
                background   : "#7F77DD",
                opacity      : 0.15,
                verticalAlign: "middle",
                marginRight  : 4
              }}/>
              80% confidence interval
            </span>
          </div>
        </div>
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
    fontSize     : 11,
    fontWeight   : 600,
    color        : "#7C3AED",
    textTransform: "uppercase",
    letterSpacing: ".08em",
    margin       : "0 0 4px"
  },
  title   : {
    fontSize  : 17,
    fontWeight: 600,
    margin    : "0 0 4px",
    color     : "#1a1a2e"
  },
  sub     : { fontSize:13, color:"#9CA3AF", margin:0 },
  label   : {
    fontSize  : 12,
    fontWeight: 500,
    color     : "#374151",
    margin    : "0 0 5px"
  },
  select  : {
    padding     : "8px 10px",
    borderRadius: 8,
    border      : "1px solid #D1D5DB",
    fontSize    : 12,
    outline     : "none",
    background  : "#fff",
    color       : "#374151"
  },
  errorBox: {
    padding     : "10px 14px",
    background  : "#FEF2F2",
    border      : "1px solid #FECACA",
    borderRadius: 8,
    fontSize    : 13,
    color       : "#DC2626",
    marginBottom: 12
  }
}
