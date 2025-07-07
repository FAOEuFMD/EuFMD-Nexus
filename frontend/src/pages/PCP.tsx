import React, { useState, useEffect, useMemo } from 'react';
import { AddPCP } from '../components/PCP';
import { pcpService } from '../services';
import { PCPEntry } from '../types';

const PCP: React.FC = () => {
  const [pcp, setPcp] = useState<PCPEntry[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [pcpStages, setPcpStages] = useState<string[]>([]);
  const [psoSupport, setPsoSupport] = useState<string[]>([]);
  
  // Filter states
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [selectedPSO, setSelectedPSO] = useState<string | null>(null);

  const getPCP = async () => {
    try {
      const data = await pcpService.getAllPCP();
      console.log("checking procs", data);
      console.log("Sample entry:", data[0]);
      console.log("Available keys:", data[0] ? Object.keys(data[0]) : 'No data');
      
      setPcp([...data]);
      console.log("here is the pcp", data);
      
      // Extract unique regions (RMM)
      const regionsArray = data.map((obj) => obj.RMM).filter(Boolean) as string[];
      console.log("Regions extracted:", regionsArray);
      const uniqueRegions = new Set(regionsArray);
      setRegions(Array.from(uniqueRegions).sort());
      
      // Extract unique countries
      const countriesArray = data.map((obj) => obj.Country);
      const uniqueCountries = new Set(countriesArray);
      setCountries(Array.from(uniqueCountries).sort());
      
      // Extract unique PCP stages (filter out empty/null stages)
      const pcpStageArray = data
        .filter((obj) => obj.PCP_Stage && obj.PCP_Stage.replace(/\s/g, "") !== "")
        .map((obj) => obj.PCP_Stage!);
      const uniqueStages = new Set(pcpStageArray);
      setPcpStages(Array.from(uniqueStages));
      
      // Extract unique PSO support values
      const psoArray = data.map((obj) => obj.PSO_support).filter(Boolean) as string[];
      console.log("PSO support values extracted:", psoArray);
      console.log("PSO support unique values:", Array.from(new Set(psoArray)));
      const uniquePSO = new Set(psoArray);
      setPsoSupport(Array.from(uniquePSO).sort());
      
    } catch (error) {
      console.error("Error fetching PCP data:", error);
    }
  };

  const forceRerender = () => {
    getPCP();
  };

  const clearAllFilters = () => {
    setSelectedRegion(null);
    setSelectedCountry(null);
    setSelectedYear(null);
    setSelectedStage(null);
    setSelectedPSO(null);
  };

  // Filtered PCP data (equivalent to pcpFiltered computed property in Vue)
  const pcpFiltered = useMemo(() => {
    if (!pcp || !pcp.length) return [];
    
    let filtered = pcp.filter((pcpData) => {
      const regionTrue = selectedRegion ? pcpData.RMM === selectedRegion : true;
      const countryTrue = selectedCountry ? pcpData.Country === selectedCountry : true;
      const yearTrue = selectedYear ? pcpData.Year === selectedYear : true;
      const stageTrue = selectedStage ? pcpData.PCP_Stage === selectedStage : true;
      const psoTrue = selectedPSO ? pcpData.PSO_support === selectedPSO : true;
      
      return regionTrue && countryTrue && yearTrue && stageTrue && psoTrue;
    });

    // Sort by country first, then by year
    filtered.sort((a, b) => {
      if (a.Country < b.Country) return -1;
      if (a.Country > b.Country) return 1;
      return a.Year - b.Year;
    });

    return filtered;
  }, [pcp, selectedRegion, selectedCountry, selectedYear, selectedStage, selectedPSO]);

  // Filtered countries based on selected region (equivalent to filteredCountries computed property)
  const filteredCountries = useMemo(() => {
    if (!pcp || !pcp.length) return [];
    
    if (selectedRegion) {
      return pcp
        .filter((pcpData) => pcpData.RMM === selectedRegion)
        .map((pcpData) => pcpData.Country)
        .filter((value, index, self) => self.indexOf(value) === index) // Remove duplicates
        .sort();
    } else {
      return countries;
    }
  }, [pcp, selectedRegion, countries]);

  useEffect(() => {
    getPCP();
  }, []);

  return (
    <div className="container py-5 text-gray-800">
      <h1 className="font-black capitalize text-2xl my-3">PCP FMD</h1>
      
      <AddPCP
        regions={regions}
        countries={filteredCountries}
        pcpStages={pcpStages}
        psoSupport={psoSupport}
        onRegionSelected={setSelectedRegion}
        onCountrySelected={setSelectedCountry}
        onYearSelected={setSelectedYear}
        onStageSelected={setSelectedStage}
        onPSOSelected={setSelectedPSO}
        onClearFilters={clearAllFilters}
        onForceRerender={forceRerender}
        filteredCountries={filteredCountries}
      />
      
      {/* {loading && <div>Loading...</div>} */}
      
      <div className="flex justify-around">
        {pcpFiltered.length > 0 ? (
          <table className="w-full border bg-white text-center">
            <thead>
              <tr className="bg-green-greenMain text-white text-md">
                <th className="px-5 py-1 text-left">Roadmap Region</th>
                <th className="p-1">Country</th>
                <th className="p-1">Year</th>
                <th className="p-1">PCP-FMD Stage</th>
                <th className="p-1">Date of Last Meeting Attended</th>
                <th className="p-1">PSO support</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pcpFiltered.map((proc, index) => (
                <tr key={proc.id || `${proc.Country}-${proc.Year}-${index}`}>
                  <td className="px-5 py-1 text-left cursor-pointer">
                    {proc.RMM}
                  </td>
                  <td className="px-5 py-3">
                    {proc.Country}
                  </td>
                  <td className="px-5 py-3">
                    {proc.Year}
                  </td>
                  <td className="px-5 py-3">
                    {proc.PCP_Stage}
                  </td>
                  <td className="px-5 py-3">
                    {proc.Last_meeting_attended}
                  </td>
                  <td className="px-5 py-3">
                    {proc.PSO_support}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center text-large font-bold uppercase p-4">
            No PCP to display
          </div>
        )}
      </div>
    </div>
  );
};

export default PCP;
