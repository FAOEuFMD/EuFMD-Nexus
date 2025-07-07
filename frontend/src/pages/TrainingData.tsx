import React from 'react';
import { Link } from 'react-router-dom';

const TrainingData: React.FC = () => {
  return (
    <div className="min-h-96">
      <h1 className="font-black capitalize text-2xl my-3">
        Training Impact
      </h1>
      <Link to="/training-data/courses">
        <button className="w-1/4 bg-green-greenMain hover:bg-green-greenMain2 text-white font-bold py-2 px-4 rounded my-10">
          Non-moodle courses
        </button>
      </Link>
      <Link to="/training-data/enrolments">
        <button className="w-1/4 bg-green-greenMain hover:bg-green-greenMain2 text-white font-bold py-2 px-4 rounded my-10 ml-4">
          Enrolments
        </button>
      </Link>
    </div>
  );
};

export default TrainingData;
