import React, { useState, useCallback } from 'react';
import { AddNonMoodleEnrolments } from '../components/Training';

const TrainingNMEnrolments: React.FC = () => {
  const [showEnrolmentsModal, setShowEnrolmentsModal] = useState(false);

  const handleOpenEnrolmentsModal = () => {
    setShowEnrolmentsModal(true);
  };

  const handleCloseModal = () => {
    setShowEnrolmentsModal(false);
  };

  const handleEnrollmentAdded = useCallback(() => {
    // This will trigger a refresh of the enrollments table
    setShowEnrolmentsModal(false);
  }, []);

  const downloadCsvTemplate = () => {
    // Define headers based on non_moodle_enrols table
    const headers = [
      'Course_shortname',
      'User',
      'Email',
      'Country',
      'Completion_date',
      'Progress',
      'Status',
    ];
    const csvContent = headers.join(',') + '\n';
    
    // Create Blob, used to create a file-like object of data, and mime type for csv
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Create a link element to download the file
    const url = URL.createObjectURL(blob);
    
    // Create a temporary link element
    const link = document.createElement('a');
    
    // Set the href to the Blob URL
    link.setAttribute('href', url);
    
    // Set the download attribute so the browser will download the file instead of navigating to it
    link.setAttribute('download', 'bulk_enrol_template.csv');
    
    // Add the <a> element (the download link) to the HTML document
    document.body.appendChild(link);
    
    // Simulate a click on the link
    link.click();
    
    // Remove the link from the document
    document.body.removeChild(link);
  };

  return (
    <div>
      <h1 className="font-black capitalize text-2xl my-3 mb-8">
        Training Impact
      </h1>
      
      <button 
        onClick={handleOpenEnrolmentsModal}
        className="bg-green-greenMain hover:bg-green-greenMain2 text-white font-bold py-2 px-4 rounded w-1/4 mb-8"
      >
        Add Enrolments
      </button>

      {showEnrolmentsModal && (
        <AddNonMoodleEnrolments 
          onClose={handleCloseModal}
          onEnrollmentAdded={handleEnrollmentAdded}
        />
      )}

      <div className="container max-w-2xl mx-auto font-sans text-green-900">
        <h2 className="font-black capitalize my-3">
          Bulk user upload
        </h2>
        <h3>Here is a template for the format of the .CSV upload file</h3>
        <button 
          onClick={downloadCsvTemplate}
          className="bg-green-greenMain hover:bg-green-greenMain2 text-white font-medium py-2 px-4 rounded transition-colors my-4"
        >
          Download Template
        </button>

        <div className="bg-white border border-gray-300 p-4 my-6 rounded text-center">
          <p>
            Please ensure that these positions are entered in your .CSV file exactly
            as they appear here. These are the roles with attached competencies for
            your country.
          </p>
          <div className="mt-4 font-medium text-gray-700">Central veterinarian</div>
        </div>

        <h3>Upload your .CSV file here</h3>
        <div className="bg-gray-300 p-8 rounded text-center">
          <input type="file" accept=".csv" className="mb-4" />
          <br />
          <button className="bg-green-greenMain hover:bg-green-greenMain2 text-white border-none py-2 px-6 rounded text-base cursor-pointer transition-colors">
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrainingNMEnrolments;
