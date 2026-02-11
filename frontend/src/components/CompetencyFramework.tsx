import React, { useState } from 'react';

interface CompetencyData {
  total_users: number;
  levels: {
    level_1: number;
    level_2: number;
    level_3: number;
    level_4: number;
    level_5: number;
  };
}

interface CompetencyFrameworkData {
  country: string;
  competencies: {
    [key: string]: CompetencyData;
  };
}

interface CompetencyFrameworkProps {
  data: CompetencyFrameworkData | null;
  loading: boolean;
  error: string | null;
}

const levelNames = ['Awareness', 'Beginner', 'Competent', 'Proficient', 'Expert'];

const CompetencyFramework: React.FC<CompetencyFrameworkProps> = ({ data, loading, error }) => {
  const [expandedCompetency, setExpandedCompetency] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Competency Framework</h2>
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-greens mx-auto mb-4"></div>
            <p className="text-gray-700">Loading competency data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Competency Framework</h2>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!data || !data.competencies) {
    return null;
  }

  const getGreenShade = (level: number): string => {
    const shades = [
      'bg-green-100',  // Level 1 - lightest
      'bg-green-300',  // Level 2
      'bg-green-500',  // Level 3
      'bg-green-700',  // Level 4
      'bg-green-900',  // Level 5 - darkest
    ];
    return shades[level - 1];
  };

  const getTextColor = (level: number): string => {
    return level >= 4 ? 'text-white' : 'text-gray-800';
  };

  const toggleCompetency = (competency: string) => {
    setExpandedCompetency(expandedCompetency === competency ? null : competency);
  };

  const competencyList = Object.keys(data.competencies).sort();

  return (
    <div className="bg-white rounded-lg shadow-md mt-6">
      {/* Collapsible Header */}
      <div 
        className="flex items-center justify-between p-6 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            Competency Framework
            <svg
              className={`w-5 h-5 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Distribution of competency levels across {data.country} learners
          </p>
        </div>
        <span className="text-sm text-gray-500">
          {isCollapsed ? 'Click to expand' : 'Click to collapse'}
        </span>
      </div>

      {/* Collapsible Content */}
      {!isCollapsed && (
      <div className="px-6 pb-6">
      <div className="space-y-4">
        {competencyList.map((competency) => {
          const compData = data.competencies[competency];
          const isExpanded = expandedCompetency === competency;
          const maxUsers = compData.total_users;

          return (
            <div key={competency} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Header */}
              <div
                className="bg-gray-50 px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-between"
                onClick={() => toggleCompetency(competency)}
              >
                <div className="flex items-center gap-2">
                  <svg
                    className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <h3 className="font-semibold text-gray-900">{competency}</h3>
                </div>
                <span className="text-sm text-gray-600">
                  {compData.total_users} {compData.total_users === 1 ? 'user' : 'users'}
                </span>
              </div>

              {/* Level Distribution Bars */}
              <div className="p-4 space-y-2">
                {[1, 2, 3, 4, 5].map((level) => {
                  const count = compData.levels[`level_${level}` as keyof typeof compData.levels];
                  const percentage = maxUsers > 0 ? (count / maxUsers) * 100 : 0;
                  const greenShade = getGreenShade(level);
                  const textColor = getTextColor(level);

                  return (
                    <div key={level} className="flex items-center gap-3">
                      <div className="w-24 text-sm font-medium text-gray-700">
                        {levelNames[level - 1]}
                      </div>
                      <div className="flex-1 bg-gray-100 rounded-full h-8 overflow-hidden relative">
                        <div
                          className={`${greenShade} h-full transition-all duration-500 flex items-center justify-end px-3`}
                          style={{ width: `${percentage}%` }}
                        >
                          {count > 0 && (
                            <span className={`text-sm font-semibold ${textColor}`}>
                              {count} {count === 1 ? 'user' : 'users'} ({percentage.toFixed(0)}%)
                            </span>
                          )}
                        </div>
                        {count === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs text-gray-400">No users</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-sm text-gray-600">
                    <strong>Level Breakdown:</strong>
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-gray-700">
                    {[1, 2, 3, 4, 5].map((level) => {
                      const count = compData.levels[`level_${level}` as keyof typeof compData.levels];
                      return (
                        <li key={level}>
                          • <strong>{levelNames[level - 1]} (Level {level}):</strong> {count} {count === 1 ? 'learner has' : 'learners have'} achieved at least this level
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {competencyList.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No competency data available
        </div>
      )}      </div>
      )}    </div>
  );
};

export default CompetencyFramework;
