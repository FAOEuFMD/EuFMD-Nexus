import { apiService } from './api';
import { PCPEntry, PCPEntryCreate, PCPUniqueValues } from '../types';

export const pcpService = {
  async getAllPCP(): Promise<PCPEntry[]> {
    try {
      const response = await apiService.pcp.getAll();
      return response.data;
    } catch (error) {
      console.error('Error fetching PCP data:', error);
      throw error;
    }
  },

  async addPCPEntry(data: PCPEntryCreate): Promise<any> {
    try {
      const response = await apiService.pcp.add(data);
      return response.data;
    } catch (error) {
      console.error('Error adding PCP entry:', error);
      throw error;
    }
  },

  async getUniqueValues(): Promise<PCPUniqueValues> {
    try {
      const response = await apiService.pcp.getUniqueValues();
      return response.data;
    } catch (error) {
      console.error('Error fetching unique PCP values:', error);
      throw error;
    }
  },

  async deletePCPEntry(id: number): Promise<any> {
    try {
      const response = await apiService.pcp.delete(id);
      return response.data;
    } catch (error) {
      console.error('Error deleting PCP entry:', error);
      throw error;
    }
  },

  // Download report functionality
  async downloadReport(filters: any): Promise<void> {
    try {
      // This will create a CSV download similar to the Vue implementation
      const allData = await this.getAllPCP();
      
      // Apply filters
      let filteredData = allData.filter((pcpData) => {
        const regionTrue = filters.RMM ? pcpData.RMM === filters.RMM : true;
        const countryTrue = filters.country ? pcpData.Country === filters.country : true;
        const yearTrue = filters.year ? pcpData.Year === filters.year : true;
        const stageTrue = filters.stage ? pcpData.PCP_Stage === filters.stage : true;
        const psoTrue = filters.pso_support ? pcpData.PSO_support === filters.pso_support : true;
        
        return regionTrue && countryTrue && yearTrue && stageTrue && psoTrue;
      });

      if (filteredData.length === 0) {
        throw new Error('No data found');
      }

      // Create CSV
      const csvString = [
        [
          "Roadmap Region",
          "Country",
          "Year",
          "PCP-FMD Stage",
          "Last meeting attended",
          "PSO support",
        ],
        ...filteredData.map((item) => [
          item.RMM || '',
          item.Country,
          item.Year.toString(),
          item.PCP_Stage || '',
          item.Last_meeting_attended || '',
          item.PSO_support || '',
        ]),
      ]
        .map((e) => e.join(","))
        .join("\\n");

      const today = new Date();
      const date = today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();

      const anchor = document.createElement("a");
      anchor.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csvString);
      anchor.target = "_blank";
      anchor.download = `pcp_report_${date}.csv`;
      anchor.click();
    } catch (error) {
      console.error('Error generating report:', error);
      throw error;
    }
  }
};
