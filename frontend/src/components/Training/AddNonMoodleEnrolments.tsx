import React, { useState, useEffect } from 'react';
import { NonMoodleEnrollment, Country } from '../../types';
import { trainingService } from '../../services/training';
import { apiService } from '../../services/api';

interface AddNonMoodleEnrolmentsProps {
  onClose: () => void;
  onEnrollmentAdded: () => void;
}

const AddNonMoodleEnrolments: React.FC<AddNonMoodleEnrolmentsProps> = ({ onClose, onEnrollmentAdded }) => {
  const [loading, setLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [courses, setCourses] = useState<{ shortname: string }[]>([]);
  const [formData, setFormData] = useState({
    course_shortname: '',
    user_fullname: '',
    email: '',
    country: '',
    completion_date: '',
    progress: '',
    status: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch countries
      const countriesResponse = await apiService.countries.getAll();
      setCountries(countriesResponse.data);

      // Fetch courses
      const coursesResponse = await trainingService.getNMCourses();
      setCourses(coursesResponse);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleCourseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    const courseObject = courses.find((course) => course.shortname === selectedValue);
    if (courseObject) {
      setFormData((prev) => ({
        ...prev,
        course_shortname: courseObject.shortname,
      }));
    }
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    const countryObject = countries.find((country) => country.name_un === selectedValue);
    if (countryObject) {
      setFormData((prev) => ({
        ...prev,
        country: countryObject.name_un,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const requestObject: Partial<NonMoodleEnrollment> = {
      course_shortname: formData.course_shortname,
      user_fullname: formData.user_fullname,
      email: formData.email,
      country: formData.country,
      completion_date: formData.completion_date,
      progress: parseInt(formData.progress),
      status: formData.status,
    };

    try {
      const response = await trainingService.addNMEnrolment(requestObject);
      if (response.message === 'New enrolment entry created') {
        alert('New enrolment entry created');
        setShowSummary(true);
        onEnrollmentAdded();
      } else if (response.message && response.message.includes('ER_DUP_ENTRY')) {
        alert('This entry already exists');
      }
    } catch (error) {
      console.error('Error adding enrollment:', error);
      alert('An error occurred while trying to add a new enrolment entry. Please try again.');
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
            <h1 className="flex justify-center text-xl font-semibold mb-6">Enter Enrolments details</h1>

            <form className="mx-auto min-w-min px-4 pb-6" onSubmit={handleSubmit}>
              <select
                id="course_shortname"
                className="w-full border focus:ring-green-greenMain focus:border-green-greenMain focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                value={formData.course_shortname}
                onChange={handleCourseChange}
                required
              >
                <option value="" disabled>Select a course</option>
                {courses.map((course) => (
                  <option key={course.shortname} value={course.shortname}>
                    {course.shortname}
                  </option>
                ))}
              </select>

              <input
                id="user_fullname"
                type="text"
                placeholder="User"
                className="w-full border focus:ring-green-greenMain focus:border-green-greenMain focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                value={formData.user_fullname}
                onChange={handleInputChange}
                required
              />

              <input
                id="email"
                type="email"
                placeholder="Email"
                className="w-full border focus:ring-green-greenMain focus:border-green-greenMain focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                value={formData.email}
                onChange={handleInputChange}
                required
              />

              <select
                id="country"
                className="w-full border focus:ring-green-greenMain focus:border-green-greenMain focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                value={formData.country}
                onChange={handleCountryChange}
                required
              >
                <option value="" disabled>Select a country</option>
                {countries.map((country) => (
                  <option key={country.id} value={country.name_un}>
                    {country.name_un}
                  </option>
                ))}
              </select>

              <input
                id="completion_date"
                type="date"
                placeholder="YYYY-MM-DD"
                className="w-full border focus:ring-green-greenMain focus:border-green-greenMain focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                value={formData.completion_date}
                onChange={handleInputChange}
                required
              />

              <select
                id="progress"
                className="w-full border focus:ring-green-greenMain focus:border-green-greenMain focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                value={formData.progress}
                onChange={handleInputChange}
                required
              >
                <option value="" disabled>Select course progress</option>
                <option value="50">50%</option>
                <option value="100">100%</option>
              </select>

              <select
                id="status"
                className="w-full border focus:ring-green-greenMain focus:border-green-greenMain focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                value={formData.status}
                onChange={handleInputChange}
                required
              >
                <option value="" disabled>Select status</option>
                <option value="Open">Open</option>
                <option value="Completed">Completed</option>
              </select>

              {showSummary && (
                <div className="bg-gray-100 p-4 mb-4 rounded">
                  <h3 className="font-semibold">Summary of entered details:</h3>
                  <p><strong>Course Short Name:</strong> {formData.course_shortname}</p>
                  <p><strong>User:</strong> {formData.user_fullname}</p>
                  <p><strong>Email:</strong> {formData.email}</p>
                  <p><strong>Country:</strong> {formData.country}</p>
                  <p><strong>Completion Date:</strong> {formData.completion_date}</p>
                  <p><strong>Progress:</strong> {formData.progress}</p>
                  <p><strong>Status:</strong> {formData.status}</p>
                </div>
              )}

              <div className="grid justify-items-center">
                <button
                  type="submit"
                  className="bg-green-greenMain text-white px-6 py-2 rounded hover:bg-green-greenMain2 transition-colors font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={loading}
                >
                  Add enrolment
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddNonMoodleEnrolments;
