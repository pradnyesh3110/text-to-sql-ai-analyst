// frontend/src/ChartPanel.jsx
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, LineChart, Line,
  PieChart, Pie, Cell, Legend
} from "recharts"

const COLORS = [
  "#7F77DD", "#1D9E75", "#BA7517",
  "#E24B4A", "#378ADD", "#8E24AA", "#F59E0B"
]

function detectType(columns, rows) {
  if (!columns || columns.length < 2 || !rows?.length) return "table"

  const secondVal = rows[0]?.[columns[1]]
  const isNumber  = !isNaN(parseFloat(secondVal))
  if (!isNumber) return "table"

  const firstVal = String(rows[0]?.[columns[0]] ?? "")
  const hasDate  = /\d{4}[-\/]\d{2}/.test(firstVal)

  if (hasDate)        return "line"
  if (rows.length <= 4) return "pie"
  return "bar"
}

export default function ChartPanel({ columns, rows }) {
  if (!rows?.length || !columns?.length) return null

  const type    = detectType(columns, rows)
  const nameKey = columns[0]
  const valKey  = columns[1]

  if (type === "table") return null

  const data = rows.map(r => ({
    name  : String(r[nameKey] ?? ""),
    value : parseFloat(r[valKey]) || 0
  }))

  return (
    <div style={{ marginTop: 20 }}>
      <p style={{
        fontSize: 13, fontWeight: 600,
        color: "#374151", margin: "0 0 10px",
        display: "flex", alignItems: "center", gap: 8
      }}>
        Auto Chart
        <span style={{
          fontSize: 11, padding: "2px 8px",
          borderRadius: 20, background: "#EEEDFE",
          color: "#3C3489", fontWeight: 500
        }}>
          {type}
        </span>
        <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 400 }}>
          {rows.length} rows
        </span>
      </p>

      {/* Bar Chart */}
      {type === "bar" && (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}
            margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }}
              angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="value" fill="#7F77DD"
              radius={[4, 4, 0, 0]} 
              label={{position: "top",fontSize: 11,fill: "#374151",fontWeight: 600,formatter: (val) => val.toLocaleString()}}/>
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Line Chart */}
      {type === "line" && (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data}
            margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }}
              angle={-35} textAnchor="end" />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ borderRadius: 8, fontSize: 12 }}
            />
            <Line type="monotone" dataKey="value"
              stroke="#7F77DD" strokeWidth={2}
              dot={{ fill: "#7F77DD", r: 4 }}
              label={{position: "top",fontSize:11,fill: "#333",fontWeight:30,formatter: (val) => val.toLocaleString()}} />
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Pie Chart */}
      {type === "pie" && (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%" cy="50%"
              outerRadius={100}
              label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
            >
              {data.map((_, i) => (
                <Cell key={i}
                  fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: 8, fontSize: 12 }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}