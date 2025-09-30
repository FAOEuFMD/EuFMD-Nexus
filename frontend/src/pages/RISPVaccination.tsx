import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import RispNavBar from '../components/RISP/RispNavBar';
import MultipleSelectOptions from '../components/RISP/MultipleSelectOptions';
import HierarchicalSpeciesSelector from '../components/RISP/HierarchicalSpeciesSelector';
import { apiService } from '../services/api';
import { diseaseOptions, rispService } from '../services/risp/rispService';

interface VaccinationCampaign {
  id?: number | null;
  diseaseId?: number;
  diseaseName: string;
  year: string;
  country: string;
  status: string;
  vaccinationType: string; // Used locally
  strategy: string; // For API compatibility
  geographicalAreas: string[];
  regionDetails: string;
  species: string[]; // Used locally
  speciesTargeted: string[]; // For API compatibility
  serotypesIncluded: string[];
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  total: number;
  coverage: number | string;
  vaccineDetails: string; // Used locally
  supplier: string; // For API compatibility
  vaccinationRegime: string;
  comments: string;
}

const RISPVaccination: React.FC = () => {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  
  // State
  const [campaigns, setCampaigns] = useState<VaccinationCampaign[]>([]);
  const [userCountry, setUserCountry] = useState('');
  const [dropdowns, setDropdowns] = useState<Record<number, Record<string, boolean>>>({});
  const [tooltipOpen, setTooltipOpen] = useState<Record<number, boolean>>({});
  const [coverageTooltipOpen, setCoverageTooltipOpen] = useState(false);
  const [q1TooltipOpen, setQ1TooltipOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Location options - specific for vaccination (only National and Specify region)
  const locationOptions = [
    "National",
    "Specify region"
  ];

  // Years for dropdown
  const years = useMemo(() => {
    const yearsList = [];
    for (let year = 2024; year <= 2034; year++) {
      yearsList.push(year.toString());
    }
    return yearsList;
  }, []);

  // Load user profile and campaigns on component mount
  useEffect(() => {
    const loadData = async () => {
      await fetchUserProfile();
      await fetchCampaigns();
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch user profile
  const fetchUserProfile = async () => {
    try {
      const response = await apiService.auth.getProfile();
      // Assuming the API returns data in an object with a data property
      const profile = response.data || response;
      setUserCountry(profile?.country || '');
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  // Fetch campaigns
  const fetchCampaigns = async () => {
    try {
      const response = await rispService.getVaccinations(currentYear.toString());
      
      if (response.data && response.data.length > 0) {
        const mappedCampaigns = response.data.map((campaign: any) => ({
          id: campaign.id,
          diseaseId: campaign.diseaseId,
          diseaseName: campaign.disease_name || '',
          year: campaign.year || currentYear.toString(),
          country: campaign.country || userCountry,
          status: campaign.status || '',
          vaccinationType: campaign.vaccination_type || '',
          strategy: campaign.vaccination_type || '',
          geographicalAreas: Array.isArray(campaign.geographical_areas) ? campaign.geographical_areas : [],
          regionDetails: campaign.regionDetails || '',
          species: Array.isArray(campaign.species) ? campaign.species : [],
          speciesTargeted: Array.isArray(campaign.species) ? campaign.species : [],
          serotypesIncluded: campaign.serotypesIncluded || [],
          q1: Number(campaign.q1) || 0,
          q2: Number(campaign.q2) || 0,
          q3: Number(campaign.q3) || 0,
          q4: Number(campaign.q4) || 0,
          total: Number(campaign.total) || 0,
          coverage: Number(campaign.coverage) || 0,
          vaccineDetails: campaign.vaccine_details || '',
          supplier: campaign.vaccine_details || '',
          vaccinationRegime: campaign.vaccinationRegime || '',
          comments: campaign.comments || ''
        }));
        
        setCampaigns(mappedCampaigns);
        
        // Initialize dropdown state for all loaded campaigns
        const initialDropdowns: Record<number, Record<string, boolean>> = {};
        mappedCampaigns.forEach((_: any, index: number) => {
          initialDropdowns[index] = {};
        });
        setDropdowns(initialDropdowns);
      } else {
        console.log('No vaccination campaigns found, adding empty campaign');
        addCampaign();
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      addCampaign();
    }
  };

  // Create empty campaign
  const createEmptyCampaign = (): VaccinationCampaign => ({
    id: null,
    diseaseId: undefined,
    diseaseName: "",
    year: currentYear.toString(),
    country: userCountry,
    status: "",
    vaccinationType: "",
    strategy: "",
    geographicalAreas: [],
    regionDetails: "",
    species: [],
    speciesTargeted: [],
    serotypesIncluded: [],
    q1: 0,
    q2: 0,
    q3: 0,
    q4: 0,
    total: 0,
    coverage: 0,
    vaccineDetails: "",
    supplier: "",
    vaccinationRegime: "",
    comments: ""
  });

  // Add new campaign
  const addCampaign = () => {
    try {
      const newCampaignIndex = campaigns.length;
      setCampaigns([...campaigns, createEmptyCampaign()]);
      
      // Initialize dropdown state for the new campaign
      setDropdowns(prev => ({
        ...prev,
        [newCampaignIndex]: {}
      }));
    } catch (error) {
      console.error('Error adding campaign:', error);
      alert('Failed to add new campaign. Please try again.');
    }
  };

  // Save or Update campaign
  const updateCampaign = async (index: number) => {
    try {
      const campaign = campaigns[index];
      
      // Basic validation
      if (!campaign.diseaseName || !campaign.year) {
        alert('Please fill in at least Disease Name and Year before saving.');
        return;
      }

      // Calculate total before saving
      const updatedCampaign = { ...campaign };
      updatedCampaign.total = calculateTotal(updatedCampaign);

      // Map our internal model to the API expected model
      const formattedCampaign = {
        id: campaign.id === null ? undefined : campaign.id,
        disease_name: campaign.diseaseName,
        year: campaign.year,
        country: userCountry,
        status: campaign.status,
        vaccination_type: campaign.vaccinationType,
        geographical_areas: campaign.geographicalAreas,
        species: campaign.species,
        vaccine_details: campaign.vaccineDetails,
        q1: Number(campaign.q1) || 0,
        q2: Number(campaign.q2) || 0,
        q3: Number(campaign.q3) || 0,
        q4: Number(campaign.q4) || 0,
        total: calculateTotal(updatedCampaign),
        coverage: Number(campaign.coverage) || 0
      };

      let result;
      if (campaign.id) {
        // Update existing campaign
        result = await rispService.updateVaccination(campaign.id, formattedCampaign as any);
      } else {
        // Create new campaign
        result = await rispService.saveVaccination(formattedCampaign as any);
      }
      
      if (result?.success) {
        const actionText = campaign.id ? 'updated' : 'saved';
        alert(`Vaccination campaign ${actionText} successfully!`);
        // Refresh the campaigns list to get updated data
        await fetchCampaigns();
      } else {
        throw new Error('Failed to save vaccination data');
      }
    } catch (error) {
      console.error("Error saving vaccination campaign:", error);
      alert("Error saving vaccination campaign. Please try again.");
    }
  };

  // Toggle dropdown
  const toggleDropdown = (index: number, type: string) => {
    setDropdowns(prev => {
      const newDropdowns = { ...prev };
      
      // Close all dropdowns first
      Object.keys(newDropdowns).forEach(idx => {
        newDropdowns[parseInt(idx)] = {};
      });
      
      // Initialize if not exists
      if (!newDropdowns[index]) {
        newDropdowns[index] = {};
      }
      
      // Get current state from the original prev state (before we closed everything)
      const currentState = prev[index]?.[type] || false;
      
      // Toggle this dropdown - if it was closed, open it; if it was open, keep it closed
      newDropdowns[index][type] = !currentState;
      
      return newDropdowns;
    });
  };

  // Close dropdown
  const closeDropdown = (index: number, type: string) => {
    setDropdowns(prev => {
      if (!prev[index]) return prev;
      
      const newDropdowns = { ...prev };
      newDropdowns[index] = { ...newDropdowns[index], [type]: false };
      return newDropdowns;
    });
  };

  // Format list for display
  const formatList = (items: string[], placeholder = 'Select items...') => {
    return Array.isArray(items) && items.length > 0 
      ? items.join(', ') 
      : placeholder;
  };

  // Handle field update
  const handleFieldUpdate = (index: number, field: string, value: any) => {
    try {
      setCampaigns(prev => {
        const updatedCampaigns = [...prev];
        const campaign = { ...updatedCampaigns[index] };
        
        if (field === 'diseaseName') {
          campaign.diseaseName = value;
          // Note: Species are no longer filtered by disease with hierarchical selector
        } else if (['q1', 'q2', 'q3', 'q4', 'coverage'].includes(field)) {
          const num = Number(value);
          // Validate number input
          if (isNaN(num) || num < 0) {
            if (field === 'q1') campaign.q1 = 0;
            else if (field === 'q2') campaign.q2 = 0;
            else if (field === 'q3') campaign.q3 = 0;
            else if (field === 'q4') campaign.q4 = 0;
            else if (field === 'coverage') campaign.coverage = 0;
          } else if (field === 'coverage' && num > 100) {
            campaign.coverage = 100;
          } else {
            // Apply the value with proper typing
            if (field === 'q1') campaign.q1 = Math.floor(num);
            else if (field === 'q2') campaign.q2 = Math.floor(num);
            else if (field === 'q3') campaign.q3 = Math.floor(num);
            else if (field === 'q4') campaign.q4 = Math.floor(num);
            else if (field === 'coverage') campaign.coverage = Math.floor(num);
          }
          
          // Update total after Q changes
          if (['q1', 'q2', 'q3', 'q4'].includes(field)) {
            campaign.total = calculateTotal(campaign);
          }
        } else if (field === 'species') {
          campaign.species = value;
        } else if (field === 'geographicalAreas') {
          campaign.geographicalAreas = value;
        } else if (field === 'diseaseName') {
          campaign.diseaseName = value;
        } else if (field === 'year') {
          campaign.year = value;
        } else if (field === 'status') {
          campaign.status = value;
        } else if (field === 'vaccinationType') {
          campaign.vaccinationType = value;
        } else if (field === 'regionDetails') {
          campaign.regionDetails = value;
        } else if (field === 'vaccineDetails') {
          campaign.vaccineDetails = value;
        } else if (field === 'comments') {
          campaign.comments = value;
        }
        
        updatedCampaigns[index] = campaign;
        return updatedCampaigns;
      });
    } catch (error) {
      console.error('Error updating field:', error);
    }
  };

  // Calculate total vaccinated
  const calculateTotal = (campaign: VaccinationCampaign): number => {
    try {
      return (Number(campaign.q1) || 0) + 
             (Number(campaign.q2) || 0) + 
             (Number(campaign.q3) || 0) + 
             (Number(campaign.q4) || 0);
    } catch (error) {
      console.error('Error calculating total:', error);
      return 0;
    }
  };

  // Form submission
  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (loading) return;
    setLoading(true);
    
    try {
      const campaignsToSave = campaigns.filter(campaign => 
        campaign.diseaseName && campaign.year
      );

      if (!userCountry) {
        const response = await apiService.auth.getProfile();
        const profile = response.data || response;
        setUserCountry(profile?.country || '');
      }

      for (const campaign of campaignsToSave) {
        // Calculate total before saving
        campaign.total = calculateTotal(campaign);

        // Map our internal model to the API expected model
        const formattedCampaign = {
          id: campaign.id === null ? undefined : campaign.id,
          disease_name: campaign.diseaseName,
          year: campaign.year,
          country: userCountry,
          status: campaign.status,
          vaccination_type: campaign.vaccinationType,
          geographical_areas: campaign.geographicalAreas,
          species: campaign.species,
          vaccine_details: campaign.vaccineDetails,
          q1: Number(campaign.q1) || 0,
          q2: Number(campaign.q2) || 0,
          q3: Number(campaign.q3) || 0,
          q4: Number(campaign.q4) || 0,
          total: calculateTotal(campaign),
          coverage: Number(campaign.coverage) || 0
        };

        const result = await rispService.saveVaccination(formattedCampaign as any);
        
        if (result?.success) {
          // Handle successful save
        } else {
          throw new Error('Failed to save vaccination data');
        }
      }

      navigate('/risp/surveillance');
    } catch (error) {
      console.error("Error saving vaccination campaigns:", error);
      alert("Error saving vaccination campaigns. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Navigation
  const goToPreviousPage = (event: React.MouseEvent) => {
    event.preventDefault();
    navigate('/risp/outbreak');
  };

  return (
    <div>
      <RispNavBar />
      <h1 className="text-2xl font-bold text-center mb-2">Vaccination Campaigns</h1>
      <p className="text-left text-gray-600 mb-4">
        Hereunder you can find the information from the past vaccination campaigns. Please update the information from previous campaigns when relevant (for example, if new information are available, you can modify the data from the previous quarter to update it or add information for the current quarter for an ongoing vaccination campaign), or use the “add vaccination” button. Please note that one vaccination table should be use per vaccination strategy (e.g. if mass vaccination performed for cattle, and risk-based strategy used for small ruminants).
      </p>

      {/* Main Content */}
      <div className="w-full overflow-x-auto px-4">
        <form onSubmit={submitForm}>
          {campaigns.map((campaign, index) => (
            <div key={index} className="bg-white rounded-lg mb-8 p-6 border-2 border-green-greenMain">
              <div className="space-y-4">
                {/* Campaign Info Table */}
                <table className="min-w-full border border-white bg-white text-center tracking-wider text-sm">
                  <thead>
                    <tr className="bg-green-greenMain text-white text-sm font-medium capitalize whitespace-nowrap">
                      <th className="py-3 border border-white min-w-[180px]">Disease Name</th>
                      <th className="py-3 border border-white min-w-[100px]">Year</th>
                      <th className="py-3 border border-white min-w-[100px]">Status</th>
                      <th className="py-3 border border-white min-w-[180px] relative">
                        <div 
                          className="flex items-center justify-center gap-1"
                          onMouseEnter={() => setTooltipOpen({...tooltipOpen, [index]: true})}
                          onMouseLeave={() => setTooltipOpen({...tooltipOpen, [index]: false})}
                        >
                          Strategy
                          <button
                            type="button"
                            className="inline-flex items-center hover:opacity-80 transition-opacity"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              height="20px"
                              viewBox="0 -960 960 960"
                              width="20px"
                              fill="currentColor"
                            >
                              <path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>
                            </svg>
                          </button>
                          {tooltipOpen[index] && (
                            <div className="absolute z-50 w-64 max-w-xs bg-white rounded-lg shadow-lg border border-gray-200 text-left p-3 text-black right-0 top-full mt-2 break-words whitespace-normal">
                              <div className="space-y-2 text-xs">
                                <p className="break-words whitespace-normal">
                                  <span className="font-medium">Mass vaccination:</span><br />
                                  <span className="text-gray-600">Vaccinations in entire country/zone (also if only one species vaccinated)</span>
                                </p>
                                <p className="break-words whitespace-normal">
                                  <span className="font-medium">Risk-based vaccination:</span><br />
                                  <span className="text-gray-600">Only sub-populations are vaccinated, e.g. in specific area, before movement, high value populations.</span>
                                </p>
                                <p className="break-words whitespace-normal">
                                  <span className="font-medium">Ring vaccination:</span><br />
                                  <span className="text-gray-600">Around outbreak areas</span>
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </th>
                      <th className="py-3 border border-white min-w-[200px]">Species</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="hover:bg-gray-50">
                      <td className="p-3">
                        <select
                          className="w-full h-[38px] py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm hover:bg-gray-50 cursor-pointer"
                          value={campaign.diseaseName}
                          onChange={(e) => handleFieldUpdate(index, 'diseaseName', e.target.value)}
                        >
                          <option value="">Select disease</option>
                          {diseaseOptions.map(disease => (
                            <option key={disease.id} value={disease.name}>
                              {disease.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <select
                          className="w-full h-[38px] py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm hover:bg-gray-50 cursor-pointer"
                          value={campaign.year}
                          onChange={(e) => handleFieldUpdate(index, 'year', e.target.value)}
                        >
                          <option value="">Select year</option>
                          {years.map(year => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <select
                          className="w-full h-[38px] py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm hover:bg-gray-50 cursor-pointer"
                          value={campaign.status}
                          onChange={(e) => handleFieldUpdate(index, 'status', e.target.value)}
                        >
                          <option value="">Select status</option>
                          <option value="Ongoing">Ongoing</option>
                          <option value="Planned">Planned</option>
                          <option value="Closed">Closed</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <select
                          className="w-full h-[38px] py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm hover:bg-gray-50 cursor-pointer"
                          value={campaign.vaccinationType}
                          onChange={(e) => handleFieldUpdate(index, 'vaccinationType', e.target.value)}
                        >
                          <option value="">Select strategy</option>
                          <option value="Mass">Mass vaccination</option>
                          <option value="RiskBased">Risk-based vaccination</option>
                          <option value="Ring">Ring vaccination</option>
                          <option value="OwnerRequest">On request of owner</option>
                          <option value="Trade">Related to trade</option>
                        </select>
                      </td>
                      <td className="p-3 relative">
                        <button 
                          type="button"
                          className="w-full h-[38px] py-2 px-3 text-left border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm hover:bg-gray-50 cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            console.log('Species button clicked directly');
                            toggleDropdown(index, 'species');
                          }}
                        >
                          {formatList(campaign.species || [], 'Select species...')}
                        </button>
                        {dropdowns[index]?.species && (
                          <HierarchicalSpeciesSelector 
                            isOpen={true}
                            selectedOptions={campaign.species || []}
                            disease={campaign.diseaseName}
                            onClose={() => closeDropdown(index, 'species')}
                            onChange={(options) => handleFieldUpdate(index, 'species', options)}
                          />
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Vaccination Data Table */}
                <table className="min-w-full border border-white bg-white text-center tracking-wider text-sm">
                  <thead>
                    <tr className="bg-gray-200 text-gray-700 text-sm font-medium capitalize whitespace-nowrap">
                      <th className="py-3 border border-white min-w-[180px]">Geographical Areas</th>
                      <th className="py-3 border border-white w-32 relative">
                        <div 
                          className="flex items-center justify-center gap-1"
                          onMouseEnter={() => setQ1TooltipOpen(true)}
                          onMouseLeave={() => setQ1TooltipOpen(false)}
                        >
                          Q1
                          <button
                            type="button"
                            className="inline-flex items-center hover:opacity-80 transition-opacity"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              height="16px"
                              viewBox="0 -960 960 960"
                              width="16px"
                              fill="currentColor"
                            >
                              <path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>
                            </svg>
                          </button>
                          {q1TooltipOpen && (
                            <div className="absolute z-50 w-48 bg-white rounded-lg shadow-lg border border-gray-200 text-left p-2 text-black left-1/2 transform -translate-x-1/2 top-full mt-1">
                              <p className="text-xs text-gray-700">
                                Add number of animals<br />vaccinated in each quarter
                              </p>
                            </div>
                          )}
                        </div>
                      </th>
                      <th className="py-3 border border-white w-32">Q2</th>
                      <th className="py-3 border border-white w-32">Q3</th>
                      <th className="py-3 border border-white w-32">Q4</th>
                      <th className="py-3 border border-white w-32">Total</th>
                      <th className="py-3 border border-white w-32 relative">
                        <div
                          className="flex items-center justify-center gap-1"
                          onMouseEnter={() => setCoverageTooltipOpen(true)}
                          onMouseLeave={() => setCoverageTooltipOpen(false)}
                        >
                          Coverage (%)
                          <button
                            type="button"
                            className="inline-flex items-center hover:opacity-80 transition-opacity"
                            tabIndex={-1}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              height="20px"
                              viewBox="0 -960 960 960"
                              width="20px"
                              fill="currentColor"
                            >
                              <path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>
                            </svg>
                          </button>
                          {coverageTooltipOpen && (
                            <div className="absolute z-50 w-64 max-w-xs bg-white rounded-lg shadow-lg border border-gray-200 text-left p-3 text-black right-0 top-full mt-2 break-words whitespace-normal">
                              <div className="space-y-2 text-xs">
                                <p className="break-words whitespace-normal">
                                  Number of animals vaccinated / number of eligible animals. Estimations are possible.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </th>
                      <th className="py-3 border border-white min-w-[300px]">Vaccine Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="hover:bg-gray-50">
                      <td className="p-3 relative">
                        <textarea
                          readOnly 
                          className="w-full min-h-[38px] py-2 px-3 text-left border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm hover:bg-gray-50 cursor-pointer resize-y"
                          value={formatList(campaign.geographicalAreas || [], 'Select areas...')}
                          onFocus={(e) => e.target.blur()}
                          onClick={(e) => {
                            e.preventDefault();
                            console.log('Textarea clicked directly');
                            toggleDropdown(index, 'areas');
                          }}
                        ></textarea>
                        {dropdowns[index]?.areas && (
                          <MultipleSelectOptions 
                            isOpen={true}
                            multipleOptions={locationOptions}
                            selectedOptions={campaign.geographicalAreas || []}
                            onClose={() => closeDropdown(index, 'areas')}
                            onChange={(options) => handleFieldUpdate(index, 'geographicalAreas', options)}
                            country={userCountry}
                          />
                        )}
                        {(campaign.geographicalAreas || []).includes('Specify region') && (
                          <textarea
                            className="mt-2 w-full min-h-[38px] py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm resize-y"
                            value={campaign.regionDetails}
                            onChange={(e) => handleFieldUpdate(index, 'regionDetails', e.target.value)}
                            placeholder="Enter region details..."
                          ></textarea>
                        )}
                      </td>
                      <td className="p-3">
                        <input 
                          type="number" 
                          min="0"
                          className="w-full h-[38px] py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                          value={campaign.q1}
                          onChange={(e) => handleFieldUpdate(index, 'q1', e.target.value)}
                        />
                      </td>
                      <td className="p-3">
                        <input 
                          type="number" 
                          min="0"
                          className="w-full h-[38px] py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                          value={campaign.q2}
                          onChange={(e) => handleFieldUpdate(index, 'q2', e.target.value)}
                        />
                      </td>
                      <td className="p-3">
                        <input 
                          type="number" 
                          min="0"
                          className="w-full h-[38px] py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                          value={campaign.q3}
                          onChange={(e) => handleFieldUpdate(index, 'q3', e.target.value)}
                        />
                      </td>
                      <td className="p-3">
                        <input 
                          type="number" 
                          min="0"
                          className="w-full h-[38px] py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                          value={campaign.q4}
                          onChange={(e) => handleFieldUpdate(index, 'q4', e.target.value)}
                        />
                      </td>
                      <td className="p-3">
                        <div className="w-full h-[38px] py-2 px-3 border border-gray-300 bg-gray-50 rounded-md text-center font-medium">
                          {calculateTotal(campaign)}
                        </div>
                      </td>
                      <td className="p-3">
                        <input 
                          type="number" 
                          min="0"
                          max="100"
                          className="w-full h-[38px] py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                          value={campaign.coverage}
                          onChange={(e) => handleFieldUpdate(index, 'coverage', e.target.value)}
                        />
                      </td>
                      <td className="p-3">
                        <textarea
                          className="w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm text-gray-900 placeholder-gray-400"
                          value={campaign.vaccineDetails}
                          onChange={(e) => handleFieldUpdate(index, 'vaccineDetails', e.target.value)}
                          placeholder="Enter manufacturer, serotype, vaccine strain, potency in PD50..."
                          rows={2}
                          style={{ resize: 'vertical' }}
                        ></textarea>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Save/Update Campaign Button */}
                <div className="flex justify-center mt-4">
                  <button
                    type="button"
                    onClick={() => updateCampaign(index)}
                    className="text-xs px-6 py-2 bg-green-greenMain text-white rounded hover:bg-green-greenMain2 transition-colors"
                  >
                    {campaign.id ? 'Update Campaign' : 'Save Campaign'}
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div className="flex justify-center space-x-4 my-8">
            <button
              type="button"
              onClick={goToPreviousPage}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded mr-4"
            >
              &lt;&lt; Previous
            </button>
            <button
              type="button"
              onClick={addCampaign}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded mr-4"
            >
              Add Vaccination
            </button>
            <button 
              type="button"
              onClick={() => navigate('/risp/surveillance')}
              className="px-4 py-2 bg-green-greenMain hover:bg-green-greenMain2 text-white rounded"
            >
              Proceed to Surveillance
            </button>
          </div>
        </form>
      </div>

      {/* Add custom styles with regular classes instead of jsx */}
      <style>
        {`
          .nav-btn {
            padding: 1rem 1rem;
            background-color: rgb(21 128 61);
            color: white;
            border-radius: 0.25rem;
            min-width: 200px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition-property: color, background-color;
            transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
            transition-duration: 150ms;
          }
          
          .nav-btn:hover {
            background-color: rgb(22 101 52);
          }
          
          .nav-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          
          .animate-spin {
            animation: spin 1s linear infinite;
          }
          
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default RISPVaccination;
