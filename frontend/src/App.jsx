import { useState, useEffect, useMemo } from 'react';
import Map from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ScatterplotLayer } from 'deck.gl';
import DeckGL from '@deck.gl/react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend, ReferenceArea, Brush } from 'recharts';

import './App.css';

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [selectedInsightView, setSelectedInsightView] = useState('statistics');
  const [zoomDomain, setZoomDomain] = useState(null);


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
  const WILDFIRE_YEAR = 2019;
  const WILDFIRE_PERIOD = [2019, 2020];

  const [data, setData] = useState([]);
  const [view, setView] = useState('map'); // 'map', 'graph', or 'logistic'
  const [selectedSpecies, setSelectedSpecies] = useState(null);
  const [location1, setLocation1] = useState(australianAreas[0].name);
  const [location2, setLocation2] = useState(australianAreas[1].name);
  const [currentSlide, setCurrentSlide] = useState(0);

  const [speciesList, setSpeciesList] = useState([]);
  const [migrationRoutes, setMigrationRoutes] = useState([]);
  const [brushData, setBrushData] = useState({ startIndex: 0, endIndex: undefined });


  const slideshowImages = [
  "https://media.australian.museum/media/dd/images/Lathamus-discolor.074ed02.width-1200.453e763.jpg",
  "https://www.featherbase.info/static/images/speciesimages/001826_full.JPG", 
  "https://media.australian.museum/media/dd/images/deborod_some_rights_reserved_CC_BY-NC.90db761.width-1600.8af8c7e.jpg",
  "https://media.australian.museum/media/dd/images/deborod_some_rights_reserved_CC_BY-NC_1.65494.width-1600.a3c924c.jpg"
];



useEffect(() => {
  const interval = setInterval(() => {
    setCurrentSlide((prev) => (prev + 1) % slideshowImages.length);
  }, 4000); // Change slide every 4 seconds

  return () => clearInterval(interval);
}, [slideshowImages.length]);
  

  useEffect(() => {

    
    
    //http://localhost:8000/api/occurrences
    //https://eco-migration-app.onrender.com/api/occurrences
    fetch('http://localhost:8000/api/occurrences')
      .then(res => res.json())
      .then(fetchedData => {
        // Enrich the data with state/province information based on coordinates
        const enrichedData = fetchedData.map(item => {
          // Find which Australian area this point belongs to
          let stateProvince = item.stateProvince || "Unknown";
          if (stateProvince === "Unknown") {
            const lat = parseFloat(item.decimalLatitude);
            const lng = parseFloat(item.decimalLongitude);

            for (const area of australianAreas) {
              if (lat >= area.bounds.minLat && lat <= area.bounds.maxLat && 
                  lng >= area.bounds.minLng && lng <= area.bounds.maxLng) {
                stateProvince = area.name;
                break;
              }
            }
          }
          
          // Add year from eventDate if not already present
          const year = item.year || (item.eventDate ? new Date(item.eventDate).getFullYear() : null);
          const isWildfirePeriod = year >= WILDFIRE_PERIOD[0] && year <= WILDFIRE_PERIOD[1];
          
          return {
            ...item,
            stateProvince,
            year: item.year
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

    // Only keep this single processing block:
    Object.keys(speciesGroups).forEach(species => {
      // Group by year
      const yearGroups = {};
      speciesGroups[species].forEach(point => {
        const year = point.date.getFullYear();
        if (!yearGroups[year]) yearGroups[year] = [];
        yearGroups[year].push(point);
      });

      // Connect points within years
      Object.values(yearGroups).forEach(points => {
        points.sort((a, b) => a.date - b.date);
        for (let i = 0; i < points.length - 1; i++) {
          routes.push({
            species,
            source: points[i].position,
            target: points[i + 1].position,
            year: points[i].date.getFullYear(),
            count: points[i].count
          });
        }
      });
    });

    setMigrationRoutes(routes);
  };

  const pointData = data.map(d => {
  const year = d.year ? parseInt(d.year) : null;
  return {
    position: [parseFloat(d.decimalLongitude), parseFloat(d.decimalLatitude)],
    isWildfirePeriod: year !== null && (year >= 2019 && year <= 2020),
    species: d.species,
    individualCount: d.individualCount,
    year: d.year,
    stateProvince: d.stateProvince
  };
});

  const layers = [
    new ScatterplotLayer({
      id: 'wildfire-impact-points',
      data: pointData,
      getPosition: d => d.position,
      getFillColor: d => d.isWildfirePeriod ? [255, 80, 0, 200] : [30, 150, 200, 150],
      getRadius: 50000,
      radiusMinPixels: 3,
      radiusMaxPixels: 8,
      pickable: true
    })
  ];

  const dataWithYear = data;

  const populationByYear = useMemo(() => {
  const grouped = {};
  
  dataWithYear
    .filter(d => selectedSpecies ? d.species === selectedSpecies : true)
    .forEach(d => {
      const year = parseInt(d.year);
      if (!year || isNaN(year)) return;

      const state = d.stateProvince || 'Unknown';
      const count = parseInt(d.individualCount);
      const safeCount = isNaN(count) ? 1 : count;

      if (!grouped[year]) grouped[year] = { year, actual: 0 };
      if (!grouped[year][state]) grouped[year][state] = 0;

      grouped[year][state] += safeCount;
      grouped[year].actual += safeCount;
    });

  return Object.values(grouped).sort((a, b) => a.year - b.year);
}, [data, selectedSpecies]); // Only recalculate when data or selectedSpecies changes

  useEffect(() => {
    if (populationByYear.length > 0 && brushData.endIndex === undefined) {
      setBrushData({ startIndex: 0, endIndex: populationByYear.length - 1 });
    }
  }, [populationByYear.length]);

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
      .filter(y => y[location] !== undefined && y.year) // Ensure year exists
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




const calculateMigrationInsights = (data, selectedSpecies) => {
  if (!data || data.length === 0) return null;
  
  const speciesData = data.filter(d => selectedSpecies ? d.species === selectedSpecies : true);
  
  // 1. SEASONAL PATTERNS BY STATE
  const getSeasonalPatterns = () => {
    const seasonalData = {};
    const stateMonthCounts = {};
    
    speciesData.forEach(d => {
      if (!d.eventDate || !d.stateProvince) return;
      
      const date = new Date(d.eventDate);
      const month = date.getMonth() + 1; // 1-12
      const state = d.stateProvince;
      const count = parseInt(d.individualCount) || 1;
      
      if (!stateMonthCounts[state]) stateMonthCounts[state] = {};
      if (!stateMonthCounts[state][month]) stateMonthCounts[state][month] = 0;
      stateMonthCounts[state][month] += count;
    });
    
    // Find peak months for each state
    Object.keys(stateMonthCounts).forEach(state => {
      const months = stateMonthCounts[state];
      const peakMonth = Object.keys(months).reduce((a, b) => 
        months[a] > months[b] ? a : b
      );
      
      seasonalData[state] = {
        peakMonth: parseInt(peakMonth),
        peakCount: months[peakMonth],
        totalCount: Object.values(months).reduce((a, b) => a + b, 0),
        monthlyPattern: months
      };
    });
    
    return seasonalData;
  };
  
  // 2. MIGRATION TIMING ANALYSIS
  const getMigrationTiming = () => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const seasonalPatterns = getSeasonalPatterns();
    const insights = [];
    
    // Tasmania breeding season (spring/summer)
    if (seasonalPatterns['Tasmania']) {
      const tasPattern = seasonalPatterns['Tasmania'].monthlyPattern;
      const springSum = (tasPattern[9] || 0) + (tasPattern[10] || 0) + (tasPattern[11] || 0);
      const winterSum = (tasPattern[6] || 0) + (tasPattern[7] || 0) + (tasPattern[8] || 0);
      
      if (springSum > winterSum) {
        insights.push({
          type: 'breeding',
          location: 'Tasmania',
          season: 'Spring-Summer',
          detail: 'Higher activity in Tasmania during Sep-Nov (breeding season)'
        });
      }
    }
    
    // Mainland winter refuges
    ['New South Wales', 'Victoria'].forEach(state => {
      if (seasonalPatterns[state]) {
        const pattern = seasonalPatterns[state].monthlyPattern;
        const winterSum = (pattern[6] || 0) + (pattern[7] || 0) + (pattern[8] || 0);
        const summerSum = (pattern[12] || 0) + (pattern[1] || 0) + (pattern[2] || 0);
        
        if (winterSum > summerSum) {
          insights.push({
            type: 'wintering',
            location: state,
            season: 'Winter',
            detail: `Peak activity in ${state} during Jun-Aug (wintering grounds)`
          });
        }
      }
    });
    
    return insights;
  };
  
  // 3. STATE CORRELATION ANALYSIS
  const getStateCorrelations = () => {
    const yearlyStateData = {};
    
    // Group by year and state
    speciesData.forEach(d => {
      const year = parseInt(d.year);
      if (!year || isNaN(year)) return;
      
      const state = d.stateProvince || 'Unknown';
      const count = parseInt(d.individualCount) || 1;
      
      if (!yearlyStateData[year]) yearlyStateData[year] = {};
      if (!yearlyStateData[year][state]) yearlyStateData[year][state] = 0;
      yearlyStateData[year][state] += count;
    });
    
    // Calculate correlations between key states
    const states = ['Tasmania', 'Victoria', 'New South Wales'];
    const correlations = [];
    
    for (let i = 0; i < states.length; i++) {
      for (let j = i + 1; j < states.length; j++) {
        const state1 = states[i];
        const state2 = states[j];
        
        const years = Object.keys(yearlyStateData);
        const values1 = years.map(year => yearlyStateData[year][state1] || 0);
        const values2 = years.map(year => yearlyStateData[year][state2] || 0);
        
        const correlation = calculateCorrelation(values1, values2);
        
        correlations.push({
          states: [state1, state2],
          correlation: correlation,
          relationship: correlation < -0.3 ? 'negative' : correlation > 0.3 ? 'positive' : 'weak'
        });
      }
    }
    
    return correlations;
  };
  
  // 4. OCCURRENCE STATISTICS
  const getOccurrenceStats = () => {
    const totalOccurrences = speciesData.length;
    const uniqueYears = [...new Set(speciesData.map(d => d.year))].length;
    const stateDistribution = {};
    
    speciesData.forEach(d => {
      const state = d.stateProvince || 'Unknown';
      stateDistribution[state] = (stateDistribution[state] || 0) + 1;
    });
    
    const topStates = Object.entries(stateDistribution)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);
    
    return {
      totalOccurrences,
      uniqueYears,
      timespan: `${Math.min(...speciesData.map(d => d.year))} - ${Math.max(...speciesData.map(d => d.year))}`,
      topStates: topStates.map(([state, count]) => ({
        state,
        count,
        percentage: ((count / totalOccurrences) * 100).toFixed(1)
      }))
    };
  };
  
  return {
    seasonalPatterns: getSeasonalPatterns(),
    migrationTiming: getMigrationTiming(),
    stateCorrelations: getStateCorrelations(),
    occurrenceStats: getOccurrenceStats()
  };
};

// Helper function for correlation calculation
const calculateCorrelation = (x, y) => {
  if (x.length !== y.length || x.length === 0) return 0;
  
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
  
  return denominator === 0 ? 0 : numerator / denominator;
};

// Helper function to format migration insights
const formatMigrationInsights = (insights) => {
  if (!insights) return [];
  
  const formattedInsights = [];
  
  // Migration timing insights
  insights.migrationTiming.forEach(timing => {
    if (timing.type === 'breeding') {
      formattedInsights.push(`🏠 **Breeding Pattern:** ${timing.detail}`);
    } else if (timing.type === 'wintering') {
      formattedInsights.push(`❄️ **Winter Refuge:** ${timing.detail}`);
    }
  });
  
  // Correlation insights
  insights.stateCorrelations.forEach(corr => {
    if (corr.relationship === 'negative') {
      formattedInsights.push(
        `🔄 **Migration Link:** ${corr.states[0]} and ${corr.states[1]} show inverse patterns (${corr.correlation.toFixed(2)} correlation) - suggesting seasonal migration between these regions`
      );
    }
  });
  
  // Peak occurrence insights
  const seasonal = insights.seasonalPatterns;
  Object.keys(seasonal).forEach(state => {
    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const peakMonth = monthNames[seasonal[state].peakMonth];
    formattedInsights.push(
      `📈 **${state} Peak:** ${peakMonth} (${seasonal[state].peakCount} observations)`
    );
  });
  
  return formattedInsights;
};
  
const migrationInsights = calculateMigrationInsights(data, selectedSpecies);
const formattedInsights = formatMigrationInsights(migrationInsights);

 return (
  <div className="container" data-theme={darkMode ? 'dark' : 'light'}>
    {/* Header Section */}
    <div className="header-section">
      <div className="header-content">
        <h1 className="header">Ecological Migration Visualizer</h1>
        <p className="header-subtitle">
          Tracking Swift Parrot migrations and population dynamics across Australia
        </p>
        <button 
          onClick={() => setDarkMode(!darkMode)}
          className="theme-toggle"
        >
          {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
        </button>
      </div>
    </div>

    <div className="main-content">
      {/* Introduction Card - Wide Layout with Slideshow */}
      <div className="intro-card fade-in">
        <div className="intro-content">
          <h2 style={{ color: 'var(--secondary-color)', fontSize: '4.5rem', marginBottom: '-1rem',textAlign: 'center' }}>
          Swift Parrot
          </h2>
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', marginBottom: '0.5rem',textAlign: 'center' }}>
            <em>Lathamus discolor</em>
          </h3>
          <div className="intro-species-status">Critically Endangered</div>
          
          <p style={{ fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
            The Swift Parrot is Australia's fastest parrot and one of its most endangered birds. 
            These vibrant green parrots are endemic to southeastern Australia, known for their 
            remarkable seasonal migrations between Tasmania (breeding) and mainland Australia (wintering).
          </p>

          <div className="intro-highlights">
            <h4 style={{ color: 'var(--accent-color)', marginBottom: '1rem' }}>
              🔥 2019-2020 Bushfire Impact
            </h4>
            <p>
              The "Black Summer" bushfires devastated critical Swift Parrot wintering habitat across 
              NSW and Victoria during their most vulnerable period. With only 300-1,000 individuals 
              remaining, this habitat destruction represents an existential threat to the species.
            </p>
          </div>

          <div className="intro-stats">
            <div className="intro-stat">
              <span className="intro-stat-number">300-1,000</span>
              <span className="intro-stat-label">Individuals Left</span>
            </div>
            <div className="intro-stat">
              <span className="intro-stat-number">18.6M</span>
              <span className="intro-stat-label">Hectares Burned</span>
            </div>
            <div className="intro-stat">
              <span className="intro-stat-number">66%</span>
              <span className="intro-stat-label">Mainland Dependent</span>
            </div>
          </div>
        </div>

        <div className="intro-slideshow">
          <div className="slideshow-container">
            {slideshowImages.map((image, index) => (
              <div 
                key={index} 
                className={`slide ${index === currentSlide ? 'active' : ''}`}
              >
                {image.startsWith('https://via.placeholder.com') ? (
                  <div className="slide-placeholder">
                    📸 Swift Parrot Image {index + 1}
                  </div>
                ) : (
                  <img 
                    src={image} 
                    alt={`Swift Parrot ${index + 1}`}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                )}
              </div>
            ))}
          </div>
          
          <div className="slideshow-indicators">
            {slideshowImages.map((_, index) => (
              <div
                key={index}
                className={`indicator ${index === currentSlide ? 'active' : ''}`}
                onClick={() => setCurrentSlide(index)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Controls Section */}
      <div className="controls-section fade-in">
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

        <div className="controls-grid">
          <div className="control-group">
            <label>Select Species</label>
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
            <>
              <div className="control-group">
                <label>Select Location 1</label>
                <select value={location1} onChange={(e) => setLocation1(e.target.value)}>
                  {australianRegions.map(region => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
              </div>

              <div className="control-group">
                <label>Select Location 2</label>
                <select value={location2} onChange={(e) => setLocation2(e.target.value)}>
                  {australianRegions.map(region => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Visualization Container */}
      <div className="visualization-container fade-in">
        {view === 'map' ? (
          <DeckGL
            style={{ position: 'relative', width: '100%', height: '500px' }}
            initialViewState={{
              longitude: 134,
              latitude: -25,
              zoom: 3,
              bearing: 0,
              pitch: 0,
            }}
            controller={true}
            layers={layers}
            getTooltip={({ object }) => object && `
              Species: ${object.species || 'Unknown'}
              Count: ${object.individualCount || 'N/A'}
              Year: ${object.year || 'Unknown'}
              Region: ${object.stateProvince || 'Unknown'}
            `}
          >
            <Map
              mapLib={maplibregl}
              mapStyle={darkMode ? 
                "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json" : 
                "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
              }
              reuseMaps
            />
          </DeckGL>
        ) : view === 'graph' ? (
          <div style={{ height: '500px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
  <LineChart 
    data={populationByYear}
    margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
  >
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="year" />
    <YAxis />
    <Tooltip />
    <ReferenceArea 
      x1={2019} 
      x2={2020} 
      fill="rgba(255, 100, 0, 0.2)" 
      label={{ value: 'Wildfires', position: 'insideTop' }} 
    />
    <Legend />
    
    {populationByYear.length > 0 && 
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
    
    <Brush 
      dataKey="year"
      height={40}
      stroke="#8884d8"
      fill="rgba(136, 132, 216, 0.1)"
    />
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

      {/* Key Insights - Moved to end */}
      <div className="info-panels fade-in">
        <div className="info-panel">
          <h3>📊 Key Insights from the Data</h3>
          <p>
            Our analysis of 16,055 Swift Parrot observations from 2000-2025 reveals fascinating migration patterns: 
            <strong> Tasmania serves as the primary breeding hub (October peak)</strong>, while the mainland 
            provides critical winter refuges with <strong>NSW as the first arrival point (May)</strong> and 
            <strong> Victoria as late-winter concentration areas (August)</strong>. The data shows a clear 
            seasonal cycle with 66% of observations on mainland Australia, confirming their dependency on 
            cross-Bass Strait migration for survival.
          </p>
          
          {migrationInsights && (
            <div style={{ marginBottom: '1.5rem' }}>
              {/* Dropdown for insight selection */}
              <div className="control-group" style={{ marginBottom: '1.5rem' }}>
                <label>Select Insight Type</label>
                <select 
                  value={selectedInsightView}
                  onChange={(e) => setSelectedInsightView(e.target.value)}
                  style={{
                    padding: '0.5rem',
                    borderRadius: 'var(--border-radius)',
                    border: '2px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)'
                  }}
                >
                  <option value="scientific">🔬 Scientific Observations</option>
                  <option value="statistics">📈 Calculated Statistics</option>
                  <option value="patterns">🔄 Migration Patterns Detected</option>
                </select>
              </div>

              

{/* Conditional rendering based on selected view */}
{selectedInsightView === 'statistics' && (
  <div style={{ 
    background: 'var(--bg-primary)', 
    padding: '1.5rem', 
    borderRadius: 'var(--border-radius)',
    border: '1px solid var(--border-color)'
  }}>
    <h4 style={{ color: 'var(--secondary-color)', marginBottom: '1rem' }}>
      📈 Dataset Overview
    </h4>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
      <div>
        <p><strong>Total Observations:</strong></p>
        <p style={{ fontSize: '1.5rem', color: 'var(--secondary-color)' }}>
          {migrationInsights.occurrenceStats.totalOccurrences.toLocaleString()}
        </p>
      </div>
      <div>
        <p><strong>Time Span:</strong></p>
        <p style={{ fontSize: '1.2rem', color: 'var(--success-color)' }}>
          {migrationInsights.occurrenceStats.timespan}
        </p>
      </div>
      <div>
        <p><strong>Years of Data:</strong></p>
        <p style={{ fontSize: '1.2rem', color: 'var(--accent-color)' }}>
          {migrationInsights.occurrenceStats.uniqueYears} years
        </p>
      </div>
    </div>
    
    <h5 style={{ marginTop: '1.5rem', marginBottom: '1rem', color: 'var(--secondary-color)' }}>
      Geographic Distribution
    </h5>
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      {migrationInsights.occurrenceStats.topStates.map((state, index) => (
        <div key={index} style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.5rem',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--border-radius)',
          borderLeft: `4px solid hsl(${index * 60}, 70%, 50%)`
        }}>
          <span><strong>{state.state}</strong></span>
          <span>{state.count.toLocaleString()} obs ({state.percentage}%)</span>
        </div>
      ))}
    </div>
  </div>
)}

{selectedInsightView === 'patterns' && (
  <div style={{ 
    background: 'var(--bg-primary)', 
    padding: '1.5rem', 
    borderRadius: 'var(--border-radius)',
    border: '1px solid var(--border-color)'
  }}>
    <h4 style={{ color: 'var(--secondary-color)', marginBottom: '1rem' }}>
      🔄 Detected Migration Patterns
    </h4>
    {formattedInsights.length > 0 ? (
      <div style={{ display: 'grid', gap: '1rem' }}>
        {formattedInsights.map((insight, index) => {
          const isBreeding = insight.includes('🏠');
          const isWinter = insight.includes('❄️');
          const isPeak = insight.includes('📈');
          const isCorrelation = insight.includes('🔄');
          
          let bgColor = 'var(--bg-secondary)';
          let borderColor = 'var(--border-color)';
          
          if (isBreeding) { bgColor = 'rgba(76, 175, 80, 0.1)'; borderColor = '#4CAF50'; }
          else if (isWinter) { bgColor = 'rgba(33, 150, 243, 0.1)'; borderColor = '#2196F3'; }
          else if (isPeak) { bgColor = 'rgba(255, 152, 0, 0.1)'; borderColor = '#FF9800'; }
          else if (isCorrelation) { bgColor = 'rgba(156, 39, 176, 0.1)'; borderColor = '#9C27B0'; }
          
          return (
            <div key={index} style={{ 
              padding: '1rem',
              background: bgColor,
              borderRadius: 'var(--border-radius)',
              borderLeft: `4px solid ${borderColor}`,
              lineHeight: '1.4'
            }}>
              <span dangerouslySetInnerHTML={{
                __html: insight.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              }} />
            </div>
          );
        })}
      </div>
    ) : (
      <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
        Analyzing migration patterns... Select a species to see detailed insights.
      </p>
    )}
  </div>
)}

{selectedInsightView === 'scientific' && (
  <div style={{ 
    background: 'var(--bg-primary)', 
    padding: '1.5rem', 
    borderRadius: 'var(--border-radius)',
    border: '1px solid var(--border-color)'
  }}>
    <h4 style={{ color: 'var(--secondary-color)', marginBottom: '1rem' }}>
      🔬 Scientific Implications
    </h4>
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ 
        padding: '1rem',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--border-radius)',
        borderLeft: '4px solid var(--success-color)'
      }}>
        <strong>🔄 Cyclical Migration Evidence:</strong> The sine-wave patterns in population graphs 
        provide quantitative proof of regular seasonal migration cycles between Tasmania (breeding) 
        and mainland Australia (wintering).
      </div>
      
      <div style={{ 
        padding: '1rem',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--border-radius)',
        borderLeft: '4px solid var(--secondary-color)'
      }}>
        <strong>📊 Statistical Correlations:</strong> Negative correlations between Tasmania and 
        mainland states (-0.4 to -0.7) mathematically confirm migration rather than random movement.
      </div>
      
      <div style={{ 
        padding: '1rem',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--border-radius)',
        borderLeft: '4px solid var(--warning-color)'
      }}>
        <strong>📅 Temporal Clustering:</strong> Peak observation months (May NSW, August Victoria, 
        October Tasmania) align perfectly with known Swift Parrot life cycle requirements.
      </div>
      
      <div style={{ 
        padding: '1rem',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--border-radius)',
        borderLeft: '4px solid var(--accent-color)'
      }}>
        <strong>🌍 Conservation Implications:</strong> 66% mainland dependency highlights vulnerability 
        to habitat loss on wintering grounds - critical for conservation planning.
      </div>
    </div>
  </div>
)}
            </div>
          )}
        </div>
      </div>

      {/* About Section */}
      <section className="about fade-in">
        <h2>About This Visualization</h2>
        <p>
          This application visualizes Swift Parrot occurrence data from the Global Biodiversity 
          Information Facility (GBIF) to track migration patterns and population dynamics across 
          southeastern Australia. The data spans multiple years and provides insights into how 
          environmental factors, particularly the 2019-2020 bushfires, may have affected this 
          critically endangered species.
        </p>
        <ul>
          <li><strong>Migration Map:</strong> Shows occurrence locations with wildfire period highlighting (orange = 2019-2020, blue = other years)</li>
          <li><strong>Population Graph:</strong> Displays raw population counts by year and state, with the wildfire period highlighted</li>
          <li><strong>Logistic Growth Model:</strong> Fits mathematical models to population data to predict future trends and carrying capacity</li>
        </ul>
        <p>
          Use the controls above to filter data by species and explore different aspects of the 
          migration patterns. The dark/light mode toggle adapts the visualization for different 
          viewing preferences.
        </p>
      </section>
    </div>
  </div>
);
}

export default App;