import React, { useState, useEffect } from 'react';

interface Country {
  id: number;
  name_un: string;
  lat: number;
  lon: number;
}

interface Procurement {
  id: number;
  stock_id: number;
  product: string;
  serotype: string;
  quantity: number;
  delivery_date: string;
  country_id: number;
  name_un: string;
  'LOA/DP': string;
  supplier: string;
  description: string;
  PO: string;
  expiry_date: string;
  report_usage: string;
  notes: string;
}

interface UniqueProduct {
  product: string;
  totalQuantity: number;
  letter: string;
  color: string;
}

const DiagnosticSupport: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Data states
  const [procurements, setProcurements] = useState<Procurement[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [pos, setPos] = useState<string[]>([]);
  const [selectedPO, setSelectedPO] = useState<string>('');
  
  // UI states
  const [isMapModalVisible, setIsMapModalVisible] = useState(false);
  const [isStockModalVisible, setIsStockModalVisible] = useState(false);
  const [isLOAModalVisible, setIsLOAModalVisible] = useState(false);
  const [isConfirmDeleteModalVisible, setIsConfirmDeleteModalVisible] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        getCountries(),
        getProcurements()
      ]);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const getCountries = async () => {
    try {
      const response = await fetch('/api/diagnostic-support/countries', {
        headers: {
          'x-access-token': localStorage.getItem('token') || '',
        },
      });
      const data = await response.json();
      setCountries(data.map((country: any) => ({
        name: country.name_un,
        id: country.id,
        lat: country.lat,
        lon: country.lon,
      })));
    } catch (error) {
      console.error('Error fetching countries:', error);
    }
  };

  const getProcurements = async () => {
    try {
      const response = await fetch('/api/diagnostic-support', {
        headers: {
          'x-access-token': localStorage.getItem('token') || '',
        },
      });
      const data = await response.json();
      
      // Ensure data is an array
      const procurementsData = Array.isArray(data) ? data : [];
      setProcurements(procurementsData);
      
      // Extract unique POs
      const poSet = new Set(procurementsData.map((proc: Procurement) => proc.PO));
      const uniquePOs: string[] = Array.from(poSet).filter((po): po is string => Boolean(po));
      setPos(uniquePOs);
    } catch (error) {
      console.error('Error fetching procurement data:', error);
      setProcurements([]); // Set empty array on error
    }
  };

  const showMapModal = () => {
    setIsMapModalVisible(true);
  };

  const closeMapModal = () => {
    setIsMapModalVisible(false);
  };

  const showStockModal = () => {
    setIsStockModalVisible(true);
  };

  const closeStockModal = () => {
    setIsStockModalVisible(false);
  };

  const showLOAModal = () => {
    setIsLOAModalVisible(true);
  };

  const closeLOAModal = () => {
    setIsLOAModalVisible(false);
  };

  const toggleDotsMenu = (id: number) => {
    if (!isConfirmDeleteModalVisible) {
      setActiveId(activeId === id ? null : id);
    }
  };

  const deleteEntry = (id: number) => {
    setIsConfirmDeleteModalVisible(true);
    setEntryToDelete(id);
  };

  const deleteConfirmed = async () => {
    if (entryToDelete === null) return;

    try {
      const deletedProcurement = procurements.find(proc => proc.id === entryToDelete);
      
      const response = await fetch(`/api/diagnostic-support/${entryToDelete}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': localStorage.getItem('token') || '',
        },
      });

      if (response.ok) {
        // Update stock quantity if needed
        if (deletedProcurement) {
          const stockId = deletedProcurement.stock_id;
          const quantityToUpdate = deletedProcurement.quantity;
          await fetch(`/api/stock/update/${stockId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'x-access-token': localStorage.getItem('token') || '',
            },
            body: JSON.stringify({ quantity: quantityToUpdate }),
          });
        }

        // Update local state
        setProcurements(procurements.filter(proc => proc.id !== entryToDelete));
        setIsConfirmDeleteModalVisible(false);
        alert('Entry deleted successfully');
      } else {
        alert('Error deleting entry');
      }
    } catch (error) {
      console.error('Error deleting diagnostic support entry:', error);
      alert('Error deleting entry');
    } finally {
      setEntryToDelete(null);
    }
  };

  const closeConfirmDeleteModal = () => {
    setIsConfirmDeleteModalVisible(false);
    setEntryToDelete(null);
  };

  // Computed values - ensure procurements is always an array
  const filteredProcurements = selectedPO 
    ? (procurements || []).filter(proc => proc.PO === selectedPO)
    : (procurements || []);

  const uniqueCountries = Array.from(new Set(filteredProcurements.map(item => item.country_id)));

  const totalQuantitiesByPO = filteredProcurements.reduce((total, proc) => total + proc.quantity, 0);

  // Generate matched countries for map modal integration
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const matchedCountries = countries.filter(country => 
    (procurements || []).some(proc => proc.country_id === country.id)
  );

  const uniqueProductsArray: UniqueProduct[] = (() => {
    const uniqueProducts: { [key: string]: UniqueProduct } = {};
    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
    let letterIndex = 0;

    (filteredProcurements || []).forEach(item => {
      if (!uniqueProducts[item.product]) {
        uniqueProducts[item.product] = {
          product: item.product,
          totalQuantity: 0,
          letter: letters[letterIndex] || 'z',
          color: colors[letterIndex % colors.length] || '#1f77b4',
        };
        letterIndex++;
      }
      uniqueProducts[item.product].totalQuantity += item.quantity;
    });

    return Object.values(uniqueProducts);
  })();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-xl">Loading diagnostic support data...</div>
      </div>
    );
  }

  return (
    <div className="container py-5 text-gray-800">
      <h1 className="font-black capitalize text-2xl my-3">
        Diagnostic Support
      </h1>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Content Wrapper Section */}
      <div className="content-wrapper">
        {/* Left Section - Graph Component */}
        <div className="component" id="graph-component">
          {/* Bar Graph */}
          <div className="graph mt-4">
            <div className="flex flex-row m-4 gap-4 rounded-xl bg-white border border-gray-300 shadow-md p-4">
              {/* Chart */}
              <div className="w-3/5 text-center text-xlg font-black border border-gray-300 rounded-lg p-4" style={{marginRight: '20px'}}>
                Products
              </div>

              {/* Color Legends */}
              <div className="w-2/5 mt-4 ml-4" style={{marginLeft: '20px'}}>
                <div className="mt-4">
                  {uniqueProductsArray.map((item, index) => (
                    <div key={index} className="flex items-center mb-2">
                      <div 
                        className="w-4 h-4 mr-2 rounded" 
                        style={{backgroundColor: item.color}}
                      ></div>
                      <span className="text-sm">{item.letter}. {item.product} ({item.totalQuantity})</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="w-1/5 mt-4 mr-4">
                <div className="grid grid-rows-2 h-full">
                  <div className="flex flex-col items-center justify-center">
                    <div 
                      className="text-center text-lg font-black pb-2 border-b-2 border-gray-300"
                      style={{borderColor: '#72aba7'}}
                    >
                      Countries
                    </div>
                    <div className="text-center text-4xl font-extrabold mt-2">
                      {uniqueCountries.length}
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center mt-2">
                    <div 
                      className="text-center text-lg font-black pb-2 border-b-2 border-gray-300"
                      style={{borderColor: '#72aba7'}}
                    >
                      Products sent
                    </div>
                    <div className="text-center text-4xl font-extrabold mt-1">
                      {totalQuantitiesByPO}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section - Map Component */}
        <div className="component" id="map-component">
          <img
            className="natural-map"
            src="/natural-map.png"
            alt="World map natural landscape"
          />
          <button
            className="stock-btn nav-btn absolute top-1/2 left-1/2 py-2 px-4 transform -translate-x-1/2 -translate-y-1/2"
            onClick={showMapModal}
          >
            View Full Map
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center mt-4">
        <button
          className="w-1/4 mt-4 nav-btn mb-4 text-white shadow-md hover:shadow-lg rounded-lg py-2 px-4 transform transition duration-300 ease-in-out"
          onClick={showLOAModal}
        >
          LOA
        </button>
        <button
          className="w-1/4 mt-4 nav-btn mb-4 text-white shadow-md hover:shadow-lg rounded-lg py-2 px-4 transform transition duration-300 ease-in-out"
          onClick={showStockModal}
        >
          Stock
        </button>
      </div>

      {/* Procurement Table */}
      <div className="table-wrapper relative overflow-auto hover:overflow-scroll">
        <div className="table-container">
          {filteredProcurements.length > 0 ? (
            <table className="w-full border bg-white text-center">
              <thead>
                <tr className="bg-greens text-white text-sm sticky top-0 z-20 font-medium uppercase tracking-wider whitespace-nowrap">
                  <th className="p-1">Product</th>
                  <th className="p-1">Serotype</th>
                  <th className="p-1">Quantity</th>
                  <th className="p-1">Delivery date</th>
                  <th className="p-1">Country</th>
                  <th className="p-1">LOA/DP</th>
                  <th className="p-1">Supplier</th>
                  <th className="p-1">Description</th>
                  <th className="px-5 py-1 text-left bg-greens text-white text-sm font-medium uppercase tracking-wider whitespace-nowrap">
                    <label htmlFor="poSelect" className="font-semibold"></label>
                    <select
                      value={selectedPO}
                      onChange={(e) => setSelectedPO(e.target.value)}
                      className="stock-btn text-white text-sm py-2 px-2 border border-white rounded-md cursor-pointer"
                    >
                      <option value="" className="">PO Select all</option>
                      {pos.map(po => (
                        <option key={po} value={po}>
                          {po}
                        </option>
                      ))}
                    </select>
                  </th>
                  <th className="p-1">Expiry date</th>
                  <th className="p-1">Usage</th>
                  <th className="p-1">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredProcurements.map((proc) => (
                  <tr
                    key={proc.id}
                    className={activeId === proc.id ? 'selected-row' : ''}
                  >
                    {/* Dropdown dots menu */}
                    <td className="px-5 py-8 relative">
                      <div
                        onClick={() => toggleDotsMenu(proc.id)}
                        className="absolute left-0 top-0 z-10 rounded-lg cursor-pointer p-1"
                      >
                        {/* 3 dots */}
                        <div className="relative flex flex-row gap-1 z-10">
                          <div className="w-1 h-1 rounded-full" style={{backgroundColor: '#15736d'}}></div>
                          <div className="w-1 h-1 rounded-full" style={{backgroundColor: '#15736d'}}></div>
                          <div className="w-1 h-1 rounded-full" style={{backgroundColor: '#15736d'}}></div>
                        </div>
                        {/* Dropdown options */}
                        {activeId === proc.id && (
                          <ul className="absolute left-full top-0 ml-2 -mt-2 bg-white shadow-lg rounded-md ring-1 ring-black ring-opacity-5 focus:outline-none py-2 z-50">
                            <li className="py-1 relative z-1000">
                              <div
                                className="block px-4 py-2 text-sm hover:bg-gray-100 hover:text-gray-900 cursor-pointer"
                                onClick={() => deleteEntry(proc.id)}
                              >
                                Delete
                              </div>
                            </li>
                          </ul>
                        )}
                      </div>
                      <span>{proc.product}</span>
                    </td>
                    <td className="px-5 py-8">{proc.serotype}</td>
                    <td className="px-5 py-8">{proc.quantity}</td>
                    <td className="px-5 py-8 whitespace-nowrap">{proc.delivery_date}</td>
                    <td className="px-5 py-8">{proc.name_un}</td>
                    <td className="px-5 py-8">{proc['LOA/DP']}</td>
                    <td className="px-5 py-8">{proc.supplier}</td>
                    <td className="px-5 py-8 description-cell">{proc.description}</td>
                    <td className="pl-5 pr-3 py-8 text-left cursor-pointer">{proc.PO}</td>
                    <td className="px-5 py-8 whitespace-nowrap">{proc.expiry_date}</td>
                    <td className="px-5 py-8">{proc.report_usage}</td>
                    <td className="px-5 py-8">{proc.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center text-large font-bold uppercase p-4">
              No Procurement Kits to display
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {isMapModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg overflow-hidden shadow-xl transform transition-all">
            <div className="p-4">
              <div style={{height: '400px', width: '800px'}}>
                <p className="text-center text-gray-600">Map view would be implemented here with Leaflet</p>
              </div>
            </div>
            <div className="p-4 flex justify-end">
              <button onClick={closeMapModal} className="close-btn nav-btn">Close</button>
            </div>
          </div>
        </div>
      )}

      {isStockModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg overflow-hidden shadow-xl transform transition-all">
            <div className="p-4">
              <h3 className="text-lg font-medium mb-4">Stock Management</h3>
              <p className="text-gray-600">Stock management interface would be implemented here</p>
            </div>
            <div className="p-4 flex justify-end">
              <button onClick={closeStockModal} className="close-btn nav-btn">Close</button>
            </div>
          </div>
        </div>
      )}

      {isLOAModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg overflow-hidden shadow-xl transform transition-all">
            <div className="p-4">
              <h3 className="text-lg font-medium mb-4">LOA Management</h3>
              <p className="text-gray-600">LOA management interface would be implemented here</p>
            </div>
            <div className="p-4 flex justify-end">
              <button onClick={closeLOAModal} className="close-btn nav-btn">Close</button>
            </div>
          </div>
        </div>
      )}

      {isConfirmDeleteModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg overflow-hidden shadow-xl transform transition-all">
            <div className="p-4">
              <h3 className="text-lg font-medium mb-4">Confirm Delete</h3>
              <p className="text-gray-600 mb-4">Delete this entry?</p>
            </div>
            <div className="p-4 flex justify-end space-x-2">
              <button onClick={closeConfirmDeleteModal} className="close-btn nav-btn">Cancel</button>
              <button onClick={deleteConfirmed} className="nav-btn bg-red-600 border-red-600">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiagnosticSupport;
