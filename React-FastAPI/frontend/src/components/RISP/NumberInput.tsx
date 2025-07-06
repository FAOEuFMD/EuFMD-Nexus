import React from 'react';

interface NumberInputProps {
  value: number | string;
  onChange: (value: number | string) => void;
  placeholder?: string;
}

const NumberInput: React.FC<NumberInputProps> = ({ value, onChange, placeholder = '' }) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <div>
      <input
        min="0"
        type="number"
        value={value}
        onChange={handleChange}
        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
        placeholder={placeholder}
      />
    </div>
  );
};

export default NumberInput;
