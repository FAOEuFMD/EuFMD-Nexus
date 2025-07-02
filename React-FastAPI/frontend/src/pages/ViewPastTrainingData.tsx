import React from 'react';

const ViewPastTrainingData: React.FC = () => {
  return (
    <div>
      <div className="flex justify-center p-10">
        <iframe
          src="https://tableau.apps.fao.org/views/ImpactSurveys2022/ImpactSurveys2022?%3Aembed=y&%3Aiid=1&%3AisGuestRedirectFromVizportal=y"
          width="1860"
          height="898"
          title="Training Impact Tableau Dashboard"
        ></iframe>
      </div>
    </div>
  );
};

export default ViewPastTrainingData;
