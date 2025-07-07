import React, { useState, useCallback, useRef } from 'react';
import { TrainingDataTable, AddNonMoodleCourse, TrainingDataTableRef } from '../components/Training';

const TrainingNMCourses: React.FC = () => {
  const [showNonMoodleModal, setShowNonMoodleModal] = useState(false);
  const tableRef = useRef<TrainingDataTableRef>(null);

  const handleOpenCourseModal = () => {
    setShowNonMoodleModal(true);
  };

  const handleCloseModal = () => {
    setShowNonMoodleModal(false);
  };

  const handleCourseAdded = useCallback(async () => {
    // Refresh the table when a course is added
    setShowNonMoodleModal(false);
    if (tableRef.current) {
      await tableRef.current.refreshData();
    }
  }, []);

  return (
    <div>
      <h1 className="font-black capitalize text-2xl my-3 mb-8">
        Training Impact
      </h1>
      
      <button 
        onClick={handleOpenCourseModal}
        className="bg-green-greenMain hover:bg-green-greenMain2 text-white font-bold py-2 px-4 rounded w-1/4 mb-8"
      >
        Add Non-Moodle course
      </button>

      {showNonMoodleModal && (
        <AddNonMoodleCourse 
          onClose={handleCloseModal}
          onCourseAdded={handleCourseAdded}
        />
      )}

      <TrainingDataTable ref={tableRef} />
    </div>
  );
};

export default TrainingNMCourses;
