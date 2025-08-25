import React, { useState, useEffect } from 'react';
import RispNavBar from '../components/RISP/RispNavBar';
import { apiService } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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

// Format array data for display
const formatArrayData = (data: any): string => {
  const parsed = safeParseData(data, []);
  if (Array.isArray(parsed)) {
    return parsed.join(', ') || 'N/A';
  }
  return String(parsed) || 'N/A';
};

const RISPSummary: React.FC = () => {
  const { user } = useAuthStore();
  
  // Get current year and quarter
  const currentYear = new Date().getFullYear();
  const currentQuarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;
  
  const [outbreakData, setOutbreakData] = useState<any[]>([]);
  const [surveillanceData, setSurveillanceData] = useState<any[]>([]);
  const [vaccinationData, setVaccinationData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadSummaryData = async () => {
      if (!user?.country) return;
      
      setLoading(true);
      try {
        const currentYear = new Date().getFullYear();
        const currentQuarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;

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

        // Load vaccination data
        const vaccinationResponse = await apiService.risp.getRISPVaccinations(currentYear.toString());
        
        // Filter campaigns that have data for current quarter
        const currentQuarterNum = Math.ceil((new Date().getMonth() + 1) / 3);
        const campaignsWithCurrentData = (vaccinationResponse.data || []).filter((campaign: any) => {
          const quarterField = `q${currentQuarterNum}`;
          return campaign[quarterField] && campaign[quarterField] > 0;
        });

        setOutbreakData(parsedOutbreaks);
        setSurveillanceData(parsedSurveillance);
        setVaccinationData(campaignsWithCurrentData);
      } catch (error) {
        console.error('Error loading summary data:', error);
        // Set empty arrays on error to prevent crashes
        setOutbreakData([]);
        setSurveillanceData([]);
        setVaccinationData([]);
      } finally {
        setLoading(false);
      }
    };

    loadSummaryData();
  }, [user?.country]);

  const handlePrint = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.text('RISP Summary Report', 20, 20);
    
    // Add subtitle with quarter and year
    doc.setFontSize(14);
    doc.text(`${currentQuarter} ${currentYear} - ${user?.country || 'Unknown Country'}`, 20, 35);
    
    let yPosition = 50;
    
    // Outbreak Data Table
    if (outbreakData.length > 0) {
      doc.setFontSize(16);
      doc.text('Outbreak Data', 20, yPosition);
      yPosition += 10;
      
      const outbreakRows = outbreakData.map(outbreak => [
        outbreak.disease_name || 'N/A',
        String(outbreak.number_outbreaks || 0),
        formatArrayData(outbreak.species),
        formatArrayData(outbreak.status),
        formatArrayData(outbreak.locations)
      ]);
      
      (doc as any).autoTable({
        head: [['Disease', 'Outbreaks', 'Species', 'Status', 'Locations']],
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
        surveillance.disease_name || 'N/A',
        surveillance.passive_surveillance ? 'Yes' : 'No',
        formatActiveSurveillance(surveillance.active_surveillance),
        surveillance.details || 'N/A'
      ]);
      
      (doc as any).autoTable({
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
        vaccination.disease_name || 'N/A',
        vaccination.vaccination_type || 'N/A',
        formatArrayData(vaccination.species),
        formatArrayData(vaccination.geographical_areas),
        String(vaccination[currentQuarter.toLowerCase()] || 0)
      ]);
      
      (doc as any).autoTable({
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
                      <td className="py-2 px-4 border border-gray-300">{outbreak.disease_name}</td>
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
                      <td className="py-2 px-4 border border-gray-300">{surveillance.disease_name}</td>
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
                      <td className="py-2 px-4 border border-gray-300">{vaccination.disease_name || 'N/A'}</td>
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
