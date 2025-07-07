import React from 'react';
import { Link } from 'react-router-dom';

const RISPLanding: React.FC = () => {
  return (
    <div className="container mx-auto px-4">
      <section>
        <p className="font-black capitalize text-2xl m-3 font-martaBold">
          Risk Information Sharing Platform
        </p>
        <div className="flex justify-evenly mx-8 items-center">
          <h3 className="text-lg mx-5 text-justify welcome-text">
            Welcome to the Risk Information Sharing Platform. <br /> This platform allows you to report and share information. <br /> Your input is crucial to help us monitor and manage health risks effectively. Please answer the questions below to share information about outbreaks, control and surveillance measures for the selected time period.
          </h3>
          
          <img 
            src="https://i.pinimg.com/736x/c4/ea/ef/c4eaef915005c7fd654630b396020a5d.jpg" 
            alt="Two cows standing in a field" 
            className="rounded-xl w-96 m-5"
          />
        </div>
      </section>
      <Link to="/risp/outbreak">
        <button className="w-1/4 bg-green-greenMain hover:bg-green-greenMain2 text-white font-bold py-2 px-4 rounded my-10">
          Continue
        </button>
      </Link>
    </div>
  );
};

export default RISPLanding;

// Add the specific styles for RISP
const style = document.createElement('style');
style.textContent = `
  .welcome-text {
    width: 30rem;
    line-height: 2.5rem;
  }
`;
document.head.appendChild(style);
