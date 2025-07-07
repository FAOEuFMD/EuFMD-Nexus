import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { NonMoodleCourse } from '../../types';
import { trainingService } from '../../services/training';

export interface TrainingDataTableRef {
  refreshData: () => Promise<void>;
}

const TrainingDataTable = forwardRef<TrainingDataTableRef>((props, ref) => {
  const [nonMoodleCourses, setNonMoodleCourses] = useState<NonMoodleCourse[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      console.log('Fetching courses...');
      const response = await trainingService.getAllNMCourses();
      console.log('API Response:', response);
      console.log('Courses data:', response);
      setNonMoodleCourses(response);
    } catch (error) {
      console.error('Failed to fetch courses', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  // Expose refresh function to parent component
  useImperativeHandle(ref, () => ({
    refreshData: fetchCourses
  }));

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return <div className="text-center p-4">Loading...</div>;
  }

  console.log('Current courses state:', nonMoodleCourses);
  console.log('Courses length:', nonMoodleCourses.length);

  return (
    <div className="mx-8">
      {nonMoodleCourses.length > 0 ? (
        <table className="w-full border bg-white text-center">
          <thead>
            <tr className="bg-green-greenMain text-white text-md">
              <th className="px-5 py-3 text-left">Short Name</th>
              <th className="p-1">Full Name</th>
              <th className="p-1">Start Date</th>
              <th className="p-1">Language</th>
              <th className="p-1">Format</th>
              <th className="p-1">Main Topic</th>
              <th className="p-1">Level</th>
              <th className="p-1">Edition</th>
              <th className="px-5">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {nonMoodleCourses.map((course) => (
              <tr key={course.id || course.shortname}>
                <td className="px-5 py-1 text-left">{course.shortname}</td>
                <td className="px-5 py-3">{course.fullname}</td>
                <td className="px-5 py-3">{formatDate(course.start_date)}</td>
                <td className="px-5 py-3">{course.language}</td>
                <td className="px-5 py-3">{course.format}</td>
                <td className="px-5 py-3">{course.main_topic}</td>
                <td className="px-5 py-3">{course.level}</td>
                <td className="px-5 py-3">{course.edition}</td>
                <td className="px-5 py-3">{course.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="text-center text-large font-bold uppercase p-4">
          No Courses to display
        </div>
      )}
    </div>
  );
});

TrainingDataTable.displayName = 'TrainingDataTable';

export default TrainingDataTable;
