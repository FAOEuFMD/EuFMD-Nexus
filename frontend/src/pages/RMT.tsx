import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const RMT: React.FC = () => {
  const [showPopup, setShowPopup] = useState(false);

  const popupContent = [
    'Foot-and-mouth disease (FMD),',
    'Peste des petits ruminants (PPR),',
    'Lumpy skin disease (LSD),',
    'Rift Valley fever (RVF),',
    'Sheep pox and goat pox (SPGP).'
  ].join('<br/>');

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <p className="text-lg sm:text-xl font-light text-center mb-6">
        Welcome to the Risk Monitoring Tool for FAST diseases
      </p>
      
      <hr className="my-6 border-t-0 bg-neutral-100" />
      
      <div className="text-left mx-4 sm:mx-8 lg:mx-16 leading-relaxed mb-6">
        <p className="mb-4">
          The <strong>Risk Monitoring Tool (RMT)</strong> is a simple and easy-to-use tool designed to
          assist animal health authorities to identify and prioritize the risks related 
          to the introduction of{' '}
          <strong 
            className="cursor-pointer relative"
            onMouseEnter={() => setShowPopup(true)}
            onMouseLeave={() => setShowPopup(false)}
          >
            Foot-and-mouth And Similar Transboundary (FAST)
            {showPopup && (
              <span 
                className="absolute top-8 left-0 bg-white border border-gray-300 rounded p-2 shadow-lg z-10 min-w-48 text-sm"
                dangerouslySetInnerHTML={{ __html: popupContent }}
              />
            )}
          </strong>{' '}
          animal diseases. This information can be used to target preventive measures (e.g. surveillance, border 
          controls and trade restrictions) to reduce the probability of entry of new pathogens.
        </p>
        
        <div className="h-64 overflow-hidden relative mb-6">
          <img
            className="w-full h-auto absolute bottom-0 bg-white opacity-80"
            alt="Medium shot of a flock of sheep against brown soil"
            src="/FAO_WorkReady_RMTFast_get-prepared.png"
          />
        </div>
        
        <hr className="my-6 border-t-0 bg-neutral-100" />

        <div className="mb-8">
          <h4 className="font-bold mb-4">The RMT-FAST can be used for:</h4>
          <div className="flex flex-col lg:flex-row justify-between gap-6 lg:gap-10">
            <div className="flex-1">
              <ul className="list-disc ml-5 space-y-2">
                <li>
                  <strong>Risk ranking</strong>
                  <ul className="list-circle ml-5 mt-1 space-y-1">
                    <li>Identify highest risk source countries and pathways of entry</li>
                    <li>Inform targeted strengthening of border controls</li>
                  </ul>
                </li>
                <li>
                  <strong>Risk monitoring</strong>
                  <ul className="list-circle ml-5 mt-1 space-y-1">
                    <li>Highlight changes in risk following relevant epidemiological updates/events</li>
                  </ul>
                </li>
                <li>
                  <strong>Reporting</strong>
                  <ul className="list-circle ml-5 mt-1 space-y-1">
                    <li>Produce periodic reports/bulletins</li>
                  </ul>
                </li>
              </ul>
            </div>
            <div className="flex-1">
              <ul className="list-disc ml-5 space-y-2">
                <li>
                  <strong>Prelude to full risk assessment</strong>
                  <ul className="list-circle ml-5 mt-1 space-y-1">
                    <li>Identify issues that might need a more detailed risk assessment</li>
                  </ul>
                </li>
                <li>
                  <strong>Integration with other EuFMD tools</strong>
                  <ul className="list-circle ml-5 mt-1 space-y-1">
                    <li>
                      <a href="https://www.fao.org/eufmd/tools/pragmatist/fr/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-bold">
                        Pragmatist
                      </a>
                      ,{' '}
                      <a href="https://www.fao.org/eufmd/tools/vademos-model-for-vaccine-demand/fr/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-bold">
                        Vademos
                      </a>
                    </li>
                  </ul>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row justify-between flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[280px] p-5 rounded-lg shadow-md bg-gray-50">
            <h3 className="font-bold text-lg mb-3">Premise</h3>
            <p className="mb-3">The risk of introduction of FAST diseases (and other animal diseases) is proportional to:</p>
            <ul className="list-disc ml-5 space-y-2">
              <li>The disease burden in the source country;</li>
              <li>
                The effectiveness of different pathways at transmitting the pathogen
                <ul className="list-circle ml-5 mt-1">
                  <li>
                    FAST diseases can spread between countries via different transmission pathways. Six pathways are defined within the tool: airborne, vectors, wild animals, animal products, live animals and fomites. The effectiveness of the different pathways varies between diseases.
                  </li>
                </ul>
              </li>
              <li>
                The strength of connection between the source country and target country
                <ul className="list-circle ml-5 mt-1">
                  <li>
                    Countries may be connected in different ways, such as trade of live animals or products of animal origin, geographical proximity and transportation routes; each of these connections may contribute to one or more disease spread pathways.
                  </li>
                </ul>
              </li>
            </ul>
          </div>
          
          <div className="flex-1 min-w-[280px] p-5 rounded-lg shadow-md bg-gray-50">
            <p className="mb-3">The tool uses information provided by both EuFMD and the user:</p>
            <ul className="list-disc ml-5 space-y-2">
              <li>
                EuFMD activities in the European neighborhood countries are used to inform scores regarding the epidemiological situation (disease status) and the national control measures for FAST diseases (mitigation measures). The user may adjust these scores or directly input scores for countries of interest not included in the tool.
              </li>
              <li>
                The user provides the information needed to estimate the strength of connection between the source and target countries.
              </li>
            </ul>
          </div>
        </div>
        
        <div className="p-5 rounded-lg shadow-md bg-gray-50 text-center mb-8">
          <h3 className="font-bold text-lg mb-3">How does the RMT-FAST work?</h3>
          <p className="mb-3">
            The RMT-FAST calculates a risk score for each combination of disease and source country (see the formula below). A higher score implies a higher risk of introduction of the pathogen from this country.
          </p>
          <p className="mb-4">
            For each disease, the scores can be compared between pathways and source countries. However, the score of different diseases within a source country should <strong>not</strong> be compared.
          </p>
          <div className="font-semibold p-5 border-4 border-yellow-300 rounded-lg bg-yellow-50 max-w-2xl mx-auto">
            Risk score = disease risk × sum across pathways (pathway effectiveness × connection strength)
          </div>
        </div>
      </div>
      
      <div className="text-center">
        <p className="text-red-700 font-bold mb-4">
          Please note that the web version of the RMT-FAST is still under development, and that the version presented here is for testing purposes only.
        </p>
        
        <Link to="/rmt/risk-scores">
          <button
            type="button"
            className="bg-[#15736d] hover:bg-[#438f8a] hover:text-black text-white p-3 rounded mb-2 shadow-none transition-all duration-300 ease-in-out hover:shadow-md hover:shadow-black/30"
          >
            Calculate Risk Scores
          </button>
        </Link>
      </div>
    </div>
  );
};

export default RMT;
