from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    # allow_origins=["https://kookmao.github.io"],  # Allow frontend origin
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

# Load and clean dataset
df = pd.read_csv("dataset.csv", sep="\t")

# Filter for Swift Parrot (Lathamus discolor)
df = df[df['species'] == 'Lathamus discolor']

# Clean and transform data
df_cleaned = df[[
    "species", "decimalLatitude", "decimalLongitude", 
    "eventDate", "individualCount", "year", "stateProvince"
]].copy()

# Clean date strings - remove leading/trailing non-digit characters
df_cleaned['eventDate'] = df_cleaned['eventDate'].str.replace(r'^[^\d]+|[^\d]+$', '', regex=True)

# Convert to datetime safely
try:
    # First try converting with dayfirst=False (MM/DD/YYYY)
    dates = pd.to_datetime(df_cleaned['eventDate'], errors='coerce', utc=True, dayfirst=False)
    
    # Check how many dates failed to parse
    if dates.isna().sum() > 0:
        # Try alternative method for failed dates
        mask = dates.isna()
        alt_dates = pd.to_datetime(
            df_cleaned.loc[mask, 'eventDate'], 
            errors='coerce', 
            utc=True,
            format='ISO8601'
        )
        dates.update(alt_dates)
    
    # Extract year from datetime
    years_from_dates = dates.dt.year
    
except Exception as e:
    print(f"Date conversion error: {e}")
    # Fallback to manual year extraction
    years_from_dates = df_cleaned['eventDate'].str.extract(r'(\d{4})')[0].astype(float)

# Handle year conversion
years_from_existing = pd.to_numeric(df_cleaned['year'], errors='coerce')
df_cleaned['year'] = years_from_dates.fillna(years_from_existing)

# Handle missing values
df_cleaned['individualCount'] = pd.to_numeric(
    df_cleaned['individualCount'], errors='coerce'
).fillna(1).astype(int)

# Final cleanup - drop rows with missing coordinates or year
df_cleaned = df_cleaned.dropna(subset=[
    "decimalLatitude", "decimalLongitude", "year"
])

# Convert eventDate to clean string format
df_cleaned['eventDate'] = dates.dt.strftime('%Y-%m-%d').fillna(df_cleaned['eventDate'])

def clean_data(df):
    # Replace NaN values with None (which becomes null in JSON)
    df = df.replace({np.nan: None})
    
    # Convert problematic float values
    for col in df.select_dtypes(include=['float']).columns:
        df[col] = df[col].apply(
            lambda x: None if np.isinf(x) or np.isnan(x) else x
        )
    return df

df_cleaned = clean_data(df_cleaned)


@app.get("/api/occurrences")
def get_occurrences():
    # Convert to dict after cleaning
    records = df_cleaned.to_dict(orient="records")
    
    # Additional cleaning pass
    clean_records = []
    for record in records:
        clean_record = {}
        for key, value in record.items():
            # Handle special float values
            if isinstance(value, float):
                if np.isnan(value) or np.isinf(value):
                    clean_record[key] = None
                else:
                    clean_record[key] = value
            else:
                clean_record[key] = value
        clean_records.append(clean_record)
    
    return clean_records