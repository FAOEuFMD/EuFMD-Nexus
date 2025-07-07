import React, { useState } from 'react';
import { NonMoodleCourse } from '../../types';
import { trainingService } from '../../services/training';

interface AddNonMoodleCourseProps {
  onClose: () => void;
  onCourseAdded: () => void;
}

const AddNonMoodleCourse: React.FC<AddNonMoodleCourseProps> = ({ onClose, onCourseAdded }) => {
  const [loading, setLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [formData, setFormData] = useState({
    shortname: '',
    fullname: '',
    start_date: '',
    language: '',
    format: '',
    main_topic: '',
    level: '',
    edition: '',
    duration: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const requestObject: Partial<NonMoodleCourse> = {
      shortname: formData.shortname,
      fullname: formData.fullname,
      start_date: formData.start_date,
      language: formData.language,
      duration: parseInt(formData.duration),
      format: formData.format,
      level: formData.level,
      main_topic: formData.main_topic,
      edition: parseInt(formData.edition),
    };

    try {
      const response = await trainingService.addNMCourse(requestObject);
      if (response.message === 'New course entry created') {
        alert('New course entry created');
        setShowSummary(true);
        onCourseAdded();
      } else if (response.message && response.message.includes('ER_DUP_ENTRY')) {
        alert('This entry already exists');
      }
    } catch (error) {
      console.error('Error adding course:', error);
      alert('An error occurred while trying to add a new course entry. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div
        className="absolute w-full h-screen bg-gray-900 opacity-50"
        onClick={onClose}
      ></div>

      <div
        className="bg-white w-full max-w-xl lg:max-w-2xl rounded-lg z-50 overflow-y-auto shadow-lg p-4 md:p-6"
        style={{ maxHeight: '75vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="py-1 text-left px-8">
          <div className="flex justify-end items-center mt-5">
            <button
              className="cursor-pointer text-md hover:text-green-greenMain"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
          {loading && <div className="text-center">Loading...</div>}
          <div className="flex flex-col p-5">
            <h1 className="flex justify-center text-xl font-semibold mb-6">Enter course details</h1>

            <form className="mx-auto min-w-min px-4 pb-6" onSubmit={handleSubmit}>
              <input
                id="shortname"
                type="text"
                placeholder="Course short name"
                className="w-full border focus:ring-green-greenMain focus:border-green-greenMain focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                value={formData.shortname}
                onChange={handleInputChange}
                required
              />

              <input
                id="fullname"
                type="text"
                placeholder="Course full name"
                className="w-full border focus:ring-green-greenMain focus:border-green-greenMain focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                value={formData.fullname}
                onChange={handleInputChange}
                required
              />

              <input
                id="start_date"
                type="date"
                placeholder="YYYY-MM-DD"
                className="w-full border focus:ring-green-greenMain focus:border-green-greenMain focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                value={formData.start_date}
                onChange={handleInputChange}
                required
              />

              <select
                id="language"
                className="w-full border focus:ring-green-greenMain focus:border-green-greenMain focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                value={formData.language}
                onChange={handleInputChange}
                required
              >
                <option value="" disabled>Select language</option>
                <option value="English">English</option>
                <option value="French">French</option>
                <option value="German">German</option>
                <option value="Italian">Italian</option>
                <option value="Portuguese">Portuguese</option>
                <option value="Spanish">Spanish</option>
              </select>

              <input
                id="duration"
                type="number"
                placeholder="Duration"
                min="1"
                className="w-full border focus:ring-green-greenMain focus:border-green-greenMain focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                value={formData.duration}
                onChange={handleInputChange}
                required
              />

              <select
                id="level"
                className="w-full border focus:ring-green-greenMain focus:border-green-greenMain focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                value={formData.level}
                onChange={handleInputChange}
                required
              >
                <option value="" disabled>Select level</option>
                <option value="Basic">Basic</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>

              <select
                id="format"
                className="w-full border focus:ring-green-greenMain focus:border-green-greenMain focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                value={formData.format}
                onChange={handleInputChange}
                required
              >
                <option value="" disabled>Select format</option>
                <option value="Face to Face">Face to Face</option>
                <option value="Workshop">Workshop</option>
                <option value="Virtual Workshop">Virtual Workshop</option>
                <option value="Hybrid Workshop">Hybrid Workshop</option>
              </select>

              <select
                id="main_topic"
                className="w-full border focus:ring-green-greenMain focus:border-green-greenMain focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                value={formData.main_topic}
                onChange={handleInputChange}
                required
              >
                <option value="" disabled>Select main topic</option>
                <option value="FMD emergency preparedness">FMD emergency preparedness</option>
                <option value="FMD laboratory">FMD laboratory</option>
                <option value="Safe trade">Safe trade</option>
                <option value="Risk-based surveillance">Risk-based surveillance</option>
                <option value="Risk mapping">Risk mapping</option>
                <option value="Rift valley fever">Rift valley fever</option>
                <option value="Public-private partnerships">Public-private partnerships</option>
                <option value="Progressive control pathway">Progressive control pathway</option>
                <option value="EuFMDis">EuFMDis</option>
              </select>

              <input
                id="edition"
                type="number"
                placeholder="Edition"
                min="1"
                className="w-full border focus:ring-green-greenMain focus:border-green-greenMain focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                value={formData.edition}
                onChange={handleInputChange}
                required
              />

              {showSummary && (
                <div className="bg-gray-100 p-4 mb-4 rounded">
                  <h3 className="font-semibold">Summary of entered details:</h3>
                  <p><strong>Short Name:</strong> {formData.shortname}</p>
                  <p><strong>Full Name:</strong> {formData.fullname}</p>
                  <p><strong>Creation Date:</strong> {formData.start_date}</p>
                  <p><strong>Language:</strong> {formData.language}</p>
                  <p><strong>Format:</strong> {formData.format}</p>
                  <p><strong>Main Topic:</strong> {formData.main_topic}</p>
                  <p><strong>Level:</strong> {formData.level}</p>
                  <p><strong>Edition:</strong> {formData.edition}</p>
                  <p><strong>Duration:</strong> {formData.duration}</p>
                </div>
              )}

              <div className="grid justify-items-center">
                <button
                  type="submit"
                  className="bg-green-greenMain text-white px-6 py-2 rounded hover:bg-green-greenMain2 transition-colors font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={loading}
                >
                  Add course
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddNonMoodleCourse;
