// frontend/src/Dashboard.jsx
import { useState, useEffect } from "react"
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from "recharts"

const COLORS = ["#2563EB","#7C3AED","#059669","#DC2626","#D97706","#0891B2","#BE185D","#065F46"]

// ── Auto detect column roles ─────────────────────
function analyzeColumns(columns, rows) {
  if (!columns?.length || !rows?.length) return {}

  let dateCol  = null
  let valueCol = null
  let groupCol = null
  let allNumeric = []
  let allText    = []

  columns.forEach(col => {
    const sample = rows[0]?.[col]
    const isNum  = !isNaN(parseFloat(sample)) && sample !== null
    const isDate = /\d{4}[-\/]\d{2}/.test(String(sample ?? ""))

    if (isDate && !dateCol)  dateCol  = col
    else if (isNum)          allNumeric.push(col)
    else                     allText.push(col)
  })

  // pick best value col (sales/revenue/amount first)
  valueCol = allNumeric.find(c =>
    /sale|revenue|amount|price|cost|profit|total|income/.test(c.toLowerCase())
  ) || allNumeric[0]

  // pick best group col (product/category/region first)
  groupCol = allText.find(c =>
    /product|category|region|dept|type|name|group/.test(c.toLowerCase())
  ) || allText[0]

  return { dateCol, valueCol, groupCol, allNumeric, allText }
}

// ── KPI Calculator ───────────────────────────────
function calcKPIs(rows, cols) {
  const { valueCol, groupCol, dateCol } = cols
  if (!valueCol || !rows?.length) return []

  const total   = rows.reduce((s,r) => s + (parseFloat(r[valueCol])||0), 0)
  const avg     = total / rows.length
  const max     = Math.max(...rows.map(r => parseFloat(r[valueCol])||0))
  const min     = Math.min(...rows.map(r => parseFloat(r[valueCol])||0))
  const count   = rows.length

  return [
    { label:`Total ${valueCol}`,   value: total.toLocaleString(),  icon:"💰", color:"#2563EB" },
    { label:"Average",             value: avg.toFixed(0),          icon:"📊", color:"#7C3AED" },
    { label:"Max Value",           value: max.toLocaleString(),    icon:"📈", color:"#059669" },
    { label:"Min Value",           value: min.toLocaleString(),    icon:"📉", color:"#DC2626" },
    { label:"Total Records",       value: count.toLocaleString(),  icon:"🗂️", color:"#D97706" },
  ]
}

// ── Chart data builders ──────────────────────────
function buildLineData(rows, dateCol, valueCol) {
  if (!dateCol || !valueCol) return []
  const grouped = {}
  rows.forEach(r => {
    const k = r[dateCol]
    grouped[k] = (grouped[k]||0) + (parseFloat(r[valueCol])||0)
  })
  return Object.entries(grouped)
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }))
}

function buildBarData(rows, groupCol, valueCol) {
  if (!groupCol || !valueCol) return []
  const grouped = {}
  rows.forEach(r => {
    const k = r[groupCol]
    grouped[k] = (grouped[k]||0) + (parseFloat(r[valueCol])||0)
  })
  return Object.entries(grouped)
    .sort(([,a],[,b]) => b - a)
    .slice(0, 10)
    .map(([name, value]) => ({ name, value }))
}

function buildPieData(rows, groupCol, valueCol) {
  if (!groupCol || !valueCol) return []
  const grouped = {}
  rows.forEach(r => {
    const k = r[groupCol]
    grouped[k] = (grouped[k]||0) + (parseFloat(r[valueCol])||0)
  })
  return Object.entries(grouped)
    .sort(([,a],[,b]) => b-a)
    .slice(0, 7)
    .map(([name, value]) => ({ name, value }))
}

function buildHeatmapData(rows, groupCol, dateCol, valueCol) {
  if (!groupCol || !dateCol || !valueCol) return []
  const result = {}
  rows.forEach(r => {
    const g = r[groupCol]
    const d = String(r[dateCol]).slice(0, 7) // YYYY-MM
    if (!result[g]) result[g] = {}
    result[g][d] = (result[g][d]||0) + (parseFloat(r[valueCol])||0)
  })
  return result
}

// ── Main Dashboard Component ─────────────────────
export default function Dashboard({ data, onClose }) {
  const [dark,     setDark]     = useState(false)
  const [page,     setPage]     = useState(1)
  const [chatMsg,  setChatMsg]  = useState("")
  const [chatLog,  setChatLog]  = useState([])
  const [filter,   setFilter]   = useState({ group: "all", dateFrom: "", dateTo: "" })
  const [barColor, setBarColor] = useState("#2563EB")
  const [lineColor,setLineColor]= useState("#7C3AED")
  const [chartMsg, setChartMsg] = useState(null)
  const [loading,  setLoading]  = useState(false)

  const rows    = data?.result?.rows    || []
  const columns = data?.result?.columns || []
  const cols    = analyzeColumns(columns, rows)

  // apply filters
  const filteredRows = rows.filter(r => {
    if (filter.group !== "all" && cols.groupCol) {
      if (r[cols.groupCol] !== filter.group) return false
    }
    return true
  })

  const kpis     = calcKPIs(filteredRows, cols)
  const lineData = buildLineData(filteredRows, cols.dateCol,  cols.valueCol)
  const barData  = buildBarData( filteredRows, cols.groupCol, cols.valueCol)
  const pieData  = buildPieData( filteredRows, cols.groupCol, cols.valueCol)

  // unique groups for filter
  const groups = cols.groupCol
    ? [...new Set(rows.map(r => r[cols.groupCol]))]
    : []

  // ── Chat handler ─────────────────────────────
  const handleChat = async () => {
    if (!chatMsg.trim()) return
    const msg = chatMsg.trim()
    setChatLog(prev => [...prev, { role:"user", text: msg }])
    setChatMsg("")
    setLoading(true)

    try {
      // parse simple commands locally first
      const m = msg.toLowerCase()

      // color changes
      if (m.includes("bar") && m.includes("color")) {
        const colorMap = {
          "red":"#DC2626","blue":"#2563EB","green":"#059669",
          "purple":"#7C3AED","orange":"#D97706","teal":"#0891B2"
        }
        for (const [name, hex] of Object.entries(colorMap)) {
          if (m.includes(name)) {
            setBarColor(hex)
            setChatLog(prev => [...prev, {
              role:"ai",
              text:`✅ Bar chart color changed to ${name}`
            }])
            setLoading(false)
            return
          }
        }
      }

      if (m.includes("line") && m.includes("color")) {
        const colorMap = {
          "red":"#DC2626","blue":"#2563EB","green":"#059669",
          "purple":"#7C3AED","orange":"#D97706","teal":"#0891B2"
        }
        for (const [name, hex] of Object.entries(colorMap)) {
          if (m.includes(name)) {
            setLineColor(hex)
            setChatLog(prev => [...prev, {
              role:"ai",
              text:`✅ Line chart color changed to ${name}`
            }])
            setLoading(false)
            return
          }
        }
      }

      // filter by group
      if (m.includes("show only") || m.includes("filter by")) {
        for (const g of groups) {
          if (m.includes(g.toLowerCase())) {
            setFilter(prev => ({ ...prev, group: g }))
            setChatLog(prev => [...prev, {
              role:"ai",
              text:`✅ Filtered to show only: ${g}`
            }])
            setLoading(false)
            return
          }
        }
      }

      // clear filter
      if (m.includes("show all") || m.includes("clear filter") || m.includes("reset")) {
        setFilter({ group:"all", dateFrom:"", dateTo:"" })
        setChatLog(prev => [...prev, {
          role:"ai",
          text:"✅ Filters cleared — showing all data"
        }])
        setLoading(false)
        return
      }

      // send to backend for complex queries
      const res  = await fetch("http://127.0.0.1:8000/query", {
        method  : "POST",
        headers : { "Content-Type":"application/json" },
        body    : JSON.stringify({ question: msg })
      })
      const resp = await res.json()

      if (resp.result?.rows?.length > 0) {
        setChartMsg(resp)
        setChatLog(prev => [...prev, {
          role : "ai",
          text : `✅ Updated chart with ${resp.result.rows.length} rows\nSQL: ${resp.sql}`
        }])
      } else {
        setChatLog(prev => [...prev, {
          role:"ai",
          text:"No data returned for that query. Try rephrasing."
        }])
      }
    } catch(e) {
      setChatLog(prev => [...prev, { role:"ai", text:"Error: "+e.message }])
    }
    setLoading(false)
  }

  // ── Themes ───────────────────────────────────
  const th = dark ? {
    bg     : "#0F172A",
    card   : "#1E293B",
    border : "#334155",
    text   : "#F1F5F9",
    subtext: "#94A3B8",
    header : "#1E40AF",
    chat   : "#1E293B",
    chatBg : "#0F172A"
  } : {
    bg     : "#F8FAFC",
    card   : "#FFFFFF",
    border : "#E2E8F0",
    text   : "#1E293B",
    subtext: "#64748B",
    header : "#1E293B",
    chat   : "#F1F5F9",
    chatBg : "#FFFFFF"
  }

  const activeLineData = chartMsg
    ? buildLineData(chartMsg.result.rows,
        analyzeColumns(chartMsg.result.columns, chartMsg.result.rows).dateCol,
        analyzeColumns(chartMsg.result.columns, chartMsg.result.rows).valueCol)
    : lineData

  const activeBarData = chartMsg
    ? buildBarData(chartMsg.result.rows,
        analyzeColumns(chartMsg.result.columns, chartMsg.result.rows).groupCol,
        analyzeColumns(chartMsg.result.columns, chartMsg.result.rows).valueCol)
    : barData

  return (
    <div style={{
      position  : "fixed",
      top:0, left:0, right:0, bottom:0,
      background: "rgba(0,0,0,0.7)",
      zIndex    : 1000,
      display   : "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <div style={{
        width     : "95vw",
        height    : "92vh",
        background: th.bg,
        borderRadius: 16,
        overflow  : "hidden",
        display   : "flex",
        flexDirection: "column"
      }}>

        {/* ── TOP BAR ── */}
        <div style={{
          background: th.header,
          padding   : "0 20px",
          height    : 56,
          display   : "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontSize:18, fontWeight:700, color:"#fff" }}>
              🤖 AI Data Analyst Dashboard
            </span>
            <span style={{
              fontSize:11, padding:"2px 10px",
              background:"#2563EB", color:"#fff",
              borderRadius:20
            }}>
              {rows.length} rows · {columns.length} columns
            </span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {/* Page tabs */}
            {["Executive","Detailed","Summary"].map((p,i) => (
              <button key={i} onClick={() => setPage(i+1)}
                style={{
                  padding    : "5px 14px",
                  borderRadius: 20,
                  border     : "none",
                  fontSize   : 12,
                  fontWeight : 600,
                  cursor     : "pointer",
                  background : page===i+1 ? "#F2C811" : "transparent",
                  color      : page===i+1 ? "#1a1a2e"  : "#fff"
                }}>
                {p}
              </button>
            ))}
            {/* Dark mode toggle */}
            <button onClick={() => setDark(d => !d)}
              style={{
                padding    : "5px 12px",
                borderRadius: 20,
                border     : "1px solid #475569",
                background : "transparent",
                color      : "#fff",
                fontSize   : 12,
                cursor     : "pointer"
              }}>
              {dark ? "☀️ Light" : "🌙 Dark"}
            </button>
            {/* Close */}
            <button onClick={onClose}
              style={{
                width      : 32, height:32,
                borderRadius: "50%",
                border     : "none",
                background : "#DC2626",
                color      : "#fff",
                fontSize   : 16,
                cursor     : "pointer",
                fontWeight : 700
              }}>
              ✕
            </button>
          </div>
        </div>

        {/* ── SUBTITLE BAR ── */}
        <div style={{
          background: "#2563EB",
          padding   : "4px 20px",
          fontSize  : 11,
          color     : "#BFDBFE",
          display   : "flex",
          gap       : 20,
          flexShrink: 0
        }}>
          <span>Table: user_data</span>
          <span>Columns: {columns.join(", ")}</span>
          <span>Powered by Llama 3.2 (Local)</span>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div style={{
          flex    : 1,
          overflow: "auto",
          padding : 16,
          display : "flex",
          gap     : 14
        }}>

          {/* LEFT — Dashboard pages */}
          <div style={{ flex:1, overflow:"auto" }}>

            {/* ── PAGE 1: Executive Dashboard ── */}
            {page === 1 && (
              <div>
                {/* Filters row */}
                <div style={{
                  display      : "flex",
                  gap          : 10,
                  marginBottom : 14,
                  flexWrap     : "wrap",
                  alignItems   : "center"
                }}>
                  <span style={{ fontSize:12, color:th.subtext }}>
                    Filters:
                  </span>
                  {cols.groupCol && (
                    <select
                      value={filter.group}
                      onChange={e => setFilter(f => ({...f, group:e.target.value}))}
                      style={{
                        padding     : "5px 10px",
                        borderRadius: 6,
                        border      : `1px solid ${th.border}`,
                        background  : th.card,
                        color       : th.text,
                        fontSize    : 12
                      }}>
                      <option value="all">All {cols.groupCol}s</option>
                      {groups.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  )}
                  <button
                    onClick={() => setFilter({group:"all",dateFrom:"",dateTo:""})}
                    style={{
                      padding     : "5px 12px",
                      borderRadius: 6,
                      border      : `1px solid ${th.border}`,
                      background  : "transparent",
                      color       : th.subtext,
                      fontSize    : 12,
                      cursor      : "pointer"
                    }}>
                    Reset
                  </button>
                </div>

                {/* KPI Cards */}
                <div style={{
                  display            : "grid",
                  gridTemplateColumns: "repeat(5,1fr)",
                  gap                : 10,
                  marginBottom       : 14
                }}>
                  {kpis.map((k,i) => (
                    <div key={i} style={{
                      background  : th.card,
                      border      : `1px solid ${th.border}`,
                      borderRadius: 10,
                      padding     : "12px 14px",
                      borderTop   : `3px solid ${k.color}`
                    }}>
                      <div style={{ fontSize:20 }}>{k.icon}</div>
                      <div style={{
                        fontSize  : 18,
                        fontWeight: 700,
                        color     : k.color,
                        margin    : "4px 0 2px"
                      }}>
                        {k.value}
                      </div>
                      <div style={{ fontSize:10, color:th.subtext }}>
                        {k.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Line + Donut row */}
                <div style={{
                  display            : "grid",
                  gridTemplateColumns: "1.7fr 1fr",
                  gap                : 10,
                  marginBottom       : 10
                }}>
                  {/* Line Chart */}
                  <div style={{
                    background  : th.card,
                    border      : `1px solid ${th.border}`,
                    borderRadius: 10,
                    padding     : 14
                  }}>
                    <p style={{
                      fontSize:12, fontWeight:600,
                      color:th.text, margin:"0 0 10px"
                    }}>
                      📈 Trend Over Time
                      {cols.dateCol
                        ? ` — by ${cols.dateCol}`
                        : " — no date column"}
                    </p>
                    {activeLineData.length > 0
                      ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <LineChart data={activeLineData}
                            margin={{top:5,right:10,left:0,bottom:40}}>
                            <CartesianGrid strokeDasharray="3 3"
                              stroke={th.border}/>
                            <XAxis dataKey="date"
                              tick={{fontSize:10,fill:th.subtext}}
                              angle={-35} textAnchor="end"/>
                            <YAxis tick={{fontSize:10,fill:th.subtext}}/>
                            <Tooltip
                              contentStyle={{
                                background:th.card,
                                border:`1px solid ${th.border}`,
                                borderRadius:8, fontSize:12
                              }}/>
                            <Line type="monotone" dataKey="value"
                              stroke={lineColor} strokeWidth={2}
                              dot={{fill:lineColor,r:3}}
                              label={{
                                position:"top", fontSize:9,
                                fill:th.subtext,
                                formatter:v=>v.toLocaleString()
                              }}/>
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{
                          height:220, display:"flex",
                          alignItems:"center",
                          justifyContent:"center",
                          color:th.subtext, fontSize:13
                        }}>
                          No date column detected
                        </div>
                      )
                    }
                  </div>

                  {/* Donut / Pie */}
                  <div style={{
                    background  : th.card,
                    border      : `1px solid ${th.border}`,
                    borderRadius: 10,
                    padding     : 14
                  }}>
                    <p style={{
                      fontSize:12, fontWeight:600,
                      color:th.text, margin:"0 0 10px"
                    }}>
                      🍩 Distribution
                    </p>
                    {pieData.length > 0
                      ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie data={pieData} dataKey="value"
                              nameKey="name" cx="50%" cy="45%"
                              innerRadius={50} outerRadius={80}
                              label={({name,percent}) =>
                                `${name} ${(percent*100).toFixed(0)}%`
                              }
                              labelLine={true}>
                              {pieData.map((_,i) => (
                                <Cell key={i}
                                  fill={COLORS[i%COLORS.length]}/>
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                background:th.card,
                                border:`1px solid ${th.border}`,
                                borderRadius:8, fontSize:11
                              }}/>
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{
                          height:220, display:"flex",
                          alignItems:"center",
                          justifyContent:"center",
                          color:th.subtext, fontSize:13
                        }}>
                          No category column detected
                        </div>
                      )
                    }
                  </div>
                </div>

                {/* Bar + Table row */}
                <div style={{
                  display            : "grid",
                  gridTemplateColumns: "1fr 1.2fr",
                  gap                : 10
                }}>
                  {/* Bar Chart */}
                  <div style={{
                    background  : th.card,
                    border      : `1px solid ${th.border}`,
                    borderRadius: 10,
                    padding     : 14
                  }}>
                    <p style={{
                      fontSize:12, fontWeight:600,
                      color:th.text, margin:"0 0 10px"
                    }}>
                      📊 Top N Comparison
                    </p>
                    {activeBarData.length > 0
                      ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={activeBarData}
                            margin={{top:5,right:10,left:0,bottom:40}}>
                            <CartesianGrid strokeDasharray="3 3"
                              stroke={th.border}/>
                            <XAxis dataKey="name"
                              tick={{fontSize:10,fill:th.subtext}}
                              angle={-35} textAnchor="end"/>
                            <YAxis tick={{fontSize:10,fill:th.subtext}}/>
                            <Tooltip
                              contentStyle={{
                                background:th.card,
                                border:`1px solid ${th.border}`,
                                borderRadius:8, fontSize:12
                              }}/>
                            <Bar dataKey="value" fill={barColor}
                              radius={[4,4,0,0]}
                              label={{
                                position:"insideTop", fontSize:9,
                                fill:"#fff",
                                formatter:v=>v.toLocaleString()
                              }}/>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{
                          height:220, display:"flex",
                          alignItems:"center",
                          justifyContent:"center",
                          color:th.subtext, fontSize:13
                        }}>
                          No data
                        </div>
                      )
                    }
                  </div>

                  {/* Data Table */}
                  <div style={{
                    background  : th.card,
                    border      : `1px solid ${th.border}`,
                    borderRadius: 10,
                    padding     : 14,
                    overflow    : "auto"
                  }}>
                    <p style={{
                      fontSize:12, fontWeight:600,
                      color:th.text, margin:"0 0 10px"
                    }}>
                      📋 Data Table
                      <span style={{
                        fontSize:10, color:th.subtext,
                        marginLeft:8, fontWeight:400
                      }}>
                        ({filteredRows.length} rows)
                      </span>
                    </p>
                    <div style={{ overflow:"auto", maxHeight:220 }}>
                      <table style={{
                        width:"100%",
                        borderCollapse:"collapse",
                        fontSize:11
                      }}>
                        <thead>
                          <tr>
                            {columns.map(c => (
                              <th key={c} style={{
                                background : dark?"#334155":"#F1F5F9",
                                padding    : "6px 10px",
                                textAlign  : "left",
                                fontWeight : 600,
                                color      : th.text,
                                borderBottom:`2px solid ${th.border}`,
                                whiteSpace : "nowrap",
                                position   : "sticky",
                                top        : 0
                              }}>
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRows.slice(0,20).map((row,i) => (
                            <tr key={i} style={{
                              background: i%2===0
                                ? "transparent"
                                : dark?"#1E293B":"#F8FAFC"
                            }}>
                              {columns.map(c => (
                                <td key={c} style={{
                                  padding    : "5px 10px",
                                  color      : th.subtext,
                                  borderBottom:`1px solid ${th.border}`,
                                  whiteSpace : "nowrap"
                                }}>
                                  {row[c] ?? "—"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filteredRows.length > 20 && (
                        <p style={{
                          fontSize:10, color:th.subtext,
                          textAlign:"center", padding:"6px 0"
                        }}>
                          Showing 20 of {filteredRows.length} rows
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── PAGE 2: Detailed Analysis ── */}
            {page === 2 && (
              <div style={{
                display            : "grid",
                gridTemplateColumns: "1fr 1fr",
                gap                : 10
              }}>
                {/* Scatter */}
                <div style={{
                  background:th.card, border:`1px solid ${th.border}`,
                  borderRadius:10, padding:14
                }}>
                  <p style={{fontSize:12,fontWeight:600,color:th.text,margin:"0 0 10px"}}>
                    🔵 Scatter — Correlation
                  </p>
                  {cols.allNumeric?.length >= 2
                    ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <ScatterChart margin={{top:5,right:10,left:0,bottom:5}}>
                          <CartesianGrid stroke={th.border}/>
                          <XAxis dataKey={cols.allNumeric[0]}
                            name={cols.allNumeric[0]}
                            tick={{fontSize:10}}/>
                          <YAxis dataKey={cols.allNumeric[1]}
                            name={cols.allNumeric[1]}
                            tick={{fontSize:10}}/>
                          <Tooltip cursor={{strokeDasharray:"3 3"}}/>
                          <Scatter
                            data={filteredRows.slice(0,100).map(r=>({
                              [cols.allNumeric[0]]: parseFloat(r[cols.allNumeric[0]])||0,
                              [cols.allNumeric[1]]: parseFloat(r[cols.allNumeric[1]])||0
                            }))}
                            fill="#2563EB"/>
                        </ScatterChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{height:260,display:"flex",alignItems:"center",justifyContent:"center",color:th.subtext,fontSize:13}}>
                        Need at least 2 numeric columns
                      </div>
                    )
                  }
                </div>

                {/* Second bar — grouped */}
                <div style={{
                  background:th.card, border:`1px solid ${th.border}`,
                  borderRadius:10, padding:14
                }}>
                  <p style={{fontSize:12,fontWeight:600,color:th.text,margin:"0 0 10px"}}>
                    📊 Category Breakdown
                  </p>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={barData.slice(0,8)}
                      layout="vertical"
                      margin={{top:5,right:30,left:60,bottom:5}}>
                      <CartesianGrid stroke={th.border}/>
                      <XAxis type="number" tick={{fontSize:10}}/>
                      <YAxis type="category" dataKey="name" tick={{fontSize:10}}/>
                      <Tooltip/>
                      <Bar dataKey="value" radius={[0,4,4,0]}>
                        {barData.slice(0,8).map((_,i) => (
                          <Cell key={i} fill={COLORS[i%COLORS.length]}/>
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Second line — all numeric cols */}
                <div style={{
                  background:th.card, border:`1px solid ${th.border}`,
                  borderRadius:10, padding:14
                }}>
                  <p style={{fontSize:12,fontWeight:600,color:th.text,margin:"0 0 10px"}}>
                    📈 Multi-metric Trend
                  </p>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={lineData}
                      margin={{top:5,right:10,left:0,bottom:40}}>
                      <CartesianGrid stroke={th.border}/>
                      <XAxis dataKey="date" tick={{fontSize:10}} angle={-35} textAnchor="end"/>
                      <YAxis tick={{fontSize:10}}/>
                      <Tooltip/>
                      <Legend/>
                      <Line type="monotone" dataKey="value"
                        stroke={COLORS[0]} strokeWidth={2}
                        name={cols.valueCol}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Full pie */}
                <div style={{
                  background:th.card, border:`1px solid ${th.border}`,
                  borderRadius:10, padding:14
                }}>
                  <p style={{fontSize:12,fontWeight:600,color:th.text,margin:"0 0 10px"}}>
                    🥧 Full Distribution
                  </p>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" outerRadius={100}
                        label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`}>
                        {pieData.map((_,i)=>(
                          <Cell key={i} fill={COLORS[i%COLORS.length]}/>
                        ))}
                      </Pie>
                      <Tooltip/>
                      <Legend/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ── PAGE 3: Summary ── */}
            {page === 3 && (
              <div style={{
                background:th.card, border:`1px solid ${th.border}`,
                borderRadius:10, padding:20
              }}>
                <p style={{fontSize:14,fontWeight:700,color:th.text,margin:"0 0 16px"}}>
                  📄 Data Summary
                </p>

                <div style={{
                  display:"grid",
                  gridTemplateColumns:"1fr 1fr",
                  gap:14, marginBottom:20
                }}>
                  <div>
                    <p style={{fontSize:12,fontWeight:600,color:th.subtext,margin:"0 0 8px"}}>
                      DATASET INFO
                    </p>
                    {[
                      ["Total Rows",    rows.length],
                      ["Total Columns", columns.length],
                      ["Value Column",  cols.valueCol || "None"],
                      ["Group Column",  cols.groupCol || "None"],
                      ["Date Column",   cols.dateCol  || "None"],
                    ].map(([k,v]) => (
                      <div key={k} style={{
                        display:"flex", justifyContent:"space-between",
                        padding:"6px 0",
                        borderBottom:`1px solid ${th.border}`,
                        fontSize:13
                      }}>
                        <span style={{color:th.subtext}}>{k}</span>
                        <span style={{color:th.text,fontWeight:500}}>{v}</span>
                      </div>
                    ))}
                  </div>

                  <div>
                    <p style={{fontSize:12,fontWeight:600,color:th.subtext,margin:"0 0 8px"}}>
                      ALL COLUMNS
                    </p>
                    {columns.map((c,i) => (
                      <div key={i} style={{
                        display:"flex", justifyContent:"space-between",
                        padding:"5px 0",
                        borderBottom:`1px solid ${th.border}`,
                        fontSize:12
                      }}>
                        <span style={{color:th.text}}>{c}</span>
                        <span style={{
                          fontSize:10, padding:"2px 8px",
                          borderRadius:20,
                          background: c===cols.valueCol?"#DBEAFE":
                                     c===cols.groupCol?"#D1FAE5":
                                     c===cols.dateCol ?"#FEF3C7":"#F1F5F9",
                          color: c===cols.valueCol?"#1D4ED8":
                                 c===cols.groupCol?"#065F46":
                                 c===cols.dateCol ?"#92400E":"#64748B"
                        }}>
                          {c===cols.valueCol?"value":
                           c===cols.groupCol?"group":
                           c===cols.dateCol ?"date":"text"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* KPI summary table */}
                <p style={{fontSize:12,fontWeight:600,color:th.subtext,margin:"0 0 8px"}}>
                  KPI SUMMARY
                </p>
                <div style={{
                  display:"grid",
                  gridTemplateColumns:"repeat(5,1fr)",
                  gap:10
                }}>
                  {kpis.map((k,i) => (
                    <div key={i} style={{
                      background:dark?"#1E293B":"#F8FAFC",
                      border:`1px solid ${th.border}`,
                      borderRadius:8, padding:"10px 12px",
                      textAlign:"center"
                    }}>
                      <div style={{fontSize:18}}>{k.icon}</div>
                      <div style={{
                        fontSize:16, fontWeight:700,
                        color:k.color, margin:"4px 0 2px"
                      }}>
                        {k.value}
                      </div>
                      <div style={{fontSize:10,color:th.subtext}}>
                        {k.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — Chat panel */}
          <div style={{
            width      : 280,
            flexShrink : 0,
            background : th.card,
            border     : `1px solid ${th.border}`,
            borderRadius: 10,
            display    : "flex",
            flexDirection: "column",
            overflow   : "hidden"
          }}>
            {/* Chat header */}
            <div style={{
              padding   : "10px 14px",
              borderBottom:`1px solid ${th.border}`,
              fontSize  : 12,
              fontWeight: 600,
              color     : th.text
            }}>
              💬 Customize Dashboard
            </div>

            {/* Suggestions */}
            <div style={{
              padding:"8px 10px",
              borderBottom:`1px solid ${th.border}`,
              display:"flex", flexWrap:"wrap", gap:5
            }}>
              {[
                "change bar color to red",
                "change line color to green",
                "show only Electronics",
                "show all",
                "show sales by month",
              ].map((s,i) => (
                <button key={i}
                  onClick={() => {
                    setChatMsg(s)
                  }}
                  style={{
                    fontSize:10, padding:"3px 8px",
                    borderRadius:20,
                    border:`1px solid ${th.border}`,
                    background:"transparent",
                    color:th.subtext, cursor:"pointer"
                  }}>
                  {s}
                </button>
              ))}
            </div>

            {/* Chat messages */}
            <div style={{
              flex    :1, overflow:"auto",
              padding :"10px"
            }}>
              {chatLog.length === 0 && (
                <p style={{
                  fontSize:12, color:th.subtext,
                  textAlign:"center", marginTop:20
                }}>
                  Ask me to change colors, filter data, or update charts
                </p>
              )}
              {chatLog.map((m,i) => (
                <div key={i} style={{
                  marginBottom:8,
                  display    :"flex",
                  justifyContent: m.role==="user"?"flex-end":"flex-start"
                }}>
                  <div style={{
                    maxWidth    : "85%",
                    padding     : "7px 10px",
                    borderRadius: m.role==="user"
                      ? "12px 12px 2px 12px"
                      : "12px 12px 12px 2px",
                    background  : m.role==="user"
                      ? "#2563EB"
                      : dark?"#334155":"#F1F5F9",
                    color       : m.role==="user"
                      ? "#fff" : th.text,
                    fontSize    : 12,
                    lineHeight  : 1.5,
                    whiteSpace  : "pre-wrap"
                  }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{
                  fontSize:12, color:th.subtext,
                  textAlign:"center"
                }}>
                  ⏳ Processing...
                </div>
              )}
            </div>

            {/* Chat input */}
            <div style={{
              padding     :"10px",
              borderTop   :`1px solid ${th.border}`,
              display     :"flex",
              gap         :6
            }}>
              <input
                value={chatMsg}
                onChange={e => setChatMsg(e.target.value)}
                onKeyDown={e => e.key==="Enter" && handleChat()}
                placeholder="Change chart or filter..."
                style={{
                  flex        :1,
                  padding     :"7px 10px",
                  borderRadius:8,
                  border      :`1px solid ${th.border}`,
                  background  :th.chatBg,
                  color       :th.text,
                  fontSize    :12,
                  outline     :"none"
                }}
              />
              <button
                onClick={handleChat}
                disabled={loading || !chatMsg.trim()}
                style={{
                  padding     :"7px 12px",
                  background  :"#2563EB",
                  color       :"#fff",
                  border      :"none",
                  borderRadius:8,
                  fontSize    :12,
                  cursor      :"pointer"
                }}>
                →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}