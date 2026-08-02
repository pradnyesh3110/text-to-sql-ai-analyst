// frontend/src/SchemaViewer.jsx
import { useState } from "react"

export default function SchemaViewer({ visible }) {
  const [schema,  setSchema]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [active,  setActive]  = useState(null)

  const fetchSchema = async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch("http://127.0.0.1:8000/schema-details")
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setSchema(data.tables)
        const keys = Object.keys(data.tables || {})
        // prefer user_data table
        setActive(
          keys.includes("user_data")
            ? "user_data"
            : keys[0]
        )
      }
    } catch (e) {
      setError("Failed to load schema: " + e.message)
    }
    setLoading(false)
  }

  if (!visible) return null

  const roleColors = {
    "💰 Measure"    : { bg:"#ECFDF5", color:"#065F46" },
    "🏷️ Category"   : { bg:"#FFF7ED", color:"#C2410C" },
    "🌍 Dimension"  : { bg:"#F0F9FF", color:"#0369A1" },
    "📅 Date"       : { bg:"#F0FDF4", color:"#166534" },
    "🔑 Primary Key": { bg:"#FEF9C3", color:"#854D0E" },
    "🆔 Identifier" : { bg:"#F5F3FF", color:"#6D28D9" },
    "🔢 Numeric"    : { bg:"#EFF6FF", color:"#1D4ED8" },
    "📝 Text"       : { bg:"#F9FAFB", color:"#374151" },
  }

  const getRoleStyle = (role) => {
    for (const [key, style] of Object.entries(roleColors)) {
      if (role?.startsWith(key.slice(0,3))) return style
    }
    return { bg:"#F9FAFB", color:"#374151" }
  }

  const tables     = schema ? Object.keys(schema) : []
  const activeData = schema && active ? schema[active] : null

  return (
    <div style={s.card}>

      {/* Header */}
      <div style={s.header}>
        <div>
          <p style={s.stepLabel}>Schema Explorer</p>
          <h2 style={s.title}>🗂️ Database Schema</h2>
          <p style={s.sub}>
            Column types, roles, keys and schema pattern
          </p>
        </div>
        <button onClick={fetchSchema} style={s.refreshBtn}>
          {loading ? "⏳ Loading..." : "🔄 Load Schema"}
        </button>
      </div>

      {/* Initial state */}
      {!schema && !loading && !error && (
        <div style={{
          textAlign : "center",
          padding   : "30px 0",
          color     : "#9CA3AF"
        }}>
          <p style={{ fontSize:32, margin:"0 0 8px" }}>🗂️</p>
          <p style={{ fontSize:13, margin:"0 0 16px" }}>
            Click "Load Schema" to view your database structure
          </p>
          <button onClick={fetchSchema} style={{
            padding     : "10px 24px",
            background  : "#1E293B",
            color       : "#fff",
            border      : "none",
            borderRadius: 8,
            fontSize    : 13,
            fontWeight  : 600,
            cursor      : "pointer"
          }}>
            🔄 Load Schema
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <p style={{
          textAlign: "center",
          fontSize : 13,
          color    : "#9CA3AF",
          padding  : "20px 0"
        }}>
          ⏳ Loading schema...
        </p>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding     : "12px 14px",
          background  : "#FEF2F2",
          border      : "1px solid #FECACA",
          borderRadius: 8,
          fontSize    : 13,
          color       : "#DC2626"
        }}>
          ❌ {error}
        </div>
      )}

      {/* Schema content */}
      {schema && !loading && (
        <>
          {/* Table tabs */}
          {tables.length > 1 && (
            <div style={{
              display     : "flex",
              gap         : 6,
              flexWrap    : "wrap",
              marginBottom: 14
            }}>
              {tables.map(t => (
                <button key={t}
                  onClick={() => setActive(t)}
                  style={{
                    padding     : "5px 14px",
                    borderRadius: 20,
                    border      : "none",
                    fontSize    : 12,
                    fontWeight  : 600,
                    cursor      : "pointer",
                    background  : active === t
                      ? "#1E293B" : "#F1F5F9",
                    color       : active === t
                      ? "#fff" : "#374151"
                  }}>
                  {t}
                  <span style={{
                    marginLeft: 6,
                    fontSize  : 10,
                    opacity   : 0.7
                  }}>
                    ({schema[t]?.row_count || 0} rows)
                  </span>
                </button>
              ))}
            </div>
          )}

          {activeData && (
            <>
              {/* Schema type banner */}
              <div style={{
                display     : "flex",
                alignItems  : "center",
                gap         : 12,
                marginBottom: 14,
                padding     : "12px 16px",
                background  : "#F8FAFC",
                borderRadius: 10,
                border      : "1px solid #E2E8F0"
              }}>
                <span style={{ fontSize:24 }}>
                  {activeData.schema_type?.split(" ")[0]}
                </span>
                <div style={{ flex:1 }}>
                  <p style={{
                    fontSize  : 14,
                    fontWeight: 700,
                    color     : "#1E293B",
                    margin    : "0 0 2px"
                  }}>
                    {activeData.schema_type}
                  </p>
                  <p style={{
                    fontSize: 12,
                    color   : "#64748B",
                    margin  : 0
                  }}>
                    {activeData.schema_note}
                  </p>
                </div>
                <div style={{
                  textAlign: "right",
                  fontSize : 12,
                  color    : "#64748B"
                }}>
                  <strong style={{ color:"#1E293B" }}>
                    {activeData.row_count?.toLocaleString()}
                  </strong> rows
                  <br/>
                  <strong style={{ color:"#1E293B" }}>
                    {activeData.columns?.length}
                  </strong> columns
                </div>
              </div>

              {/* Column cards — visual layout */}
              <p style={{
                fontSize  : 12,
                fontWeight: 600,
                color     : "#64748B",
                margin    : "0 0 10px",
                textTransform: "uppercase",
                letterSpacing: "0.06em"
              }}>
                Columns
              </p>

              <div style={{
                display            : "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap                : 8,
                marginBottom       : 16
              }}>
                {activeData.columns?.map((col, i) => {
                  const rs = getRoleStyle(col.role)
                  return (
                    <div key={i} style={{
                      background  : rs.bg,
                      border      : `1px solid ${rs.color}30`,
                      borderRadius: 10,
                      padding     : "10px 12px"
                    }}>
                      <div style={{
                        display    : "flex",
                        alignItems : "center",
                        gap        : 6,
                        marginBottom: 4
                      }}>
                        {col.is_pk && (
                          <span style={{ fontSize:14 }}>🔑</span>
                        )}
                        {col.fk_ref && (
                          <span style={{ fontSize:14 }}>🔗</span>
                        )}
                        <code style={{
                          fontSize  : 12,
                          fontWeight: 700,
                          color     : "#1E293B"
                        }}>
                          {col.name}
                        </code>
                      </div>
                      <div style={{
                        fontSize: 11,
                        color   : "#64748B",
                        margin  : "0 0 6px",
                        fontFamily: "monospace"
                      }}>
                        {col.type}
                      </div>
                      <span style={{
                        fontSize    : 10,
                        padding     : "2px 8px",
                        borderRadius: 20,
                        background  : "#fff",
                        color       : rs.color,
                        fontWeight  : 600,
                        border      : `1px solid ${rs.color}40`
                      }}>
                        {col.role}
                      </span>
                      {col.fk_ref && (
                        <div style={{
                          fontSize  : 10,
                          color     : "#0369A1",
                          marginTop : 4
                        }}>
                          → {col.fk_ref}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Full table view */}
              <details style={{ marginBottom:10 }}>
                <summary style={{
                  fontSize  : 12,
                  fontWeight: 600,
                  color     : "#374151",
                  cursor    : "pointer",
                  padding   : "8px 0"
                }}>
                  📋 View as table
                </summary>
                <div style={{ overflowX:"auto", marginTop:8 }}>
                  <table style={{
                    width         : "100%",
                    borderCollapse: "collapse",
                    fontSize      : 12
                  }}>
                    <thead>
                      <tr>
                        {["Column","Type","PK","FK Ref","Role","Use for"].map(h => (
                          <th key={h} style={s.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeData.columns?.map((col, i) => {
                        const rs = getRoleStyle(col.role)
                        return (
                          <tr key={i} style={{
                            background: i%2===0?"#fff":"#F8FAFC"
                          }}>
                            <td style={s.td}>
                              <code style={{
                                background  : "#F1F5F9",
                                padding     : "1px 6px",
                                borderRadius: 4,
                                fontSize    : 11,
                                color       : "#1E293B",
                                fontWeight  : 600
                              }}>
                                {col.name}
                              </code>
                            </td>
                            <td style={{
                              ...s.td,
                              fontFamily: "monospace",
                              color     : "#64748B",
                              fontSize  : 11
                            }}>
                              {col.type}
                            </td>
                            <td style={{
                              ...s.td,
                              textAlign: "center"
                            }}>
                              {col.is_pk ? "🔑" : ""}
                            </td>
                            <td style={s.td}>
                              {col.fk_ref
                                ? <span style={{
                                    fontSize    : 10,
                                    background  : "#E0F2FE",
                                    color       : "#0369A1",
                                    padding     : "2px 6px",
                                    borderRadius: 4
                                  }}>
                                    → {col.fk_ref}
                                  </span>
                                : <span style={{
                                    color:"#D1D5DB"
                                  }}>—</span>
                              }
                            </td>
                            <td style={s.td}>
                              <span style={{
                                fontSize    : 10,
                                padding     : "2px 8px",
                                borderRadius: 20,
                                background  : rs.bg,
                                color       : rs.color,
                                fontWeight  : 600,
                                whiteSpace  : "nowrap"
                              }}>
                                {col.role}
                              </span>
                            </td>
                            <td style={{
                              ...s.td,
                              fontSize: 11,
                              color   : "#9CA3AF"
                            }}>
                              {col.role?.includes("Measure")
                                ? "SUM / AVG / COUNT"
                                : col.role?.includes("Date")
                                ? "Time filters / trend"
                                : col.role?.includes("Category") ||
                                  col.role?.includes("Dimension")
                                ? "GROUP BY / filter"
                                : col.role?.includes("Key")
                                ? "Unique identifier"
                                : "—"}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </details>

              {/* Legend */}
              <div style={{
                padding     : "10px 14px",
                background  : "#F8FAFC",
                borderRadius: 8,
                display     : "flex",
                flexWrap    : "wrap",
                gap         : 6,
                alignItems  : "center"
              }}>
                <span style={{
                  fontSize  : 11,
                  color     : "#64748B",
                  fontWeight: 600,
                  marginRight: 4
                }}>
                  Legend:
                </span>
                {[
                  ["💰 Measure",    "#ECFDF5","#065F46"],
                  ["🏷️ Category",   "#FFF7ED","#C2410C"],
                  ["🌍 Dimension",  "#F0F9FF","#0369A1"],
                  ["📅 Date",       "#F0FDF4","#166534"],
                  ["🔑 Primary Key","#FEF9C3","#854D0E"],
                  ["🔗 FK Ref",     "#E0F2FE","#0369A1"],
                  ["🔢 Numeric",    "#EFF6FF","#1D4ED8"],
                ].map(([label, bg, color]) => (
                  <span key={label} style={{
                    fontSize    : 10,
                    padding     : "2px 8px",
                    borderRadius: 20,
                    background  : bg,
                    color       : color,
                    fontWeight  : 600
                  }}>
                    {label}
                  </span>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

const s = {
  card      : {
    background  : "#ffffff",
    border      : "1px solid #E5E7EB",
    borderRadius: 14,
    padding     : "22px 26px",
    marginBottom: 16,
    boxShadow   : "0 1px 4px rgba(0,0,0,0.06)"
  },
  header    : {
    display       : "flex",
    justifyContent: "space-between",
    alignItems    : "flex-start",
    marginBottom  : 16
  },
  stepLabel : {
    fontSize     : 11,
    fontWeight   : 600,
    color        : "#059669",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    margin       : "0 0 4px"
  },
  title     : {
    fontSize  : 17,
    fontWeight: 600,
    margin    : "0 0 4px",
    color     : "#1a1a2e"
  },
  sub       : {
    fontSize: 13,
    color   : "#9CA3AF",
    margin  : 0
  },
  refreshBtn: {
    padding     : "7px 14px",
    background  : "transparent",
    border      : "1px solid #E5E7EB",
    borderRadius: 8,
    fontSize    : 12,
    cursor      : "pointer",
    color       : "#374151",
    fontWeight  : 500
  },
  th        : {
    background  : "#F9FAFB",
    padding     : "8px 12px",
    textAlign   : "left",
    fontWeight  : 600,
    fontSize    : 11,
    color       : "#374151",
    borderBottom: "2px solid #E5E7EB",
    whiteSpace  : "nowrap"
  },
  td        : {
    padding     : "7px 12px",
    color       : "#4B5563",
    borderBottom: "1px solid #F3F4F6",
    verticalAlign: "middle"
  }
}