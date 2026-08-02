// frontend/src/MultiUpload.jsx
import { useState } from "react"

export default function MultiUpload({ onSuccess }) {
  const [files,    setFiles]    = useState([])
  const [merge,    setMerge]    = useState(true)
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState(null)
  const [error,    setError]    = useState(null)
  const [dragOver, setDragOver] = useState(false)

  const ALLOWED = [
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/json",
    "text/tab-separated-values",
    "text/plain"
  ]

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files || [])
    addFiles(selected)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = Array.from(e.dataTransfer.files || [])
    addFiles(dropped)
  }

  const addFiles = (newFiles) => {
    const valid = newFiles.filter(f => {
      const ext = f.name.split(".").pop().toLowerCase()
      return ["csv","xlsx","xls","json","tsv","txt"].includes(ext)
    })
    setFiles(prev => {
      // avoid duplicates
      const names  = prev.map(f => f.name)
      const unique = valid.filter(f => !names.includes(f.name))
      return [...prev, ...unique]
    })
  }

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const clearAll = () => {
    setFiles([])
    setResult(null)
    setError(null)
  }

  const upload = async () => {
    if (files.length === 0) return
    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const formData = new FormData()
      files.forEach(f => formData.append("files", f))

      const res = await fetch(
        `http://127.0.0.1:8000/upload-multiple?merge=${merge}`,
        { method:"POST", body: formData }
      )
      const data = await res.json()

      if (data.success) {
        setResult(data)
        // notify parent
        if (onSuccess) {
          onSuccess({
            columns : data.columns || [],
            message : data.message,
            issues  : data.issues  || []
          })
        }
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError("Upload error: " + err.message)
    }
    setLoading(false)
  }

  const formatSize = (bytes) => {
    if (bytes < 1024)       return bytes + " B"
    if (bytes < 1024*1024)  return (bytes/1024).toFixed(1) + " KB"
    return (bytes/1024/1024).toFixed(1) + " MB"
  }

  const totalSize = files.reduce((s, f) => s + f.size, 0)

  return (
    <div style={s.card}>
      <p style={s.stepLabel}>Multi-File Upload</p>
      <h2 style={s.title}>📁 Upload Multiple Files</h2>
      <p style={s.sub}>
        Upload a folder or multiple CSV/Excel files at once
      </p>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border      : `2px dashed ${dragOver ? "#2563EB" : "#D1D5DB"}`,
          borderRadius: 12,
          padding     : "30px 20px",
          textAlign   : "center",
          background  : dragOver ? "#EFF6FF" : "#F9FAFB",
          transition  : "all 0.2s",
          marginBottom: 14,
          cursor      : "pointer"
        }}
        onClick={() => document.getElementById("multi-file-input").click()}
      >
        <p style={{ fontSize:32, margin:"0 0 8px" }}>📂</p>
        <p style={{
          fontSize  : 14,
          fontWeight: 600,
          color     : "#374151",
          margin    : "0 0 4px"
        }}>
          Drop files here or click to browse
        </p>
        <p style={{ fontSize:12, color:"#9CA3AF", margin:0 }}>
          CSV, Excel, JSON, TSV — multiple files supported
        </p>

        <input
          id="multi-file-input"
          type="file"
          multiple
          accept=".csv,.xlsx,.xls,.json,.tsv,.txt"
          onChange={handleFileSelect}
          style={{ display:"none" }}
        />
      </div>

      {/* Also support folder */}
      <div style={{
        display       : "flex",
        justifyContent: "center",
        marginBottom  : 14
      }}>
        <label style={{
          fontSize  : 12,
          color     : "#6B7280",
          cursor    : "pointer",
          display   : "flex",
          alignItems: "center",
          gap       : 6
        }}>
          <input
            type="file"
            webkitdirectory=""
            multiple
            onChange={handleFileSelect}
            style={{ display:"none" }}
          />
          <span style={{
            padding     : "6px 14px",
            border      : "1px solid #D1D5DB",
            borderRadius: 8,
            background  : "#fff",
            fontSize    : 12,
            cursor      : "pointer"
          }}>
            📁 Select Entire Folder
          </span>
        </label>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div style={{ marginBottom:14 }}>
          <div style={{
            display       : "flex",
            justifyContent: "space-between",
            alignItems    : "center",
            marginBottom  : 8
          }}>
            <p style={{
              fontSize  : 12,
              fontWeight: 600,
              color     : "#374151",
              margin    : 0
            }}>
              {files.length} file{files.length > 1 ? "s" : ""} selected
              <span style={{
                marginLeft: 8,
                color     : "#9CA3AF",
                fontWeight: 400
              }}>
                ({formatSize(totalSize)} total)
              </span>
            </p>
            <button onClick={clearAll} style={{
              fontSize    : 11,
              color       : "#DC2626",
              background  : "transparent",
              border      : "none",
              cursor      : "pointer",
              padding     : "2px 8px"
            }}>
              Clear all
            </button>
          </div>

          <div style={{
            maxHeight   : 180,
            overflowY   : "auto",
            border      : "1px solid #E5E7EB",
            borderRadius: 8
          }}>
            {files.map((f, i) => (
              <div key={i} style={{
                display       : "flex",
                alignItems    : "center",
                justifyContent: "space-between",
                padding       : "8px 12px",
                borderBottom  : i < files.length-1
                  ? "1px solid #F3F4F6" : "none",
                background    : i%2===0 ? "#fff" : "#F9FAFB"
              }}>
                <div style={{
                  display   : "flex",
                  alignItems: "center",
                  gap       : 8,
                  flex      : 1,
                  minWidth  : 0
                }}>
                  <span style={{ fontSize:16, flexShrink:0 }}>
                    {f.name.endsWith(".csv")  ? "📄" :
                     f.name.endsWith(".xlsx") ? "📊" :
                     f.name.endsWith(".json") ? "📋" : "📄"}
                  </span>
                  <span style={{
                    fontSize    : 12,
                    color       : "#374151",
                    fontWeight  : 500,
                    overflow    : "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace  : "nowrap"
                  }}>
                    {f.name}
                  </span>
                  <span style={{
                    fontSize  : 11,
                    color     : "#9CA3AF",
                    flexShrink: 0
                  }}>
                    {formatSize(f.size)}
                  </span>
                </div>
                <button
                  onClick={() => removeFile(i)}
                  style={{
                    background  : "transparent",
                    border      : "none",
                    color       : "#9CA3AF",
                    cursor      : "pointer",
                    fontSize    : 16,
                    padding     : "0 4px",
                    flexShrink  : 0
                  }}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Merge option */}
      {files.length > 1 && (
        <div style={{
          display     : "flex",
          gap         : 8,
          marginBottom: 14,
          padding     : "12px 14px",
          background  : "#F8FAFC",
          borderRadius: 8,
          border      : "1px solid #E2E8F0"
        }}>
          <p style={{
            fontSize  : 13,
            fontWeight: 600,
            color     : "#374151",
            margin    : "0 0 8px 0",
            width     : "100%"
          }}>
            How to load files:
          </p>
          <div style={{
            display   : "flex",
            gap       : 10,
            flexWrap  : "wrap",
            width     : "100%"
          }}>
            <label style={{
              display   : "flex",
              alignItems: "center",
              gap       : 6,
              fontSize  : 13,
              cursor    : "pointer",
              flex      : 1
            }}>
              <input
                type="radio"
                checked={merge}
                onChange={() => setMerge(true)}
              />
              <div>
                <strong>Merge into one table</strong>
                <p style={{
                  fontSize: 11,
                  color   : "#6B7280",
                  margin  : "2px 0 0"
                }}>
                  All files combined → user_data table
                  <br/>Best for: same column structure
                </p>
              </div>
            </label>

            <label style={{
              display   : "flex",
              alignItems: "center",
              gap       : 6,
              fontSize  : 13,
              cursor    : "pointer",
              flex      : 1
            }}>
              <input
                type="radio"
                checked={!merge}
                onChange={() => setMerge(false)}
              />
              <div>
                <strong>Separate tables</strong>
                <p style={{
                  fontSize: 11,
                  color   : "#6B7280",
                  margin  : "2px 0 0"
                }}>
                  Each file → own table (file1, file2...)
                  <br/>Best for: different structures
                </p>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Upload button */}
      {files.length > 0 && (
        <button
          onClick={upload}
          disabled={loading}
          style={{
            width       : "100%",
            padding     : "12px",
            background  : loading ? "#94A3B8" : "#2563EB",
            color       : "#fff",
            border      : "none",
            borderRadius: 8,
            fontSize    : 14,
            fontWeight  : 600,
            cursor      : loading ? "not-allowed" : "pointer",
            marginBottom: 12
          }}>
          {loading
            ? `⏳ Uploading ${files.length} files...`
            : `⬆️ Upload ${files.length} File${files.length > 1 ? "s" : ""}`
          }
        </button>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding     : "10px 14px",
          background  : "#FEF2F2",
          border      : "1px solid #FECACA",
          borderRadius: 8,
          fontSize    : 13,
          color       : "#DC2626"
        }}>
          ❌ {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{
          padding     : "14px 16px",
          background  : "#F0FDF4",
          border      : "1px solid #86EFAC",
          borderRadius: 10
        }}>
          <p style={{
            fontSize  : 13,
            fontWeight: 700,
            color     : "#166534",
            margin    : "0 0 10px"
          }}>
            ✅ {result.message}
          </p>

          {/* Per-file results */}
          {result.results?.map((r, i) => (
            <div key={i} style={{
              display       : "flex",
              justifyContent: "space-between",
              alignItems    : "center",
              padding       : "5px 0",
              borderBottom  : "0.5px solid #D1FAE5",
              fontSize      : 12
            }}>
              <span style={{ color:"#166534" }}>
                {r.status === "success" ? "✅" : "❌"} {r.file}
              </span>
              <span style={{ color:"#6B7280" }}>
                {r.status === "success"
                  ? `${r.rows} rows · ${r.columns?.length} cols`
                  : r.error}
              </span>
            </div>
          ))}

          {/* Table info */}
          {result.mode === "merged" && (
            <p style={{
              fontSize  : 12,
              color     : "#059669",
              margin    : "10px 0 0",
              fontWeight: 500
            }}>
              📊 All data merged into table: <code>user_data</code>
              · {result.rows} total rows
              · {result.columns?.length} columns
            </p>
          )}

          {result.mode === "separate" && result.tables && (
            <div style={{ marginTop:10 }}>
              {result.tables.map((t, i) => (
                <p key={i} style={{
                  fontSize: 12,
                  color   : "#059669",
                  margin  : "3px 0"
                }}>
                  📋 <code>{t.table_name}</code>
                  → {t.rows} rows · {t.columns?.length} cols
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const s = {
  card     : {
    background  : "#ffffff",
    border      : "1px solid #E5E7EB",
    borderRadius: 14,
    padding     : "22px 26px",
    marginBottom: 16,
    boxShadow   : "0 1px 4px rgba(0,0,0,0.06)"
  },
  stepLabel: {
    fontSize     : 11,
    fontWeight   : 600,
    color        : "#2563EB",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    margin       : "0 0 4px"
  },
  title    : {
    fontSize  : 17,
    fontWeight: 600,
    margin    : "0 0 4px",
    color     : "#1a1a2e"
  },
  sub      : {
    fontSize: 13,
    color   : "#9CA3AF",
    margin  : "0 0 14px"
  }
}