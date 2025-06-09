from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://kookmao.github.io"],  # Allow frontend origin
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

# Load and clean CSV once
df = pd.read_csv("dataset.csv", sep="\t")  # Adjust path/sep as needed
df_cleaned = df[["species", "decimalLatitude", "decimalLongitude", "eventDate", "individualCount"]].dropna().head(1000)

@app.get("/api/occurrences")
def get_occurrences():
    return df_cleaned.to_dict(orient="records")
