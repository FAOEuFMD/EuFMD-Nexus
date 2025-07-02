import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTools } from '@fortawesome/free-solid-svg-icons';

const GetPrepared: React.FC = () => {
  return (
    <div>
      <p className="mx-1 text-2xl">
        <strong>Get Prepared </strong> currently under construction.
      </p>

      <div className="flex justify-center p-10">
        <img
          src="/improve_control.jpg"
          alt="Under Construction"
          className="max-w-full h-auto"
        />
      </div>
      <div className="flex justify-center mb-4">
        <FontAwesomeIcon icon={faTools} className="text-5xl" />
        <span className="mx-1 text-3xl">Coming Soon! Thanks for your patience.</span>
        <FontAwesomeIcon icon={faTools} className="text-5xl" />
      </div>
    </div>
  );
};

export default GetPrepared;
