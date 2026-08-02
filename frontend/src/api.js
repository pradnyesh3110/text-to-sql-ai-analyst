const BASE = import.meta.env.VITE_API_URL || "https://text-to-sql-ai-analyst-2.onrender.com

export async function uploadFile(file) {
    const formData = new FormData()
    formData.append("file", file)
    const response = await fetch(BASE + "/upload", {
        method: "POST",
        body: formData
    })
    return response.json()
}

export async function askQuestion(question) {
    const response = await fetch(BASE + "/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question })
    })
    return response.json()
}

export async function getSchema() {
    const response = await fetch(BASE + "/schema")
    return response.json()
}
