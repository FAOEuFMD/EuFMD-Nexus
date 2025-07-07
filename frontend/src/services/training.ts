import { apiService } from './api';
import { NonMoodleCourse, NonMoodleEnrollment } from '../types';

export const trainingService = {
  // Non-Moodle Courses
  async getAllNMCourses(): Promise<NonMoodleCourse[]> {
    try {
      console.log('Training service: calling getAllNMCourses API...');
      const response = await apiService.training.getAllNMCourses();
      console.log('Training service: API response:', response);
      console.log('Training service: response.data:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching non-moodle courses:', error);
      throw error;
    }
  },

  async getNMCourses(): Promise<{ shortname: string }[]> {
    try {
      const response = await apiService.training.getNMCourses();
      return response.data;
    } catch (error) {
      console.error('Error fetching course shortnames:', error);
      throw error;
    }
  },

  async addNMCourse(course: Partial<NonMoodleCourse>): Promise<any> {
    try {
      const response = await apiService.training.addNMCourse(course);
      return response.data;
    } catch (error) {
      console.error('Error adding non-moodle course:', error);
      throw error;
    }
  },

  // Non-Moodle Enrollments
  async addNMEnrolment(enrollment: Partial<NonMoodleEnrollment>): Promise<any> {
    try {
      const response = await apiService.training.addNMEnrolment(enrollment);
      return response.data;
    } catch (error) {
      console.error('Error adding non-moodle enrollment:', error);
      throw error;
    }
  },

  // CSV Template download
  downloadCsvTemplate(): void {
    const headers = [
      "Course_shortname",
      "User",
      "Email", 
      "Country",
      "Completion_date",
      "Progress",
      "Status",
    ];
    const csvContent = headers.join(",") + "\\n";
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "bulk_enrol_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
