import React from 'react';

const PCPMap: React.FC = () => {
  return (
    <div>
      <div className="flex justify-center p-10">
        <iframe
          src="https://tableau.apps.fao.org/views/PCP/PCPDASHBOARD?:showVizHome=no&:embed=true"
          width="1860"
          height="898"
          title="PCP Dashboard"
        ></iframe>
      </div>
    </div>
  );
};

export default PCPMap;
