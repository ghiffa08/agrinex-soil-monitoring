import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue } from 'firebase/database';

// --- Konfigurasi Firebase Anda ---
const firebaseConfig = {
  apiKey: "AIzaSyBObWq_MSS1ZUH2b_4JHCzr3EvglDBfMqU",
  authDomain: "agrinex-soil-monitoring.firebaseapp.com",
  databaseURL: "https://agrinex-soil-monitoring-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "agrinex-soil-monitoring",
  storageBucket: "agrinex-soil-monitoring.appspot.com",
  messagingSenderId: "324527067216",
  appId: "1:324527067216:web:e633dbd3a8e59fa3af4155",
  measurementId: "G-R23Z66NZRP"
};

// --- Inisialisasi Firebase ---
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// --- Custom Hook untuk memuat script dari CDN ---
const useScript = (url: string) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let script = document.querySelector(`script[src="${url}"]`) as HTMLScriptElement;

    if (!script) {
      script = document.createElement('script');
      script.src = url;
      script.async = true;
      document.body.appendChild(script);

      const handleLoad = () => setIsLoaded(true);
      const handleError = () => setError(new Error(`Failed to load script: ${url}`));

      script.addEventListener('load', handleLoad);
      script.addEventListener('error', handleError);

      return () => {
        script.removeEventListener('load', handleLoad);
        script.removeEventListener('error', handleError);
      };
    } else {
        setIsLoaded(true); // Script already exists
    }
  }, [url]);

  return { isLoaded, error };
};

// --- Interfaces ---
interface SensorLog {
  moisture_percent: number;
  raw_adc: number;
  timestamp: string;
}

interface SensorData {
  sensor_id: string;
  latest: SensorLog;
  history: SensorLog[];
}

// --- Komponen ApexCharts Line Chart ---
interface ApexLineChartProps {
  seriesData: number[];
  categories: string[];
}

const ApexLineChart: React.FC<ApexLineChartProps> = ({ seriesData, categories }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!chartRef.current || typeof (window as any).ApexCharts === 'undefined') return;

    const options = {
      chart: {
        type: 'area',
        height: 200,
        zoom: { enabled: false },
        toolbar: { show: false }
      },
      series: [{ name: 'Moisture', data: seriesData }],
      xaxis: {
        type: 'datetime',
        categories: categories,
        labels: {
          datetimeUTC: false,
          style: { colors: '#6b7280' }
        }
      },
      yaxis: {
        min: 0,
        max: 100,
        labels: {
          formatter: (val: number) => `${val}%`,
          style: { colors: '#6b7280' }
        }
      },
      colors: ['#22c55e'],
      stroke: { curve: 'smooth', width: 2 },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.7,
          opacityTo: 0.1,
          stops: [0, 100]
        }
      },
      dataLabels: { enabled: false },
      tooltip: {
        x: { format: 'dd MMM yyyy, HH:mm' }
      },
      grid: {
        borderColor: '#e5e7eb',
        strokeDashArray: 4
      }
    };

    const chart = new (window as any).ApexCharts(chartRef.current, options);
    chart.render();

    return () => chart.destroy();
  }, [seriesData, categories]);

  return <div ref={chartRef} />;
};

// --- Komponen ApexCharts Gauge Chart ---
interface ApexGaugeChartProps {
  value: number;
}

const ApexGaugeChart: React.FC<ApexGaugeChartProps> = ({ value }) => {
    const chartRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!chartRef.current || typeof (window as any).ApexCharts === 'undefined') return;
        
        const clampedValue = Math.max(0, Math.min(100, value));
        let progressColor = '#22c55e';
        if (clampedValue < 30) progressColor = '#f59e0b';
        if (clampedValue < 10) progressColor = '#ef4444';

        const options = {
            chart: {
                type: 'radialBar',
                height: 180,
            },
            series: [clampedValue],
            plotOptions: {
                radialBar: {
                    startAngle: -135,
                    endAngle: 135,
                    hollow: {
                        margin: 0,
                        size: '70%',
                        background: '#fff',
                    },
                    track: {
                        background: '#f3f4f6',
                        strokeWidth: '97%',
                    },
                    dataLabels: {
                        name: {
                            show: true,
                            offsetY: -10,
                            fontSize: '14px',
                            color: '#6b7280',
                            formatter: () => 'Moisture'
                        },
                        value: {
                            formatter: (val: number) => `${val}%`,
                            color: '#111827',
                            fontSize: '30px',
                            show: true,
                        },
                    },
                },
            },
            fill: {
                colors: [progressColor]
            },
            stroke: {
                lineCap: 'round'
            },
        };
        const chart = new (window as any).ApexCharts(chartRef.current, options);
        chart.render();

        return () => chart.destroy();
    }, [value]);

    return <div ref={chartRef} className="-mt-4" />;
};

// --- Komponen Modal ---
interface DetailModalProps {
  sensorData: SensorData | null;
  onClose: () => void;
}

const DetailModal: React.FC<DetailModalProps> = ({ sensorData, onClose }) => {
    if (!sensorData) return null;

    const { sensor_id, history } = sensorData;
    const sortedHistory = [...history].reverse();
    const chartSeries = history.map(log => log.moisture_percent);
    const chartCategories = history.map(log => log.timestamp);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800 capitalize">{sensor_id.replace('_', ' ')} Details</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-800 transition-colors">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </header>
                <div className="p-6 overflow-y-auto">
                    <h3 className="text-lg font-semibold text-green-600 mb-2">Moisture Trend</h3>
                    <div className="bg-gray-50 rounded-lg mb-6 -mx-2">
                        <ApexLineChart seriesData={chartSeries} categories={chartCategories} />
                    </div>
                    <h3 className="text-lg font-semibold text-green-600 mb-4">History Log</h3>
                    <div className="max-h-60 overflow-y-auto pr-2">
                        <table className="w-full text-sm text-left text-gray-700">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-100">
                                <tr>
                                    <th scope="col" className="px-4 py-2">Timestamp</th>
                                    <th scope="col" className="px-4 py-2 text-center">Moisture</th>
                                    <th scope="col" className="px-4 py-2 text-right">Raw ADC</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedHistory.map((log) => (
                                    <tr key={log.timestamp} className="border-b border-gray-200 hover:bg-gray-50">
                                        <td className="px-4 py-2">{new Date(log.timestamp).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' })}</td>
                                        <td className="px-4 py-2 text-center font-medium text-gray-900">{log.moisture_percent}%</td>
                                        <td className="px-4 py-2 text-right font-mono text-gray-500">{log.raw_adc}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Komponen Card Sensor ---
interface SensorCardProps {
  sensorData: SensorData;
  onSelect: (data: SensorData) => void;
}

const SensorCard: React.FC<SensorCardProps> = ({ sensorData, onSelect }) => {
    if (!sensorData || !sensorData.latest) return null;

    const { moisture_percent } = sensorData.latest;
    const { sensor_id } = sensorData;
    const historyCount = sensorData.history.length;

    let statusColor = 'bg-green-500';
    let statusText = 'Optimal';
    if (moisture_percent < 30) { statusColor = 'bg-amber-500'; statusText = 'Low'; }
    if (moisture_percent < 10) { statusColor = 'bg-red-600'; statusText = 'Critically Dry'; }

    return (
        <div onClick={() => onSelect(sensorData)} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-md hover:shadow-lg hover:border-green-400 transition-all duration-300 cursor-pointer group flex flex-col justify-between">
            <div>
                <div className="flex justify-between items-start">
                    <h3 className="text-lg font-bold text-gray-800 capitalize">{sensor_id.replace('_', ' ')}</h3>
                    <span className={`px-3 py-1 text-xs font-bold text-white rounded-full ${statusColor}`}>{statusText}</span>
                </div>
                <div className="flex justify-center items-center my-1 h-[150px]">
                    <ApexGaugeChart value={moisture_percent} />
                </div>
            </div>
            <div className="text-xs text-gray-400 group-hover:text-green-600 transition-colors flex justify-between items-center mt-2">
                <span>{historyCount} data points</span>
                <span>View Details &rarr;</span>
            </div>
        </div>
    );
};

// --- Komponen Utama Aplikasi Dashboard ---
export default function App() {
    const [sensorsData, setSensorsData] = useState<Record<string, SensorData>>({});
    const [isFirebaseLoading, setIsFirebaseLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedSensor, setSelectedSensor] = useState<SensorData | null>(null);
    const { isLoaded: isApexChartsLoaded, error: apexChartsError } = useScript('https://cdn.jsdelivr.net/npm/apexcharts');
    
    useEffect(() => {
        const sensorReadingsRef = ref(database, 'sensor_readings');
       const unsubscribe = onValue(sensorReadingsRef, (snapshot) => {
            try {
                const data = snapshot.val();
                if (data) {
                    const processedData: Record<string, SensorData> = {};
                    Object.entries(data).forEach(([sensorId, readings]) => {
                        const history = Object.values(readings as Record<string, SensorLog>).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                        if (history.length > 0) {
                            processedData[sensorId] = { 
                                sensor_id: sensorId, 
                                latest: history[history.length - 1], 
                                history 
                            };
                        }
                    });
                    setSensorsData(processedData);
                }
                setIsFirebaseLoading(false);
            } catch (err) {
                setError("Failed to process data from Firebase.");
                setIsFirebaseLoading(false);
            }
        }, () => {
            setError("Cannot connect to Firebase. Check configuration.");
            setIsFirebaseLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const isLoading = isFirebaseLoading || !isApexChartsLoaded;

    return (
        <>
            <div className="bg-gray-50 min-h-screen text-gray-800 font-sans p-4 sm:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">
                    <header className="mb-8 text-center">
                         <h1 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-10 sm:w-10 mr-3 text-green-500" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 21c.5 -4.5 2.5 -8 7 -10" /><path d="M9 18c6.218 0 10.5 -3.288 11 -12v-2h-4.014c-9 0 -11.986 4 -12.986 11z" /></svg>
                            Agrinex Dashboard
                        </h1>
                        <p className="text-gray-500 mt-2">Real-time soil moisture data</p>
                    </header>
                    
                    {isLoading && (
                        <div className="flex justify-center items-center h-64">
                             <svg className="animate-spin h-8 w-8 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        </div>
                    )}

                    {error && <p className="text-center text-red-600 bg-red-100 p-4 rounded-lg">{error}</p>}
                    {apexChartsError && <p className="text-center text-red-600 bg-red-100 p-4 rounded-lg">Failed to load charting library.</p>}
                    
                    {!isLoading && !error && (
                         Object.keys(sensorsData).length > 0 ? (
                            <main className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {Object.keys(sensorsData).sort().map(sensorId => (
                                    <SensorCard key={sensorId} sensorData={sensorsData[sensorId]} onSelect={setSelectedSensor} />
                                ))}
                            </main>
                        ) : (
                            <p className="text-center text-gray-500 mt-10">Waiting for sensor data...</p>
                        )
                    )}
                </div>
            </div>
            {selectedSensor && <DetailModal sensorData={selectedSensor} onClose={() => setSelectedSensor(null)} />}
        </>
    );
}

