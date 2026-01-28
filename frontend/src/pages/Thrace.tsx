import React, { useEffect, useRef, useState } from 'react';
import { apiService } from '../services/api';
import * as XLSX from 'xlsx';
// @ts-ignore
import Plotly from 'plotly.js-dist-min';

interface Template {
  id: string;
  name: string;
  fileName: string;
}

interface ErrorRow {
  rowId: number;
  village: string;
  country: string;
  date: string;
  error: string;
}

interface CycleReportData {
  population: any[];
  clinical: any[];
  serology: any[];
}

const Thrace: React.FC = () => {
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [dataValidationErrors, setDataValidationErrors] = useState<ErrorRow[]>([]);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [showReportSection, setShowReportSection] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<CycleReportData | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<number>(300); // Default to Greece
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState<number>(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showFreedomSection, setShowFreedomSection] = useState(false);
  const [freedomLoading, setFreedomLoading] = useState(false);
  const [freedomError, setFreedomError] = useState<string | null>(null);
  const [freedomData, setFreedomData] = useState<any | null>(null);
  const [freedomSpecies, setFreedomSpecies] = useState('ALL');
  const [freedomDisease, setFreedomDisease] = useState('FMD');
  const [freedomRegion, setFreedomRegion] = useState('ALL');
  const freedomChartRef = useRef<HTMLDivElement | null>(null);

  const templates: Template[] = [
    { id: 'bulgaria', name: 'Bulgaria', fileName: 'ThraceActivitiesBulgaria' },
    { id: 'greece', name: 'Greece', fileName: 'ThraceActivitiesGreece' },
    { id: 'turkey', name: 'Türkiye', fileName: 'ThraceActivitiesTurkey' },
  ];

  const handleDownloadTemplate = (template: Template) => {
    // Download the Excel file from the static folder
    const fileUrl = `/templates/${template.fileName}.xlsx`;
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = `${template.fileName}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowTemplateModal(false);
  };

  const handleUploadClick = () => {
    setUploadErrors([]);
    setUploadMessage('');
    setUploadSuccess(false);
    setShowUploadModal(true);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.xlsx')) {
      setUploadErrors(['Only .xlsx files are allowed']);
      return;
    }

    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (!token) {
      setUploadErrors(['You must be logged in to upload data. Please log in and try again.']);
      return;
    }

    console.log('Token found, uploading file...', { tokenLength: token.length, fileName: file.name });

    setUploadLoading(true);
    setUploadErrors([]);
    setUploadMessage('');
    setUploadSuccess(false);
    setDataValidationErrors([]);
    setShowErrorDetails(false);

    try {
      console.log('Creating FormData...');
      const response = await apiService.thrace.uploadData(file);
      console.log('Upload response:', response.data);

      if (response.data.success) {
        // Upload successful - now check for approval
        setUploadMessage('File uploaded successfully. Checking for data validation errors...');
        
        try {
          // Call approve endpoint to check for errors and move clean data
          const approveResponse = await apiService.thrace.approveData();
          console.log('Approval response:', approveResponse.data);
          
          if (approveResponse.data.has_errors) {
            // There are validation errors - show them to user
            setDataValidationErrors(approveResponse.data.error_rows || []);
            setShowErrorDetails(true);
            setUploadMessage(
              `⚠️ ${approveResponse.data.error_count} rows have validation errors. ` +
              `${approveResponse.data.error_rows?.length || 0} rows with issues listed below.`
            );
            setUploadSuccess(false);
          } else {
            // No errors - data approved and imported
            setUploadSuccess(true);
            setUploadMessage(`✓ Data approved and imported successfully! ${approveResponse.data.inserted_count} rows inserted.`);
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
            // Close modal after 3 seconds
            setTimeout(() => {
              setShowUploadModal(false);
              setDataValidationErrors([]);
              setShowErrorDetails(false);
            }, 3000);
          }
        } catch (approveError: any) {
          console.error('Approval error:', approveError);
          setUploadErrors(['Error processing uploaded data. Please try again.']);
          setUploadSuccess(false);
        }
      } else {
        setUploadErrors(response.data.errors || [response.data.message]);
        setUploadMessage(`Validation failed: ${response.data.valid_rows} valid rows out of ${response.data.total_rows}`);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      if (error.response?.status === 401) {
        setUploadErrors(['Authentication failed. Your session may have expired.']);
      } else if (error.response?.data?.detail) {
        setUploadErrors([error.response.data.detail]);
      } else if (error.response?.data?.errors) {
        // Handle array of error objects and extract messages
        const errorMessages = Array.isArray(error.response.data.errors)
          ? error.response.data.errors.map((err: any) => {
              if (typeof err === 'string') return err;
              if (err.msg) return err.msg;
              return JSON.stringify(err);
            })
          : [error.response.data.errors];
        setUploadErrors(errorMessages);
      } else if (error.message) {
        setUploadErrors([error.message]);
      } else {
        setUploadErrors(['An error occurred during file upload']);
      }
    } finally {
      setUploadLoading(false);
    }
  };

  const handleReportClick = () => {
    setShowReportSection(true);
    setShowFreedomSection(false);
    setReportData(null);
  };

  const handleGenerateReport = async () => {
    setReportLoading(true);
    setReportData(null);

    try {
      const response = await apiService.thrace.getCycleReport(selectedCountry, selectedYear, selectedQuarter);
      console.log('Cycle report response:', response.data);
      
      if (response.data.success) {
        setReportData(response.data.data);
      }
    } catch (error: any) {
      console.error('Report generation error:', error);
      alert(`Error generating report: ${error.response?.data?.detail || error.message}`);
    } finally {
      setReportLoading(false);
    }
  };

  const handleFreedomClick = () => {
    setShowFreedomSection(true);
    setShowReportSection(false);
    // Don't auto-fetch - let user set filters first
  };

  const fetchFreedomData = async (refreshSummary = false) => {
    setFreedomLoading(true);
    setFreedomError(null);
    try {
      const res = await apiService.thrace.getFreedomData(
        freedomSpecies,
        freedomDisease,
        freedomRegion,
        refreshSummary
      );
      setFreedomData(res.data.data);
    } catch (err: any) {
      const message = err?.response?.data?.detail || err?.message || 'Error loading freedom analysis';
      setFreedomError(message);
    } finally {
      setFreedomLoading(false);
    }
  };

  useEffect(() => {
    if (!freedomData || !freedomChartRef.current) return;

    const labels: string[] = freedomData.labels || [];
    const pfree = (freedomData.pfree || []).map((v: any) => Number(v));
    const sens = (freedomData.sens || []).map((v: any) => Number(v));
    const pintro = (freedomData.pintro || []).map((v: any) => Number(v));
    const sero = freedomData.sero || [];
    const clin = freedomData.clin || [];

    // Plotly traces matching PHP app layout
    const traces: any[] = [
      // Row 1 (bottom): Stacked bars for animals tested
      {
        name: 'Serology',
        type: 'bar',
        x: labels,
        y: sero,
        yaxis: 'y',
        marker: { color: '#fdc086' }
      },
      {
        name: 'Clinical',
        type: 'bar',
        x: labels,
        y: clin,
        yaxis: 'y',
        marker: { color: '#beaed4' }
      },
      // Row 2: P(introduction)
      {
        name: 'P(Intro)',
        type: 'scatter',
        x: labels,
        y: pintro,
        fill: 'tozeroy',
        yaxis: 'y2',
        line: { shape: 'spline', smoothing: 0.8 },
        marker: { color: '#fdc086' }
      },
      // Row 3: Sensitivity
      {
        name: 'Sensitivity',
        type: 'scatter',
        x: labels,
        y: sens,
        fill: 'tozeroy',
        yaxis: 'y3',
        line: { shape: 'spline', smoothing: 0.8 },
        marker: { color: '#beaed4' }
      },
      // Row 4 (top): P(free)
      {
        name: 'P(free)',
        type: 'scatter',
        x: labels,
        y: pfree,
        fill: 'tozeroy',
        yaxis: 'y4',
        line: { shape: 'spline', smoothing: 0.8 },
        marker: { color: '#7fc97f' }
      }
    ];

    const layout = {
      barmode: 'stack',
      hovermode: 'closest',
      margin: { t: 20, b: 50, l: 80, r: 180 },
      showlegend: true,
      legend: {
        orientation: 'v',
        xanchor: 'right',
        yanchor: 'top',
        x: 1.18,
        y: 1,
        bgcolor: 'rgba(255,255,255,0.9)',
        bordercolor: '#ddd',
        borderwidth: 1
      },
      xaxis: {
        title: 'Month',
        type: 'date',
        showspikes: true
      },
      yaxis: {
        domain: [0, 0.24],
        title: 'Animals<br>tested',
        zeroline: false,
        autorange: true
      },
      yaxis2: {
        domain: [0.26, 0.48],
        title: 'Probability<br>of introduction',
        zeroline: false
      },
      yaxis3: {
        domain: [0.52, 0.74],
        title: 'Surveillance<br>sensitivity',
        zeroline: false
      },
      yaxis4: {
        domain: [0.76, 1],
        title: 'Probability<br>of freedom',
        zeroline: false,
        range: [0.9, 1]
      }
    };

    const config = { responsive: true };

    Plotly.newPlot(freedomChartRef.current, traces, layout, config);
  }, [freedomData]);

  const handleDownloadExcel = () => {
    if (!reportData) return;

    const wb = XLSX.utils.book_new();

    // Sheet 1: Animal Population
    const popData = reportData.population.map(row => ({
      'Country': row.country,
      'Province/District': row.district_province,
      'Quarter': row.quarter,
      'Year': row.year,
      'Cattle Pop.': row.cattle_pop || 0,
      'Sheep Pop.': row.sheep_pop || 0,
      'Goats Pop.': row.goat_pop || 0,
      'Buffaloes Pop.': row.buffalo_pop || 0,
      'Pigs Pop.': row.pig_pop || 0,
      'Distinct Epiunits': row.distinct_epiunits,
      'N. of visits': row.total_visits,
      'N. Cattle': parseFloat(row.avg_cattle || 0).toFixed(2),
      'N. Sheep': parseFloat(row.avg_sheep || 0).toFixed(2),
      'N. Goats': parseFloat(row.avg_goat || 0).toFixed(2),
      'N. Pigs': parseFloat(row.avg_pig || 0).toFixed(2),
      'N. Buffaloes': parseFloat(row.avg_buffalo || 0).toFixed(2),
    }));
    const ws1 = XLSX.utils.json_to_sheet(popData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Animal Population');

    // Sheet 2: Clinical Examination
    const clinicalData = reportData.clinical.map(row => ({
      'Country': row.country,
      'Province/District': row.district_province,
      'Quarter': row.quarter,
      'Year': row.year,
      'Distinct Epiunits': row.distinct_epiunits,
      'N. of visits': row.total_visits,
      'N. Cattle exam.': row.cattle_exam || 0,
      'N. Cattle Pos. FMD': row.cattle_pos_fmd || 0,
      'N. Cattle Pos. LSD': row.cattle_pos_lsd || 0,
      'N. Sheep exam.': row.sheep_exam || 0,
      'N. Sheep Pos. FMD': row.sheep_pos_fmd || 0,
      'N. Sheep Pos. SGP': row.sheep_pos_sgp || 0,
      'N. Sheep Pos. PPR': row.sheep_pos_ppr || 0,
      'N. Goats exam.': row.goat_exam || 0,
      'N. Goats Pos. FMD': row.goat_pos_fmd || 0,
      'N. Goats Pos. SGP': row.goat_pos_sgp || 0,
      'N. Goats Pos. PPR': row.goat_pos_ppr || 0,
      'N. Buffaloes exam.': row.buffalo_exam || 0,
      'N. Buffaloes Pos. FMD': row.buffalo_pos_fmd || 0,
      'N. Buffaloes Pos. LSD': row.buffalo_pos_lsd || 0,
      'Target': row.target || 0,
    }));
    const ws2 = XLSX.utils.json_to_sheet(clinicalData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Clinical Examination');

    // Sheet 3: Serological Examination
    const serologyData = reportData.serology.map(row => ({
      'Country': row.country,
      'Province/District': row.district_province,
      'Quarter': row.quarter,
      'Year': row.year,
      'Distinct Epiunits': row.distinct_epiunits,
      'N. of visits': row.total_visits,
      'N. Cattle sampled': row.cattle_sample || 0,
      'N. Cattle Sero. Pos. FMD': row.cattle_sero_fmd || 0,
      'N. Cattle Sero. Pos. LSD': row.cattle_sero_lsd || 0,
      'N. Sheep sampled': row.sheep_sample || 0,
      'N. Sheep Sero. Pos. FMD': row.sheep_sero_fmd || 0,
      'N. Sheep Sero. Pos. SGP': row.sheep_sero_sgp || 0,
      'N. Sheep Sero. Pos. PPR': row.sheep_sero_ppr || 0,
      'N. Goats sampled': row.goat_sample || 0,
      'N. Goats Sero. Pos. FMD': row.goat_sero_fmd || 0,
      'N. Goats Sero. Pos. SGP': row.goat_sero_sgp || 0,
      'N. Goats Sero. Pos. PPR': row.goat_sero_ppr || 0,
      'N. Pigs sampled': row.pig_sample || 0,
      'N. Pigs Sero. Pos. FMD': row.pig_sero_fmd || 0,
      'N. Buffaloes sampled': row.buffalo_sample || 0,
      'N. Buffaloes Sero. Pos. FMD': row.buffalo_sero_fmd || 0,
      'N. Buffaloes Sero. Pos. LSD': row.buffalo_sero_lsd || 0,
      'N. Wild sampled': row.wild_sample || 0,
      'N. Wild Sero. Pos. FMD': row.wild_sero_fmd || 0,
      'Target': row.target || 0,
    }));
    const ws3 = XLSX.utils.json_to_sheet(serologyData);
    XLSX.utils.book_append_sheet(wb, ws3, 'Serological Examination');

    // Generate Excel file
    XLSX.writeFile(wb, `CycleReport_Q${selectedQuarter}_${selectedYear}.xlsx`);
  };

  return (
    <div className="container mx-auto px-4">
      {/* Header Section */}
      <section className="mb-6">
        <p className="font-black capitalize text-2xl mb-6 font-martaBold">
          THRACE
        </p>
        <div className="w-full">
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <p className="text-gray-700 mb-4">
              <strong>THRACE:</strong> An international Transboundary High Risk Area Coordinated Epidemio-surveillance supported by EuFMD.
            </p>
            <p className="text-gray-700 mb-4">
              The THRACE project involves Turkey, Bulgaria and Greece who share common borders in the Thrace area.
            </p>
            <p className="text-gray-700">
              This database has been developed to facilitate the regular submission and management of surveillance data generated under the THRACE program from the three countries.
            </p>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex justify-start space-x-2">
          <button 
            className="nav-btn"
            onClick={() => setShowTemplateModal(true)}
          >
            Template Download
          </button>
          <button 
            className="nav-btn"
            onClick={handleUploadClick}
          >
            Data Upload
          </button>
          <button 
            className="nav-btn"
            onClick={handleReportClick}
          >
            Report
          </button>
          <button 
            className="nav-btn"
            onClick={handleFreedomClick}
          >
            Freedom from disease analysis
          </button>
        </div>
      </section>

      {/* Report Section */}
      {showReportSection && (
        <section className="mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">Cycle Report Generator</h2>
            
            {/* Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Country
                </label>
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value={300}>Greece</option>
                  <option value={100}>Bulgaria</option>
                  <option value={792}>Turkey</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Year
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quarter
                </label>
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value={1}>Q1 (Jan-Mar)</option>
                  <option value={2}>Q2 (Apr-Jun)</option>
                  <option value={3}>Q3 (Jul-Sep)</option>
                  <option value={4}>Q4 (Oct-Dec)</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleGenerateReport}
                  disabled={reportLoading}
                  className="w-full nav-btn disabled:opacity-50"
                >
                  {reportLoading ? 'Generating...' : 'Generate Report'}
                </button>
              </div>
            </div>

            {/* Report Data Tables */}
            {reportData && (
              <div className="space-y-6">
                {/* Section 1: Animal Population */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-700 bg-blue-100 px-4 py-2 rounded">
                    Animal Population - Quarter {selectedQuarter}, {selectedYear}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 border">
                      <thead className="bg-blue-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Country</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Province/District</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Cattle Pop.</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Sheep Pop.</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Goats Pop.</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Buffaloes Pop.</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Pigs Pop.</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Distinct Epiunits</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">N. of visits</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {reportData.population.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-sm">{row.country}</td>
                            <td className="px-3 py-2 text-sm">{row.district_province}</td>
                            <td className="px-3 py-2 text-sm text-right">{row.cattle_pop || 0}</td>
                            <td className="px-3 py-2 text-sm text-right">{row.sheep_pop || 0}</td>
                            <td className="px-3 py-2 text-sm text-right">{row.goat_pop || 0}</td>
                            <td className="px-3 py-2 text-sm text-right">{row.buffalo_pop || 0}</td>
                            <td className="px-3 py-2 text-sm text-right">{row.pig_pop || 0}</td>
                            <td className="px-3 py-2 text-sm text-right">{row.distinct_epiunits}</td>
                            <td className="px-3 py-2 text-sm text-right">{row.total_visits}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 2: Clinical Examination */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-700 bg-red-100 px-4 py-2 rounded">
                    Clinical Examination - Quarter {selectedQuarter}, {selectedYear}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 border">
                      <thead className="bg-red-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Country</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Province/District</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Cattle Exam</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Cattle +FMD</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Cattle +LSD</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Sheep Exam</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Sheep +FMD</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Sheep +SGP</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Sheep +PPR</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Goat Exam</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Buffalo Exam</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {reportData.clinical.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-sm">{row.country}</td>
                            <td className="px-3 py-2 text-sm">{row.district_province}</td>
                            <td className="px-3 py-2 text-sm text-right">{row.cattle_exam || 0}</td>
                            <td className="px-3 py-2 text-sm text-right">{row.cattle_pos_fmd || 0}</td>
                            <td className="px-3 py-2 text-sm text-right">{row.cattle_pos_lsd || 0}</td>
                            <td className="px-3 py-2 text-sm text-right">{row.sheep_exam || 0}</td>
                            <td className="px-3 py-2 text-sm text-right">{row.sheep_pos_fmd || 0}</td>
                            <td className="px-3 py-2 text-sm text-right">{row.sheep_pos_sgp || 0}</td>
                            <td className="px-3 py-2 text-sm text-right">{row.sheep_pos_ppr || 0}</td>
                            <td className="px-3 py-2 text-sm text-right">{row.goat_exam || 0}</td>
                            <td className="px-3 py-2 text-sm text-right">{row.buffalo_exam || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 3: Serological Examination */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-700 bg-green-100 px-4 py-2 rounded">
                    Serological Examination - Quarter {selectedQuarter}, {selectedYear}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 border">
                      <thead className="bg-green-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Country</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Province/District</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Cattle Sample</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Cattle +FMD</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Sheep Sample</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Sheep +FMD</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Goat Sample</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Pig Sample</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Buffalo Sample</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Wild Sample</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {reportData.serology.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-sm">{row.country}</td>
                            <td className="px-3 py-2 text-sm">{row.district_province}</td>
                            <td className="px-3 py-2 text-sm text-right">{row.cattle_sample || 0}</td>
                            <td className="px-3 py-2 text-sm text-right">{row.cattle_sero_fmd || 0}</td>
                            <td className="px-3 py-2 text-sm text-right">{row.sheep_sample || 0}</td>
                            <td className="px-3 py-2 text-sm text-right">{row.sheep_sero_fmd || 0}</td>
                            <td className="px-3 py-2 text-sm text-right">{row.goat_sample || 0}</td>
                            <td className="px-3 py-2 text-sm text-right">{row.pig_sample || 0}</td>
                            <td className="px-3 py-2 text-sm text-right">{row.buffalo_sample || 0}</td>
                            <td className="px-3 py-2 text-sm text-right">{row.wild_sample || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Download Excel Button */}
                <div className="flex justify-center mt-6">
                  <button
                    onClick={handleDownloadExcel}
                    className="nav-btn px-8"
                  >
                    📥 Download Excel Report
                  </button>
                </div>
              </div>
            )}

            {!reportData && !reportLoading && (
              <div className="text-center py-8 text-gray-500">
                Select country, year, and quarter, then click "Generate Report" to view the data.
              </div>
            )}
          </div>
        </section>
      )}

      {showFreedomSection && (
        <section className="mb-6">
          <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Species</label>
                <select
                  value={freedomSpecies}
                  onChange={(e) => setFreedomSpecies(e.target.value)}
                  className="px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="ALL">All species</option>
                  <option value="LR">Large ruminants</option>
                  <option value="BOV">Cattle</option>
                  <option value="BUF">Buffalo</option>
                  <option value="SR">Small ruminants</option>
                  <option value="OVI">Sheep</option>
                  <option value="CAP">Goat</option>
                  <option value="POR">Pig</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Disease</label>
                <select
                  value={freedomDisease}
                  onChange={(e) => setFreedomDisease(e.target.value)}
                  className="px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="FMD">FMD</option>
                  <option value="LSD">LSD</option>
                  <option value="SGP">SGP</option>
                  <option value="PPR">PPR</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                <select
                  value={freedomRegion}
                  onChange={(e) => setFreedomRegion(e.target.value)}
                  className="px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="ALL">All</option>
                  <option value="BG">Bulgaria</option>
                  <option value="GR">Greece</option>
                  <option value="TK">Türkiye</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  className="nav-btn"
                  onClick={() => fetchFreedomData(false)}
                  disabled={freedomLoading}
                >
                  {freedomLoading ? 'Loading...' : 'Load analysis'}
                </button>
              </div>
            </div>

            {freedomError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">
                {freedomError}
              </div>
            )}

            {freedomData ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                  <span>P(free) last: {Number(freedomData.pfree?.slice(-1)?.[0] || 0).toFixed(3)}</span>
                  <span>Sensitivity last: {Number(freedomData.sens?.slice(-1)?.[0] || 0).toFixed(3)}</span>
                  <span>P(introduction) last: {Number(freedomData.pintro?.slice(-1)?.[0] || 0).toFixed(3)}</span>
                </div>
                <div ref={freedomChartRef} style={{ width: '100%', height: '80vh' }} />
              </div>
            ) : (
              !freedomLoading && (
                <div className="text-gray-500">Select filters and load the analysis.</div>
              )
            )}
          </div>
        </section>
      )}

      {/* Template Selection Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Select Template to Download</h2>
            <div className="space-y-3">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleDownloadTemplate(template)}
                  className="nav-btn w-full"
                >
                  {template.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowTemplateModal(false)}
              className="w-full mt-4 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded-lg transition duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Data Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Upload Surveillance Data</h2>
            
            {!uploadSuccess ? (
              <>
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                  Select your filled Excel template to upload surveillance data
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Excel File (.xlsx)
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx"
                    onChange={handleFileSelect}
                    disabled={uploadLoading}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-green-50 file:text-green-700
                      hover:file:bg-green-100"
                  />
                </div>

                {uploadMessage && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
                    {uploadMessage}
                  </div>
                )}

                {uploadErrors.length > 0 && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                    <p className="text-sm font-semibold text-red-700 mb-2">Validation Errors:</p>
                    <ul className="text-xs text-red-600 space-y-1 max-h-64 overflow-y-auto">
                      {uploadErrors.map((error, idx) => (
                        <li key={idx} className="list-disc list-inside">
                          {typeof error === 'string' ? error : JSON.stringify(error)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {dataValidationErrors.length > 0 && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <button
                      type="button"
                      onClick={() => setShowErrorDetails(!showErrorDetails)}
                      className="text-sm font-semibold text-yellow-700 hover:text-yellow-800 w-full text-left"
                    >
                      {showErrorDetails ? '▼' : '▶'} View {dataValidationErrors.length} Data Validation Issues
                    </button>
                    {showErrorDetails && (
                      <div className="mt-3 max-h-80 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-yellow-300">
                              <th className="text-left py-2 px-2">Village</th>
                              <th className="text-left py-2 px-2">Country</th>
                              <th className="text-left py-2 px-2">Date</th>
                              <th className="text-left py-2 px-2">Error</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dataValidationErrors.map((errorRow, idx) => (
                              <tr key={idx} className="border-b border-yellow-200 hover:bg-yellow-100">
                                <td className="py-2 px-2">{errorRow.village}</td>
                                <td className="py-2 px-2">{errorRow.country}</td>
                                <td className="py-2 px-2">{errorRow.date}</td>
                                <td className="py-2 px-2 text-red-600 font-semibold">{errorRow.error}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {uploadLoading && (
                  <div className="mb-4 text-center">
                    <div className="inline-block animate-spin">
                      <div className="h-4 w-4 border-2 border-green-500 border-t-transparent rounded-full"></div>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">Processing file...</p>
                  </div>
                )}
              </>
            ) : (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
                <p className="text-sm font-semibold text-green-700">✓ {uploadMessage}</p>
                <p className="text-xs text-green-600 mt-2">Your data has been successfully imported and is now available in the system.</p>
              </div>
            )}

            <button
              onClick={() => setShowUploadModal(false)}
              disabled={uploadLoading}
              className="w-full mt-4 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50"
            >
              {uploadSuccess ? 'Done' : 'Cancel'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Thrace;
