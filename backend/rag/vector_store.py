import chromadb
from chromadb.utils import embedding_functions

# ChromaDB saves data in a local folder called chroma_db
client = chromadb.PersistentClient(path="./chroma_db")

ef = embedding_functions.DefaultEmbeddingFunction()

collection = client.get_or_create_collection(
    name="sql_examples",
    embedding_function=ef
)

# 20 Chinook-specific Q→SQL examples
EXAMPLES = [
    ("How many artists are there?",
     'SELECT COUNT(*) as total FROM "Artist"'),

    ("List all genres",
     'SELECT "Name" FROM "Genre" ORDER BY "Name"'),

    ("Which genre has the most tracks?",
     'SELECT g."Name", COUNT(t."TrackId") as track_count FROM "Genre" g JOIN "Track" t ON g."GenreId" = t."GenreId" GROUP BY g."Name" ORDER BY track_count DESC LIMIT 1'),

    ("Top 5 genres by number of tracks",
     'SELECT g."Name", COUNT(t."TrackId") as total FROM "Genre" g JOIN "Track" t ON g."GenreId" = t."GenreId" GROUP BY g."Name" ORDER BY total DESC LIMIT 5'),

    ("Which customer spent the most?",
     'SELECT c."FirstName", c."LastName", SUM(i."Total") as total_spent FROM "Customer" c JOIN "Invoice" i ON c."CustomerId" = i."CustomerId" GROUP BY c."CustomerId", c."FirstName", c."LastName" ORDER BY total_spent DESC LIMIT 1'),

    ("Top 5 customers by total spending",
     'SELECT c."FirstName", c."LastName", SUM(i."Total") as total FROM "Customer" c JOIN "Invoice" i ON c."CustomerId" = i."CustomerId" GROUP BY c."CustomerId", c."FirstName", c."LastName" ORDER BY total DESC LIMIT 5'),

    ("What is the total revenue from all invoices?",
     'SELECT SUM("Total") as total_revenue FROM "Invoice"'),

    ("Total revenue by country",
     'SELECT "BillingCountry", SUM("Total") as revenue FROM "Invoice" GROUP BY "BillingCountry" ORDER BY revenue DESC'),

    ("Which country has the most customers?",
     'SELECT "Country", COUNT(*) as total FROM "Customer" GROUP BY "Country" ORDER BY total DESC LIMIT 1'),

    ("Which artist has the most albums?",
     'SELECT ar."Name", COUNT(al."AlbumId") as album_count FROM "Artist" ar JOIN "Album" al ON ar."ArtistId" = al."ArtistId" GROUP BY ar."ArtistId", ar."Name" ORDER BY album_count DESC LIMIT 1'),

    ("List all albums by AC/DC",
     "SELECT al.\"Title\" FROM \"Album\" al JOIN \"Artist\" ar ON al.\"ArtistId\" = ar.\"ArtistId\" WHERE ar.\"Name\" = 'AC/DC'"),

    ("How many tracks are in each album?",
     'SELECT al."Title", COUNT(t."TrackId") as track_count FROM "Album" al JOIN "Track" t ON al."AlbumId" = t."AlbumId" GROUP BY al."AlbumId", al."Title" ORDER BY track_count DESC'),

    ("Show all tracks longer than 5 minutes",
     'SELECT "Name", "Milliseconds"/60000.0 as minutes FROM "Track" WHERE "Milliseconds" > 300000 ORDER BY "Milliseconds" DESC'),

    ("What is the average track length in minutes?",
     'SELECT ROUND(AVG("Milliseconds")/60000.0, 2) as avg_minutes FROM "Track"'),

    ("Which playlist has the most tracks?",
     'SELECT p."Name", COUNT(pt."TrackId") as track_count FROM "Playlist" p JOIN "PlaylistTrack" pt ON p."PlaylistId" = pt."PlaylistId" GROUP BY p."PlaylistId", p."Name" ORDER BY track_count DESC LIMIT 1'),

    ("List all employees and their titles",
     'SELECT "FirstName", "LastName", "Title" FROM "Employee" ORDER BY "LastName"'),

    ("Which employee has the most customers?",
     'SELECT e."FirstName", e."LastName", COUNT(c."CustomerId") as customer_count FROM "Employee" e JOIN "Customer" c ON e."EmployeeId" = c."SupportRepId" GROUP BY e."EmployeeId", e."FirstName", e."LastName" ORDER BY customer_count DESC LIMIT 1'),

    ("What is the average invoice total?",
     'SELECT ROUND(AVG("Total"), 2) as avg_invoice FROM "Invoice"'),

    ("How many invoices were made in 2009?",
     'SELECT COUNT(*) as total FROM "Invoice" WHERE EXTRACT(YEAR FROM "InvoiceDate") = 2009'),

    ("Total revenue per year",
     'SELECT EXTRACT(YEAR FROM "InvoiceDate") as year, SUM("Total") as revenue FROM "Invoice" GROUP BY year ORDER BY year'),
]

def seed_examples():
    existing = collection.count()
    if existing >= len(EXAMPLES):
        print(f"ChromaDB already has {existing} examples — skipping seed")
        return

    for i, (question, sql) in enumerate(EXAMPLES):
        collection.upsert(
            documents=[question],
            metadatas=[{"sql": sql}],
            ids=[f"example_{i}"]
        )
    print(f"Seeded {len(EXAMPLES)} examples into ChromaDB")

# Run seed when this file is imported
seed_examples()