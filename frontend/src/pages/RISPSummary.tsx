import React, { useState, useEffect } from 'react';
import RispNavBar from '../components/RISP/RispNavBar';
import { apiService } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { diseaseOptions } from '../services/risp/rispService';

// Comprehensive safe parsing function
const safeParseData = (data: any, fallback: any = []): any => {
  if (!data) return fallback;
  
  // If it's already an array or object, return it
  if (Array.isArray(data) || (typeof data === 'object' && data !== null)) {
    return data;
  }
  
  // If it's a string, try different parsing approaches
  if (typeof data === 'string') {
    // If it's already comma-separated values, split them
    if (data.includes(',') && !data.trim().startsWith('[') && !data.trim().startsWith('{')) {
      return data.split(',').map(item => item.trim()).filter(item => item.length > 0);
    }
    
    // Try JSON parsing
    try {
      const parsed = JSON.parse(data);
      return parsed;
    } catch {
      // If JSON parsing fails, return as single item array or the fallback
      return data.trim() ? [data.trim()] : fallback;
    }
  }
  
  return fallback;
};

// Function to normalize disease names to avoid duplicates
const normalizeDiseaseNames = (diseaseNamesList: any[]) => {
  return diseaseNamesList.map(item => {
    let normalizedName = item.disease_name;
    
    // Normalize FMD variations
    if (normalizedName) {
      if (normalizedName.toLowerCase().includes('foot and mouth') || 
          normalizedName.toLowerCase() === 'fmd' ||
          normalizedName.toLowerCase().includes('foot-and-mouth')) {
        normalizedName = 'Foot and Mouth Disease';
      }
    }
    
    return {
      ...item,
      disease_name: normalizedName
    };
  });
};

// Function to merge duplicate diseases (same normalized name)
const mergeDuplicateDiseases = (data: any[]) => {
  const diseaseMap = new Map();
  
  data.forEach(item => {
    const key = item.disease_name;
    if (diseaseMap.has(key)) {
      // Merge data - keep first entry but combine any relevant fields
      const existing = diseaseMap.get(key);
      // For surveillance, we can merge details if they're different
      if (item.details && existing.details && item.details !== existing.details) {
        existing.details = `${existing.details}; ${item.details}`;
      }
    } else {
      diseaseMap.set(key, { ...item });
    }
  });
  
  return Array.from(diseaseMap.values());
};

// Format array data for display
const formatArrayData = (data: any): string => {
  const parsed = safeParseData(data, []);
  if (Array.isArray(parsed)) {
    return parsed.join(', ') || 'N/A';
  }
  return String(parsed) || 'N/A';
};

// Utility to get full display name from diseaseOptions
const getDiseaseDisplayName = (diseaseName: string): string => {
  const found = diseaseOptions.find(opt =>
    diseaseName && (diseaseName.toLowerCase().includes(opt.name.split(' - ')[1]?.toLowerCase() || '') ||
    opt.name.toLowerCase().includes(diseaseName.toLowerCase()))
  );
  return found ? found.name : diseaseName;
};

const RISPSummary: React.FC = () => {
  const { user } = useAuthStore();
  
  // Helper function to get previous quarter and year (same as outbreak and surveillance)
  const getPreviousQuarterAndYear = () => {
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const currentQuarter = Math.ceil(currentMonth / 3); // 1-4
    const currentYear = new Date().getFullYear();
    
    if (currentQuarter === 1) {
      // If current quarter is Q1, previous quarter is Q4 of previous year
      return {
        quarter: 'Q4',
        year: String(currentYear - 1)
      };
    } else {
      // Otherwise, previous quarter is in the same year
      return {
        quarter: `Q${currentQuarter - 1}`,
        year: String(currentYear)
      };
    }
  };

  const previousPeriod = getPreviousQuarterAndYear();
  
  // Use previous quarter and year instead of current
  const currentYear = parseInt(previousPeriod.year);
  const currentQuarter = previousPeriod.quarter;
  
  const [outbreakData, setOutbreakData] = useState<any[]>([]);
  const [surveillanceData, setSurveillanceData] = useState<any[]>([]);
  const [vaccinationData, setVaccinationData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadSummaryData = async () => {
      if (!user?.country) return;
      
      setLoading(true);
      try {
        // Use the same previous quarter logic as other RISP pages
        // Load outbreak data using the correct API
        const outbreakResponse = await apiService.risp.getOutbreaks(currentYear, currentQuarter);
        
        // Parse outbreak data safely
        const parsedOutbreaks = (outbreakResponse.data || []).map((item: any) => {
          return {
            ...item,
            locations: safeParseData(item.locations, []),
            status: safeParseData(item.status, []),
            serotype: safeParseData(item.serotype, []),
            species: safeParseData(item.species, []),
            control_measures: safeParseData(item.control_measures, [])
          };
        });

        // Load surveillance data using the correct API
        const surveillanceResponse = await apiService.risp.getRISP({
          type: "surveillance",
          year: currentYear.toString(),
          quarter: currentQuarter
        });

        // Parse surveillance data safely
        const parsedSurveillance = (surveillanceResponse.data || []).map((item: any) => {
          return {
            ...item,
            active_surveillance: safeParseData(item.active_surveillance, [])
          };
        });

        // Normalize and merge duplicate disease names in surveillance data
        const normalizedSurveillance = normalizeDiseaseNames(parsedSurveillance);
        const mergedSurveillance = mergeDuplicateDiseases(normalizedSurveillance);

        // Load vaccination data
        const vaccinationResponse = await apiService.risp.getRISPVaccinations(currentYear.toString());
        
        // Filter campaigns that have data for the selected quarter (previous quarter)
        const quarterNum = parseInt(currentQuarter.substring(1)); // Extract number from Q1, Q2, etc.
        const campaignsWithCurrentData = (vaccinationResponse.data || []).filter((campaign: any) => {
          const quarterField = `q${quarterNum}`;
          return campaign[quarterField] && campaign[quarterField] > 0;
        });

        setOutbreakData(parsedOutbreaks);
        setSurveillanceData(mergedSurveillance);
        setVaccinationData(campaignsWithCurrentData);
      } catch (error) {
        console.error('Error loading summary data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSummaryData();
  }, [user?.country, currentYear, currentQuarter]);

  // PDF generation logic
  const handlePrint = () => {
    const doc = new jsPDF('p', 'pt');
    doc.setFont('Helvetica', 'normal');
    
    let yPosition = 40;
    
    // Title
    doc.setFontSize(22);
    doc.text('RISP Summary Report', 20, yPosition);
    yPosition += 30;
    
    // Country and Period
    doc.setFontSize(12);
    doc.text(`Country: ${user?.country || ''}`, 20, yPosition);
    yPosition += 15;
    doc.text(`Period: ${currentQuarter} ${currentYear}`, 20, yPosition);
    yPosition += 20;
    
    // Outbreak Data Table
    if (outbreakData.length > 0) {
      doc.setFontSize(16);
      doc.text('Disease Outbreaks', 20, yPosition);
      yPosition += 10;
      
      const outbreakRows = outbreakData.map(outbreak => [
        getDiseaseDisplayName(outbreak.disease_name),
        outbreak.number_outbreaks,
        formatArrayData(outbreak.species),
        formatArrayData(outbreak.status),
        formatArrayData(outbreak.locations)
      ]);
      
      autoTable(doc, {
        head: [['Disease', 'Number of Outbreaks', 'Species', 'Status', 'Locations']],
        body: outbreakRows,
        startY: yPosition,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [21, 115, 109] }
      });
      
      yPosition = (doc as any).lastAutoTable.finalY + 20;
    }
    
    // Surveillance Data Table
    if (surveillanceData.length > 0) {
      doc.setFontSize(16);
      doc.text('Surveillance Data', 20, yPosition);
      yPosition += 10;
      
      const surveillanceRows = surveillanceData.map(surveillance => [
        getDiseaseDisplayName(surveillance.disease_name),
        surveillance.passive_surveillance ? 'Yes' : 'No',
        formatActiveSurveillance(surveillance.active_surveillance),
        surveillance.details || 'N/A'
      ]);
      
      autoTable(doc, {
        head: [['Disease', 'Passive Surveillance', 'Active Surveillance', 'Details']],
        body: surveillanceRows,
        startY: yPosition,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [21, 115, 109] }
      });
      
      yPosition = (doc as any).lastAutoTable.finalY + 20;
    }
    
    // Vaccination Data Table
    if (vaccinationData.length > 0) {
      doc.setFontSize(16);
      doc.text('Vaccination Campaigns', 20, yPosition);
      yPosition += 10;
      
      const vaccinationRows = vaccinationData.map(vaccination => [
        getDiseaseDisplayName(vaccination.disease_name) || 'N/A',
        vaccination.vaccination_type || 'N/A',
        formatArrayData(vaccination.species),
        formatArrayData(vaccination.geographical_areas),
        String(vaccination[currentQuarter.toLowerCase()] || 0)
      ]);
      
      autoTable(doc, {
        head: [['Disease', 'Vaccination Type', 'Species', 'Geographical Areas', `Animals Vaccinated (${currentQuarter})`]],
        body: vaccinationRows,
        startY: yPosition,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [21, 115, 109] }
      });
    }
    
    // Save the PDF
    doc.save(`RISP_Summary_${currentQuarter}_${currentYear}_${user?.country || 'Report'}.pdf`);
  };

  const formatActiveSurveillance = (activeSurveillanceData: any) => {
    const parsed = safeParseData(activeSurveillanceData, []);
    if (Array.isArray(parsed)) {
      return parsed.join(', ') || 'None';
    }
    return String(parsed) || 'None';
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4">
        <RispNavBar />
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Loading summary data...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>
        {`
          @media print {
            .no-print { display: none !important; }
            .print-page { page-break-after: always; }
            body { -webkit-print-color-adjust: exact; }
          }
        `}
      </style>
      <div className="container mx-auto px-4">
        <div className="no-print">
          <RispNavBar />
        </div>
        
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-center mb-2">RISP Summary Report</h1>
          <p className="text-center text-gray-600 mb-1">
            Country: <strong>{user?.country}</strong>
          </p>
          <p className="text-center text-gray-600">
            Period: <strong>{currentQuarter} {currentYear}</strong>
          </p>
        </div>

        {/* Outbreak Data Table */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4" style={{ color: '#15736d' }}>
            Disease Outbreaks
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border border-white bg-white tracking-wider text-sm">
              <thead>
                <tr className="text-white text-sm font-medium" style={{ backgroundColor: '#15736d' }}>
                  <th className="py-2 px-4 border border-white text-left">Disease</th>
                  <th className="py-2 px-4 border border-white text-left">Number of Outbreaks</th>
                  <th className="py-2 px-4 border border-white text-left">Species</th>
                  <th className="py-2 px-4 border border-white text-left">Status</th>
                  <th className="py-2 px-4 border border-white text-left">Locations</th>
                </tr>
              </thead>
              <tbody>
                {outbreakData.length > 0 ? (
                  outbreakData.map((outbreak, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="py-2 px-4 border border-gray-300">{getDiseaseDisplayName(outbreak.disease_name)}</td>
                      <td className="py-2 px-4 border border-gray-300">{outbreak.number_outbreaks}</td>
                      <td className="py-2 px-4 border border-gray-300">
                        {formatArrayData(outbreak.species)}
                      </td>
                      <td className="py-2 px-4 border border-gray-300">
                        {formatArrayData(outbreak.status)}
                      </td>
                      <td className="py-2 px-4 border border-gray-300">
                        {formatArrayData(outbreak.locations)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 px-4 text-center text-gray-500">
                      No outbreak data for {currentQuarter} {currentYear}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Surveillance Data Table */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4" style={{ color: '#15736d' }}>
            Surveillance Activities
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border border-white bg-white tracking-wider text-sm">
              <thead>
                <tr className="text-white text-sm font-medium" style={{ backgroundColor: '#15736d' }}>
                  <th className="py-2 px-4 border border-white text-left">Disease</th>
                  <th className="py-2 px-4 border border-white text-left">Passive Surveillance</th>
                  <th className="py-2 px-4 border border-white text-left">Active Surveillance</th>
                  <th className="py-2 px-4 border border-white text-left">Details</th>
                </tr>
              </thead>
              <tbody>
                {surveillanceData.length > 0 ? (
                  surveillanceData.map((surveillance, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="py-2 px-4 border border-gray-300">{getDiseaseDisplayName(surveillance.disease_name)}</td>
                      <td className="py-2 px-4 border border-gray-300">
                        {Number(surveillance.passive_surveillance) === 1 ? 'Yes' : 'No'}
                      </td>
                      <td className="py-2 px-4 border border-gray-300">
                        {formatActiveSurveillance(surveillance.active_surveillance)}
                      </td>
                      <td className="py-2 px-4 border border-gray-300">
                        {surveillance.details || surveillance.additional_info || 'N/A'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-4 px-4 text-center text-gray-500">
                      No surveillance data for {currentQuarter} {currentYear}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Vaccination Data Table */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4" style={{ color: '#15736d' }}>
            Vaccination Campaigns
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border border-white bg-white tracking-wider text-sm">
              <thead>
                <tr className="text-white text-sm font-medium" style={{ backgroundColor: '#15736d' }}>
                  <th className="py-2 px-4 border border-white text-left">Disease</th>
                  <th className="py-2 px-4 border border-white text-left">Vaccination Type</th>
                  <th className="py-2 px-4 border border-white text-left">Species</th>
                  <th className="py-2 px-4 border border-white text-left">Geographical Areas</th>
                  <th className="py-2 px-4 border border-white text-left">Animals Vaccinated ({currentQuarter})</th>
                </tr>
              </thead>
              <tbody>
                {vaccinationData.length > 0 ? (
                  vaccinationData.map((vaccination, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="py-2 px-4 border border-gray-300">{getDiseaseDisplayName(vaccination.disease_name) || 'N/A'}</td>
                      <td className="py-2 px-4 border border-gray-300">{vaccination.vaccination_type || 'N/A'}</td>
                      <td className="py-2 px-4 border border-gray-300">
                        {formatArrayData(vaccination.species)}
                      </td>
                      <td className="py-2 px-4 border border-gray-300">
                        {formatArrayData(vaccination.geographical_areas)}
                      </td>
                      <td className="py-2 px-4 border border-gray-300">
                        {vaccination[currentQuarter.toLowerCase()] || 0}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 px-4 text-center text-gray-500">
                      No vaccination data for {currentQuarter} {currentYear}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Print Button */}
        <div className="flex justify-center mb-8 no-print">
          <button
            onClick={handlePrint}
            className="px-6 py-3 text-white rounded-lg font-medium"
            style={{ backgroundColor: '#15736d' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0f5b57')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#15736d')}
          >
            📄 Print / Download PDF
          </button>
        </div>
      </div>
    </>
  );
};

export default RISPSummary;
