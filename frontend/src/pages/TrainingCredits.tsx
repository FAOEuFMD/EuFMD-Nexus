import React, { useState, useEffect } from 'react';
import { parse, format } from 'date-fns';
import MultiSelect from '../components/MultiSelect';
import CompetencyFramework from '../components/CompetencyFramework';

interface CalendarEvent {
  vLearning_Course_Name: string;
  Start_Date: string;
  End_Date: string;
  readableStartDate?: string;
  readableEndDate?: string;
}

interface PastTrainingCredit {
  id: number;
  course_short_name: string;
  training_credits: number;
  seats: number;
  used: number;
}

interface TrainingSummary {
  country: string;
  total_enrollments: number;
  total_completed: number;
  total_in_progress: number;
  completion_rate: number;
  by_course: CourseStats[];
}

interface CourseStats {
  course_name: string;
  course_shortname: string;
  source: string;
  enrollments: number;
  completed: number;
  in_progress: number;
  completion_rate: number;
}

const TrainingCredits: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'summary' | 'calendar' | 'allocations' | 'previous'>('summary');
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<CalendarEvent[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pastCredits, setPastCredits] = useState<PastTrainingCredit[]>([]);
  const [pastCreditsLoading, setPastCreditsLoading] = useState(false);
  const [pastCreditsError, setPastCreditsError] = useState<string | null>(null);
  const [summary, setSummary] = useState<TrainingSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(false);
  const [competencyData, setCompetencyData] = useState<any>(null);
  const [competencyLoading, setCompetencyLoading] = useState(false);
  const [competencyError, setCompetencyError] = useState<string | null>(null);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5800';

  const months = [
    { value: '01', name: 'January' },
    { value: '02', name: 'February' },
    { value: '03', name: 'March' },
    { value: '04', name: 'April' },
    { value: '05', name: 'May' },
    { value: '06', name: 'June' },
    { value: '07', name: 'July' },
    { value: '08', name: 'August' },
    { value: '09', name: 'September' },
    { value: '10', name: 'October' },
    { value: '11', name: 'November' },
    { value: '12', name: 'December' },
  ];

  useEffect(() => {
    loadCalendarEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'previous') {
      loadPastCredits();
    } else if (activeTab === 'summary') {
      loadSummary();
      loadCompetencyFramework();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedYears.join(','), selectedCategories.join(',')]);

  const loadCalendarEvents = async () => {
    setLoading(true);
    setError(null);
    const calendarUrl = `${API_BASE_URL}/api/training-calendar/events`;
    console.log('Loading calendar events from:', calendarUrl);
    try {
      const response = await fetch(calendarUrl);
      console.log('Response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to load calendar events: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      console.log('Loaded events:', data.length, 'events');
      
      // Format dates
      // Backend already formats dates, but we need to parse for filtering
      const formatted = data.map((event: CalendarEvent) => {
        try {
          const parsedStartDate = parse(event.Start_Date, 'dd-MMM-yy', new Date());
          const parsedEndDate = parse(event.End_Date, 'dd-MMM-yy', new Date());
          
          return {
            ...event,
            Start_Date_Parsed: format(parsedStartDate, 'yyyy-MM-dd'),
            End_Date_Parsed: format(parsedEndDate, 'yyyy-MM-dd')
          };
        } catch (err) {
          console.error('Date parsing error for event:', event, err);
          return event;
        }
      });
      
      console.log('Formatted events:', formatted.length);
      setCalendarEvents(formatted);
      setFilteredEvents(formatted);
    } catch (err) {
      console.error('Error loading calendar events:', err);
      setError(`Failed to load calendar events: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const loadPastCredits = async () => {
    setPastCreditsLoading(true);
    setPastCreditsError(null);
    const pastCreditsUrl = `${API_BASE_URL}/api/training-credits/past`;
    console.log('Loading past training credits from:', pastCreditsUrl);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(pastCreditsUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-access-token': token || '',
        },
      });
      
      console.log('Past credits response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to load past credits: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Loaded past credits:', data.length, 'entries');
      setPastCredits(data);
    } catch (err) {
      console.error('Error loading past training credits:', err);
      setPastCreditsError(`Failed to load past training credits: ${err}`);
    } finally {
      setPastCreditsLoading(false);
    }
  };

  const loadSummary = async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    
    const params = new URLSearchParams();
    selectedYears.forEach(year => params.append('year', year));
    selectedCategories.forEach(category => params.append('category', category));
    
    const summaryUrl = `${API_BASE_URL}/api/training-credits/summary${params.toString() ? `?${params.toString()}` : ''}`;
    console.log('Loading training summary from:', summaryUrl);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(summaryUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-access-token': token || '',
        },
      });
      
      console.log('Summary response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to load summary: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Loaded summary:', data);
      setSummary(data);
    } catch (err) {
      console.error('Error loading training summary:', err);
      setSummaryError(`Failed to load training summary: ${err}`);
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadCompetencyFramework = async () => {
    setCompetencyLoading(true);
    setCompetencyError(null);
    
    const competencyUrl = `${API_BASE_URL}/api/training-credits/competency-framework`;
    console.log('Loading competency framework from:', competencyUrl);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(competencyUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-access-token': token || '',
        },
      });
      
      console.log('Competency framework response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to load competency framework: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Loaded competency framework:', data);
      setCompetencyData(data);
    } catch (err) {
      console.error('Error loading competency framework:', err);
      setCompetencyError(`Failed to load competency framework: ${err}`);
    } finally {
      setCompetencyLoading(false);
    }
  };

  const filterEventsByMonth = (month: string) => {
    setSelectedMonth(month);
    if (month) {
      const filtered = calendarEvents.filter(event => {
        try {
          const dateStr = (event as any).Start_Date_Parsed || event.Start_Date;
          const eventMonth = new Date(dateStr).getMonth() + 1;
          return eventMonth.toString().padStart(2, '0') === month;
        } catch (err) {
          return false;
        }
      });
      setFilteredEvents(filtered);
    } else {
      setFilteredEvents(calendarEvents);
    }
  };

  return (
    <div className="container mx-auto px-4">
      <section className="mb-6">
        <p className="font-black capitalize text-2xl mb-6 font-martaBold">
          Training Credits
        </p>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <p className="text-gray-700">
            Manage training credit summaries, upcoming sessions, and allocations.
          </p>
        </div>

        <div className="flex justify-start space-x-2 mb-6">
          <button
            className={`nav-btn ${activeTab === 'summary' ? 'bg-greens text-white' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            Summary
          </button>
          <button
            className={`nav-btn ${activeTab === 'calendar' ? 'bg-greens text-white' : ''}`}
            onClick={() => setActiveTab('calendar')}
          >
            Calendar
          </button>
          <button
            className={`nav-btn ${activeTab === 'allocations' ? 'bg-greens text-white' : ''}`}
            onClick={() => setActiveTab('allocations')}
          >
            Training Allocations
          </button>
          <button
            className={`nav-btn ${activeTab === 'previous' ? 'bg-greens text-white' : ''}`}
            onClick={() => setActiveTab('previous')}
          >
            Previous Allocations
          </button>
        </div>
      </section>

      <section className="mb-6">
        {activeTab === 'summary' && (
          <div className="bg-white rounded-lg shadow-md">
            {/* Collapsible Header */}
            <div 
              className="flex items-center justify-between p-6 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setIsSummaryCollapsed(!isSummaryCollapsed)}
            >
              <h2 className="text-xl font-bold flex items-center gap-2">
                Training Summary
                <svg
                  className={`w-5 h-5 transition-transform ${isSummaryCollapsed ? '' : 'rotate-90'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </h2>
              <span className="text-sm text-gray-500">
                {isSummaryCollapsed ? 'Click to expand' : 'Click to collapse'}
              </span>
            </div>
            
            {/* Collapsible Content */}
            {!isSummaryCollapsed && (
            <div className="px-6 pb-6">
            
            {/* Filters */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <MultiSelect
                label="Year(s)"
                options={Array.from({ length: 10 }, (_, i) => {
                  const year = new Date().getFullYear() - i;
                  return { value: year.toString(), label: year.toString() };
                })}
                selectedValues={selectedYears}
                onChange={setSelectedYears}
                placeholder="All Years"
              />
              
              <MultiSelect
                label="Category/Categories"
                options={[
                  { value: 'FMD', label: 'FMD' },
                  { value: 'PPR', label: 'PPR' },
                  { value: 'LSD', label: 'LSD' },
                  { value: 'RVF', label: 'RVF' },
                  { value: 'SPGP', label: 'SPGP' },
                  { value: 'VET', label: 'VET' },
                  { value: 'LAB', label: 'LAB' },
                  { value: 'EPI', label: 'EPI' },
                  { value: 'GEN', label: 'GEN' },
                ]}
                selectedValues={selectedCategories}
                onChange={setSelectedCategories}
                placeholder="All Categories"
              />
            </div>
            
            {summaryLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-greens mx-auto mb-4"></div>
                  <p className="text-gray-700">Loading training summary...</p>
                </div>
              </div>
            ) : summaryError ? (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-red-700">Error: {summaryError}</p>
                <button 
                  onClick={loadSummary}
                  className="mt-3 px-4 py-2 bg-greens text-white rounded hover:bg-green-700"
                >
                  Retry
                </button>
              </div>
            ) : !summary ? (
              <p className="text-gray-700">No training data available.</p>
            ) : (
              <div>
                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="text-sm text-blue-600 font-medium mb-1">Total Enrollments</div>
                    <div className="text-3xl font-bold text-blue-800">{summary.total_enrollments}</div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="text-sm text-green-600 font-medium mb-1">Completed</div>
                    <div className="text-3xl font-bold text-green-800">{summary.total_completed}</div>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="text-sm text-yellow-600 font-medium mb-1">In Progress</div>
                    <div className="text-3xl font-bold text-yellow-800">{summary.total_in_progress}</div>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="text-sm text-purple-600 font-medium mb-1">Completion Rate</div>
                    <div className="text-3xl font-bold text-purple-800">{summary.completion_rate}%</div>
                  </div>
                </div>

                {/* Courses Table */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Courses Breakdown</h3>
                  {summary.by_course.length === 0 ? (
                    <p className="text-gray-700">No course enrollments found.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border border-gray-200">
                        <thead>
                          <tr className="bg-gray-100 text-gray-700 text-xs font-medium uppercase">
                            <th className="text-left px-6 py-3 border-b">Course Name</th>
                            <th className="text-center px-4 py-3 border-b">Source</th>
                            <th className="text-center px-4 py-3 border-b">Enrollments</th>
                            <th className="text-center px-4 py-3 border-b">Completed</th>
                            <th className="text-center px-4 py-3 border-b">In Progress</th>
                            <th className="text-center px-4 py-3 border-b">Completion %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {summary.by_course.map((course, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-3 text-left text-gray-800">
                                {course.course_name}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-1 text-xs rounded ${
                                  course.source === 'Moodle' 
                                    ? 'bg-blue-100 text-blue-800' 
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {course.source}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center text-gray-600">
                                {course.enrollments}
                              </td>
                              <td className="px-4 py-3 text-center text-green-600 font-medium">
                                {course.completed}
                              </td>
                              <td className="px-4 py-3 text-center text-yellow-600">
                                {course.in_progress}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center">
                                  <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                    <div 
                                      className="bg-greens h-2 rounded-full" 
                                      style={{ width: `${course.completion_rate}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-sm text-gray-600">{course.completion_rate}%</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
            </div>
            )}
          </div>
        )}

        {/* Competency Framework Section - Only show when Summary tab is active */}
        {activeTab === 'summary' && (
          <CompetencyFramework
            data={competencyData}
            loading={competencyLoading}
            error={competencyError}
          />
        )}

        {activeTab === 'calendar' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">Calendar</h2>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-greens mx-auto mb-4"></div>
                  <p className="text-gray-700">Loading calendar events...</p>
                </div>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-red-700">Error: {error}</p>
                <button 
                  onClick={loadCalendarEvents}
                  className="mt-3 px-4 py-2 bg-greens text-white rounded hover:bg-green-700"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div>
                <div className="mb-4">
                  <label htmlFor="month-filter" className="block text-sm font-medium text-gray-700 mb-2">
                    Filter by Month
                  </label>
                  <select
                    id="month-filter"
                    value={selectedMonth}
                    onChange={(e) => filterEventsByMonth(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-greens focus:border-transparent"
                  >
                    <option value="">Full Year</option>
                    {months.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.name}
                      </option>
                    ))}
                  </select>
                </div>

                {filteredEvents.length === 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                    <p className="text-yellow-800">
                      No events found for the selected period. 
                      {calendarEvents.length === 0 && ' No calendar events available.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="mb-2 text-sm text-gray-600">
                      Showing {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
                    </div>
                    <table className="w-full border border-gray-200">
                      <thead>
                        <tr className="bg-gray-100 text-gray-700 text-xs font-medium uppercase">
                          <th className="text-left px-6 py-3 border-b">Course Name</th>
                          <th className="text-center px-4 py-3 border-b">Start Date</th>
                          <th className="text-center px-4 py-3 border-b">End Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {filteredEvents.map((event, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-3 text-left text-gray-800">
                              {event.vLearning_Course_Name}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-600">
                              {event.readableStartDate}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-600">
                              {event.readableEndDate}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'allocations' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">Training Allocations</h2>
            <p className="text-gray-700">Training allocations view coming soon.</p>
          </div>
        )}

        {activeTab === 'previous' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">Previous Allocations</h2>
            
            {pastCreditsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-greens mx-auto mb-4"></div>
                  <p className="text-gray-700">Loading previous allocations...</p>
                </div>
              </div>
            ) : pastCreditsError ? (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-red-700">Error: {pastCreditsError}</p>
                <button 
                  onClick={loadPastCredits}
                  className="mt-3 px-4 py-2 bg-greens text-white rounded hover:bg-green-700"
                >
                  Retry
                </button>
              </div>
            ) : pastCredits.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <p className="text-yellow-800">No previous training credit allocations found for your country.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="mb-2 text-sm text-gray-600">
                  Showing {pastCredits.length} course{pastCredits.length !== 1 ? 's' : ''}
                </div>
                <table className="w-full border border-gray-200">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700 text-xs font-medium uppercase">
                      <th className="text-left px-10 py-3 border-b">Course</th>
                      <th className="text-center px-5 py-3 border-b">Training Credits</th>
                      <th className="text-center px-5 py-3 border-b">Seats</th>
                      <th className="text-center px-5 py-3 border-b">Used</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {pastCredits.map((credit) => (
                      <tr key={credit.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-10 py-3 text-left text-gray-800">
                          {credit.course_short_name}
                        </td>
                        <td className="px-5 py-3 text-center text-gray-600">
                          {credit.training_credits}
                        </td>
                        <td className="px-5 py-3 text-center text-gray-600">
                          {credit.seats}
                        </td>
                        <td className="px-5 py-3 text-center text-gray-600">
                          {credit.used}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default TrainingCredits;
