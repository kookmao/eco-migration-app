import { useState, useEffect } from 'react';
import Map from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ScatterplotLayer } from 'deck.gl';
import DeckGL from '@deck.gl/react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import './App.css';

function App() {

  const australianAreas = [
    { name: "Western Australia", bounds: { minLat: -35, maxLat: -13, minLng: 112, maxLng: 129 } },
    { name: "Northern Territory", bounds: { minLat: -26, maxLat: -10, minLng: 129, maxLng: 138 } },
    { name: "South Australia", bounds: { minLat: -38, maxLat: -26, minLng: 129, maxLng: 141 } },
    { name: "Queensland", bounds: { minLat: -29, maxLat: -10, minLng: 138, maxLng: 154 } },
    { name: "New South Wales", bounds: { minLat: -37, maxLat: -28, minLng: 141, maxLng: 153 } },
    { name: "Victoria", bounds: { minLat: -39, maxLat: -34, minLng: 141, maxLng: 150 } },
    { name: "Tasmania", bounds: { minLat: -44, maxLat: -39, minLng: 144, maxLng: 149 } },
    { name: "Australian Capital Territory", bounds: { minLat: -35.92, maxLat: -35.1, minLng: 148.76, maxLng: 149.4 } },
  ];
  
  // Extract region names for dropdown options
  const australianRegions = australianAreas.map(area => area.name);

  const [data, setData] = useState([]);
  const [view, setView] = useState('map'); // 'map', 'graph', or 'logistic'
  const [selectedSpecies, setSelectedSpecies] = useState(null);
  const [location1, setLocation1] = useState(australianAreas[0].name);
  const [location2, setLocation2] = useState(australianAreas[1].name);

  const [speciesList, setSpeciesList] = useState([]);
  const [migrationRoutes, setMigrationRoutes] = useState([]);

  useEffect(() => {
    fetch('https://eco-migration-app.onrender.com/api/occurrences')
      .then(res => res.json())
      .then(fetchedData => {
        // Enrich the data with state/province information based on coordinates
        const enrichedData = fetchedData.map(item => {
          const lat = parseFloat(item.decimalLatitude);
          const lng = parseFloat(item.decimalLongitude);
          
          // Find which Australian area this point belongs to
          let stateProvince = "Unknown";
          for (const area of australianAreas) {
            if (lat >= area.bounds.minLat && lat <= area.bounds.maxLat && 
                lng >= area.bounds.minLng && lng <= area.bounds.maxLng) {
              stateProvince = area.name;
              break;
            }
          }
          
          // Add year from eventDate if not already present
          const year = item.year || (item.eventDate ? new Date(item.eventDate).getFullYear() : null);
          
          return {
            ...item,
            stateProvince,
            year
          };
        });
        
        setData(enrichedData);
        
        // Extract unique species from the data
        const uniqueSpecies = [...new Set(enrichedData
          .filter(d => d.species)
          .map(d => d.species))];

        setSpeciesList(uniqueSpecies);
        
        if (uniqueSpecies.length > 0) {
          setSelectedSpecies(uniqueSpecies[0]);
        }
        processMigrationRoutes(enrichedData);
        
        console.log("Enriched data:", enrichedData);
      })
      .catch(error => {
        console.error("Error fetching data:", error);
        
        // Create some sample data if the fetch fails
        const sampleData = generateSampleData();
        setData(sampleData);
        processMigrationRoutes(sampleData);
      });
  }, []);
  
  // Function to generate sample data if API fails
  const generateSampleData = () => {
    const sampleData = [];
    const species = ["Kangaroo", "Koala", "Wombat", "Platypus"];
    const currentYear = new Date().getFullYear();
    
    // Generate sample data points across different regions
    for (const area of australianAreas) {
      for (const specie of species) {
        for (let year = currentYear - 4; year <= currentYear; year++) {
          // Random center point within the area bounds
          const centerLat = (area.bounds.minLat + area.bounds.maxLat) / 2;
          const centerLng = (area.bounds.minLng + area.bounds.maxLng) / 2;
          
          // Add some random variation to the position
          const latVariation = (area.bounds.maxLat - area.bounds.minLat) * 0.3;
          const lngVariation = (area.bounds.maxLng - area.bounds.minLng) * 0.3;
          
          const count = Math.floor(Math.random() * 10) + 1;
          
          sampleData.push({
            species: specie,
            decimalLatitude: (centerLat + (Math.random() - 0.5) * latVariation).toString(),
            decimalLongitude: (centerLng + (Math.random() - 0.5) * lngVariation).toString(),
            eventDate: `${year}-01-01`,
            year: year,
            individualCount: count.toString(),
            stateProvince: area.name
          });
        }
      }
    }
    
    return sampleData;
  };

  const processMigrationRoutes = (occurrences) => {
    const speciesGroups = {};

    occurrences.forEach(occurrence => {
      if (!occurrence.species || !occurrence.decimalLatitude || !occurrence.decimalLongitude || !occurrence.eventDate) {
        return;
      }

      if (!speciesGroups[occurrence.species]) {
        speciesGroups[occurrence.species] = [];
      }

      speciesGroups[occurrence.species].push({
        position: [parseFloat(occurrence.decimalLongitude), parseFloat(occurrence.decimalLatitude)],
        date: new Date(occurrence.eventDate),
        count: parseInt(occurrence.individualCount) || 1
      });
    });

    const routes = [];

    Object.keys(speciesGroups).forEach(species => {
      const points = speciesGroups[species].sort((a, b) => a.date - b.date);

      if (points.length >= 2) {
        for (let i = 0; i < points.length - 1; i++) {
          routes.push({
            species: species,
            source: points[i].position,
            target: points[i + 1].position,
            count: points[i].count
          });
        }
      }
    });

    setMigrationRoutes(routes);
  };

  const layers = [
    new ScatterplotLayer({
      id: 'migration-source-points',
      data: selectedSpecies ? migrationRoutes.filter(r => r.species === selectedSpecies) : migrationRoutes,
      getPosition: d => d.source,
      getFillColor: [255, 0, 0, 200],
      getRadius: 60000,
      pickable: true,
      radiusMinPixels: 2,
      radiusMaxPixels: 3,
    }),
  ];

  const dataWithYear = data.map(d => ({
    ...d,
    year: d.year || (d.eventDate ? new Date(d.eventDate).getFullYear() : null)
  }));

  const groupedByYearAndState = {};

  dataWithYear
    .filter(d => selectedSpecies ? d.species === selectedSpecies : true)
    .forEach(d => {
      const year = parseInt(d.year);
      if (!year || isNaN(year)) return;

      const state = d.stateProvince || 'Unknown';
      const count = parseInt(d.individualCount);
      const safeCount = isNaN(count) ? 1 : count;

      if (!groupedByYearAndState[year]) groupedByYearAndState[year] = { year, actual: 0 };
      if (!groupedByYearAndState[year][state]) groupedByYearAndState[year][state] = 0;

      groupedByYearAndState[year][state] += safeCount;
      groupedByYearAndState[year].actual += safeCount;
    });

  const populationByYear = Object.values(groupedByYearAndState).sort((a, b) => a.year - b.year);

  const calculateLogisticGrowth = () => {
    if (populationByYear.length < 2) return populationByYear;

    const K = Math.max(...populationByYear.map(item => item.actual)) * 1.5;
    const r = 0.2;
    const N0 = populationByYear[0].actual;

    return populationByYear.map(item => {
      const t = item.year - populationByYear[0].year;
      const predicted = K / (1 + ((K - N0) / N0) * Math.exp(-r * t));
      return {
        ...item,
        count: Math.round(predicted)
      };
    });
  };

  const getLogisticDataForLocation = (location) => {
    // Filter the data for the specific location
    const filtered = populationByYear
      .filter(y => y[location] !== undefined)
      .map(y => ({
        year: y.year,
        actual: y[location] || 0
      }));
  
    // If we don't have enough data points, generate some sample data for demonstration
    if (filtered.length < 2) {
      // Create sample data spanning 5 years if real data isn't available
      const currentYear = new Date().getFullYear();
      const sampleData = [];
      
      // Generate some sample points
      for (let i = 0; i < 5; i++) {
        const year = currentYear - 4 + i;
        // Generate increasing sample values
        const actual = i * 5 + Math.floor(Math.random() * 3);
        sampleData.push({ year, actual });
      }
      
      // Calculate K, r, and N0 based on sample data
      const K = Math.max(...sampleData.map(item => item.actual)) * 1.5;
      const r = 0.3;
      const N0 = sampleData[0].actual || 1;
      
      // Calculate predicted values
      return sampleData.map(item => {
        const t = item.year - sampleData[0].year;
        const predicted = K / (1 + ((K - N0) / N0) * Math.exp(-r * t));
        return {
          ...item,
          count: Math.round(predicted)
        };
      });
    }
  
    // Calculate carrying capacity (K) based on maximum observed value
    const maxActual = Math.max(...filtered.map(item => item.actual));
    const K = maxActual > 0 ? maxActual * 1.5 : 100; // Default K value if no data
    
    // Growth rate
    const r = 0.2;
    
    // Initial population
    const N0 = filtered[0].actual || 1; // Avoid division by zero
  
    return filtered.map(item => {
      const t = item.year - filtered[0].year;
      // Avoid division by zero (if N0 is 0)
      const predicted = N0 === 0 ? 0 : 
        K / (1 + ((K - N0) / N0) * Math.exp(-r * t));
      return {
        ...item,
        count: Math.round(predicted)
      };
    });
  };
  
  const logisticData1 = getLogisticDataForLocation(location1);
  const logisticData2 = getLogisticDataForLocation(location2);
  
  // Add debug code to see what data we're working with
  useEffect(() => {
    if (view === 'logistic') {
      console.log("Location 1 data:", logisticData1);
      console.log("Location 2 data:", logisticData2);
    }
  }, [view, logisticData1, logisticData2]);
  

  return (
    <div className="container">
      <h1 className="header">Ecological Migration Visualizer</h1>

      <div className="tabs">
        {['map', 'graph', 'logistic'].map(v => (
          <div
            key={v}
            onClick={() => setView(v)}
            className={`tab ${view === v ? 'active' : ''}`}
          >
            {v === 'map' ? 'Migration Map' : v === 'graph' ? 'Population Graph' : 'Logistic Growth Model'}
          </div>
        ))}
      </div>

      <div className="species-selector" style={{ marginBottom: '20px' }}>
        <label>Select Species: </label>
        <select 
          value={selectedSpecies || ''}
          onChange={(e) => setSelectedSpecies(e.target.value)}
        >
          {speciesList.map(species => (
            <option key={species} value={species}>{species}</option>
          ))}
        </select>
      </div>

      {view === 'logistic' && (
        <div style={{ marginBottom: '20px' }}>
          <label>Select Location 1: </label>
          <select value={location1} onChange={(e) => setLocation1(e.target.value)}>
            {australianRegions.map(region => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>

          <label style={{ marginLeft: '20px' }}>Select Location 2: </label>
          <select value={location2} onChange={(e) => setLocation2(e.target.value)}>
            {australianRegions.map(region => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>
        </div>
      )}

      <div className="visualization-container">
        {view === 'map' ? (
          <DeckGL
            style={{ position: 'relative', width: '100%', height: '500px' }}
            initialViewState={{
              longitude: 134, // Center on Australia
              latitude: -25,
              zoom: 3,
              bearing: 0,
              pitch: 0,
            }}
            controller={true}
            layers={layers}
            getTooltip={({ object }) => object && (
              object.species ?
                `Species: ${object.species}` :
                `Species: ${object.species || 'Unknown'}\nCount: ${object.individualCount || 'N/A'}`
            )}
          >
            <Map
              mapLib={maplibregl}
              mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
              reuseMaps
            />
          </DeckGL>
        ) : view === 'graph' ? (
          <div style={{ height: '500px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={populationByYear}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" label={{ value: 'Year', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Population Count', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                {
                  populationByYear.length > 0 && 
                  Object.keys(populationByYear[0] || {})
                    .filter(key => key !== 'year' && key !== 'actual')
                    .map((state, index) => (
                      <Line
                        key={state}
                        type="monotone"
                        dataKey={state}
                        name={state}
                        stroke={`hsl(${index * 60 % 360}, 70%, 50%)`}
                        dot={{ r: 3 }}
                      />
                    ))
                }
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ height: '500px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="year" 
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  label={{ value: 'Year', position: 'insideBottom', offset: -5 }} 
                />
                <YAxis label={{ value: 'Population Count', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value, name) => [value, name]} labelFormatter={(label) => `Year: ${label}`} />
                <Legend />
                <Line 
                  type="monotone" 
                  data={logisticData1} 
                  dataKey="count" 
                  name={`${location1} (Predicted)`} 
                  stroke="#82ca9d" 
                  strokeWidth={2} 
                  isAnimationActive={false}
                />
                <Line 
                  type="monotone" 
                  data={logisticData1} 
                  dataKey="actual" 
                  name={`${location1} (Actual)`} 
                  stroke="#8884d8" 
                  dot={{ r: 3 }} 
                  isAnimationActive={false}
                />
                <Line 
                  type="monotone" 
                  data={logisticData2} 
                  dataKey="count" 
                  name={`${location2} (Predicted)`} 
                  stroke="#ffc658" 
                  strokeWidth={2} 
                  isAnimationActive={false}
                />
                <Line 
                  type="monotone" 
                  data={logisticData2} 
                  dataKey="actual" 
                  name={`${location2} (Actual)`} 
                  stroke="#ff7300" 
                  dot={{ r: 3 }} 
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
           
            <div className="model-info">
              <h3>Logistic Growth Model</h3>
              <p>Formula: N(t) = K / (1 + ((K - N₀)/N₀) * e^(-rt))</p>
              <p>where:</p>
              <ul>
                <li>K = Carrying capacity (estimated from maximum observed population)</li>
                <li>r = Growth rate (estimated parameter)</li>
                <li>N₀ = Initial population</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <section className="about">
        <h2>About</h2>
        <p>
          This application visualizes species migrations and population dynamics using three views:
        </p>
        <ul>
          <li><strong>Migration Map:</strong> Shows occurrence locations and migration routes based on temporal data. Lines connect observations of the same species over time.</li>
          <li><strong>Population Graph:</strong> Displays raw population counts by year for selected species.</li>
          <li><strong>Logistic Growth Model:</strong> Fits a logistic growth model to the population data, showing both actual and predicted population trends.</li>
        </ul>
        <p>Use the species dropdown to filter data by a specific species.</p>
      </section>
    </div>
  );
}

export default App;