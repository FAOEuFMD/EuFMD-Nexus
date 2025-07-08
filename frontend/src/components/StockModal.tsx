import React, { useState, useEffect } from 'react';

interface Stock {
  id: number;
  'LOA/DP': string;
  supplier: string;
  PO: string;
  product: string;
  serotype: string;
  quantity: number;
  purchase_date: string;
  expiry_date: string;
  notes: string;
  isEditing?: boolean;
}

interface LOA {
  id: number;
  group: string;
  responsible: string;
  supplier: string;
  start_date: string;
  end_date: string;
  description: string;
  PO: string;
  FO: string;
}

interface Country {
  id: number;
  name_un: string;
  lat: number;
  lon: number;
}

interface StockModalProps {
  isVisible: boolean;
  countries: Country[];
  onClose: () => void;
}

const StockModal: React.FC<StockModalProps> = ({ isVisible, countries, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [originalStockEntries, setOriginalStockEntries] = useState<Stock[]>([]);
  const [uniquePOs, setUniquePOs] = useState<string[]>([]);
  const [selectedPO, setSelectedPO] = useState<string>('');
  const [LOAs, setLOAs] = useState<LOA[]>([]);
  const [POwithLOAsSet, setPOwithLOAsSet] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<number | null>(null);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [isConfirmDeleteModalVisible, setIsConfirmDeleteModalVisible] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null);
  const [isAddProcurementsVisible, setIsAddProcurementsVisible] = useState(false);
  const [isAddStockVisible, setIsAddStockVisible] = useState(false);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [isToggled, setIsToggled] = useState(false);

  // Form states for new stock
  const [stockType, setStockType] = useState('');
  const [selectedLOASupplier, setSelectedLOASupplier] = useState('');
  const [newStock, setNewStock] = useState({
    supplier: '',
    PO: '',
    product: '',
    serotype: '',
    quantity: 0,
    purchase_date: '',
    expiry_date: '',
    notes: ''
  });

  // Form states for new procurement
  const [newProcurement, setNewProcurement] = useState({
    product: '',
    serotype: '',
    quantity: 0,
    delivery_date: '',
    country_id: '',
    LOA_DP: '',
    supplier: '',
    description: '',
    PO: '',
    expiry_date: '',
    report_usage: '',
    notes: ''
  });

  const products = [
    "ELISA (SPCE) ",
    "FMDV 3 ABC-Trapping Elisa",
    "ELISA Antigen",
    "FMDV Antigen Detection ELISA",
    "Master Mix",
    "LFD Kit",
    "NSP Kit",
    "PCR Kit",
    "Extraction kit",
    "RNA Extraction kit",
    "FMDV SEROTYPE A-STRUCTURAL PROTEIN(SP)",
  ];

  const serotypes = [
    "serotype O",
    "serotype A",
    "serotype C",
    "SAT1",
    "SAT2",
    "SAT1-2",
    "Asia1",
    "FMDV O",
  ];

  useEffect(() => {
    if (isVisible) {
      getStocks();
      getLOAs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);

  const getStocks = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/stock', {
        headers: {
          'x-access-token': localStorage.getItem('token') || '',
        },
      });
      const stockItems = await response.json();
      
      if (!stockItems) {
        throw new Error("Error fetching stocks");
      }

      const stocksData = Array.isArray(stockItems) ? stockItems : [];
      setStocks(stocksData);

      // Getting unique POs
      const uniquePOsSet = new Set(stocksData.map((item: Stock) => item.PO));
      setUniquePOs(Array.from(uniquePOsSet).filter(po => Boolean(po)));

      // Get POs with LOAs
      await getPOwithLOA();
    } catch (error) {
      console.error("Error fetching stocks:", error);
      setStocks([]);
    } finally {
      setLoading(false);
    }
  };

  const getLOAs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/LOA', {
        headers: {
          'x-access-token': localStorage.getItem('token') || '',
        },
      });
      const LOAItems = await response.json();
      setLOAs(Array.isArray(LOAItems) ? LOAItems : []);
    } catch (error) {
      console.error("Error fetching LOAs:", error);
      setLOAs([]);
    } finally {
      setLoading(false);
    }
  };

  const getPOwithLOA = async () => {
    try {
      const response = await fetch('/api/LOA', {
        headers: {
          'x-access-token': localStorage.getItem('token') || '',
        },
      });
      const loas = await response.json();
      const loasData = Array.isArray(loas) ? loas : [];
      setPOwithLOAsSet(new Set(loasData.map((loa: LOA) => loa.PO)));
    } catch (error) {
      console.error("Error fetching LOAs:", error);
    }
  };

  const filteredStocks = selectedPO 
    ? stocks.filter(stock => stock.PO === selectedPO)
    : stocks;

  const loaPOs = Array.from(POwithLOAsSet);
  const isAnyRowEditing = filteredStocks.some(stock => stock.isEditing);

  const isPOwithLOA = (po: string) => {
    return loaPOs.includes(po);
  };

  const highlightSelectedProduct = (selectedStock: Stock) => {
    setHighlightedId(selectedStock.id);
  };

  const showDSModal = (stock: Stock) => {
    setSelectedStock(stock);
    setIsAddProcurementsVisible(true);
    highlightSelectedProduct(stock);
  };

  const showSMModal = () => {
    setIsAddStockVisible(true);
  };

  const toggleDotsMenu = (id: number) => {
    if (!isConfirmDeleteModalVisible) {
      if (activeId === id) {
        setActiveId(null);
        setIsToggled(false);
      } else {
        setActiveId(id);
        setIsToggled(true);
      }
    }
  };

  const editEntry = (id: number) => {
    const stock = filteredStocks.find(stock => stock.id === id);
    if (stock) {
      startEditing(stock);
    }
  };

  const startEditing = (stock: Stock) => {
    const originalStock = JSON.parse(JSON.stringify(stock));
    setOriginalStockEntries(prev => [...prev, originalStock]);
    setStocks(prev => prev.map(s => 
      s.id === stock.id ? { ...s, isEditing: true } : s
    ));
  };

  const saveChanges = async (stock: Stock) => {
    const originalStock = originalStockEntries.find(original => original.id === stock.id);
    if (!originalStock) return;

    const changes: any = {};
    for (const key in stock) {
      if (stock[key as keyof Stock] !== originalStock[key as keyof Stock]) {
        changes[key] = stock[key as keyof Stock];
      }
    }

    if (Object.keys(changes).length > 0) {
      try {
        const response = await fetch(`/api/stock/update/${stock.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-access-token': localStorage.getItem('token') || '',
          },
          body: JSON.stringify(changes),
        });

        if (response.ok) {
          alert('Changes saved successfully');
        } else {
          alert('Error saving changes');
        }
      } catch (error) {
        console.error("Error saving changes:", error);
        alert('Error saving changes');
      }
    }

    setStocks(prev => prev.map(s => 
      s.id === stock.id ? { ...s, isEditing: false } : s
    ));
    setOriginalStockEntries(prev => prev.filter(original => original.id !== stock.id));
  };

  const exitEditMode = (stock: Stock) => {
    const originalStock = originalStockEntries.find(original => original.id === stock.id);
    if (originalStock) {
      setStocks(prev => prev.map(s => 
        s.id === stock.id ? { ...originalStock, isEditing: false } : s
      ));
      setOriginalStockEntries(prev => prev.filter(original => original.id !== stock.id));
    }
    setActiveId(null);
  };

  const deleteEntry = (id: number) => {
    setIsConfirmDeleteModalVisible(true);
    setEntryToDelete(id);
  };

  const deleteConfirmed = async () => {
    if (entryToDelete === null) return;

    try {
      const response = await fetch(`/api/stock/${entryToDelete}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': localStorage.getItem('token') || '',
        },
      });

      if (response.ok) {
        setStocks(prev => prev.filter(stock => stock.id !== entryToDelete));
        setIsConfirmDeleteModalVisible(false);
        alert('Stock entry deleted successfully');
      } else {
        alert('Error deleting stock entry');
      }
    } catch (error) {
      console.error("Error deleting stock entry:", error);
      alert('Error deleting stock entry');
    } finally {
      setEntryToDelete(null);
    }
  };

  const closeConfirmDeleteModal = () => {
    setIsConfirmDeleteModalVisible(false);
    setEntryToDelete(null);
  };

  const handleInputChange = (field: string, value: string | number, stock: Stock) => {
    setStocks(prev => prev.map(s => 
      s.id === stock.id ? { ...s, [field]: value } : s
    ));
  };

  const handleAddProcurement = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedStock) return;

    try {
      const procurementData = {
        ...newProcurement,
        stock_id: selectedStock.id,
        product: selectedStock.product,
        serotype: selectedStock.serotype,
        supplier: selectedStock.supplier,
        PO: selectedStock.PO,
        'LOA/DP': isPOwithLOA(selectedStock.PO) ? 'LOA' : 'DP',
        expiry_date: selectedStock.expiry_date,
      };

      const response = await fetch('/api/diagnostic-support/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': localStorage.getItem('token') || '',
        },
        body: JSON.stringify(procurementData),
      });

      if (response.ok) {
        // Update stock quantity
        await fetch(`/api/stock/update/${selectedStock.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-access-token': localStorage.getItem('token') || '',
          },
          body: JSON.stringify({ quantity: -newProcurement.quantity }),
        });

        setIsAddProcurementsVisible(false);
        setNewProcurement({
          product: '',
          serotype: '',
          quantity: 0,
          delivery_date: '',
          country_id: '',
          LOA_DP: '',
          supplier: '',
          description: '',
          PO: '',
          expiry_date: '',
          report_usage: '',
          notes: ''
        });
        setHighlightedId(null);
        getStocks(); // Refresh the list
        alert('Procurement added successfully');
      } else {
        alert('Error adding procurement');
      }
    } catch (error) {
      console.error('Error adding procurement:', error);
      alert('Error adding procurement');
    }
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const stockData = {
        ...newStock,
        LOA_DP: stockType === 'LOA purchase' ? 'LOA' : 'DP',
      };

      const response = await fetch('/api/stock/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': localStorage.getItem('token') || '',
        },
        body: JSON.stringify(stockData),
      });

      if (response.ok) {
        setIsAddStockVisible(false);
        setNewStock({
          supplier: '',
          PO: '',
          product: '',
          serotype: '',
          quantity: 0,
          purchase_date: '',
          expiry_date: '',
          notes: ''
        });
        setStockType('');
        setSelectedLOASupplier('');
        getStocks(); // Refresh the list
        alert('Stock added successfully');
      } else {
        alert('Error adding stock');
      }
    } catch (error) {
      console.error('Error adding stock:', error);
      alert('Error adding stock');
    }
  };

  const closeModal = () => {
    setActiveId(null);
    setHighlightedId(null);
    onClose();
  };

  const handleCloseProcurementModal = () => {
    setIsAddProcurementsVisible(false);
    setHighlightedId(null);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 z-[9999]">
      <div className="modal-container bg-white mx-20 p-6 rounded shadow-lg w-full max-w-6xl">
        <div className="absolute top-4 right-4">
          {!isAddProcurementsVisible && !isAddStockVisible && (
            <button
              onClick={closeModal}
              disabled={isAnyRowEditing}
              className="close-btn nav-btn"
            >
              Close
            </button>
          )}
        </div>

        {loading && <div className="text-center my-4">Loading...</div>}

        <div className="flex flex-wrap">
          <div className={
            !isAddProcurementsVisible && !isAddStockVisible 
              ? 'w-full' 
              : 'w-2/4'
          }>
            <div className="grid grid-cols-6 gap-4">
              <div className="col-span-1">
                <select
                  value={selectedPO}
                  onChange={(e) => setSelectedPO(e.target.value)}
                  className="stock-btn text-white text-sm py-2 px-2 border border-white rounded-md cursor-pointer"
                >
                  <option value="">PO Select all</option>
                  {uniquePOs.map(po => (
                    <option key={po} value={po}>
                      {po}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-5 flex justify-between items-center">
                <div className="flex space-x-4 ml-24">
                  {!isAddProcurementsVisible && !isAddStockVisible && (
                    <button
                      onClick={showSMModal}
                      disabled={isAnyRowEditing || isToggled}
                      className="send-ds-btn nav-btn"
                    >
                      Add stock
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="table-container mt-4">
              {filteredStocks.length > 0 ? (
                <table className="w-full border bg-white text-center">
                  <thead>
                    <tr className="bg-greens text-white text-sm sticky top-0 z-20 font-medium tracking-wider whitespace-nowrap">
                      <th className="p-1">LOA/DP</th>
                      <th className="p-1">SUPPLIER</th>
                      <th className="p-1">PO</th>
                      <th className="p-1">PRODUCT</th>
                      <th className="p-1">SEROTYPE</th>
                      <th className="p-1">QUANTITY</th>
                      <th className="p-1">PURCHASE DATE</th>
                      <th className="p-1">EXPIRY DATE</th>
                      <th className="p-1">NOTES</th>
                      <th className="p-1">SEND DIAGNOSTIC SUPPORT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredStocks.map((stock) => (
                      <tr
                        key={stock.id}
                        style={{
                          backgroundColor: 
                            activeId === stock.id || highlightedId === stock.id
                              ? 'rgba(1, 80, 57, 0.1)'
                              : ''
                        }}
                      >
                        <td className="px-5 py-8 relative">
                          {/* X Button for edit mode */}
                          {stock.isEditing && (
                            <div
                              className="absolute left-0 top-0 z-20 rounded-lg cursor-pointer p-1"
                              onClick={() => exitEditMode(stock)}
                            >
                              <span className="block px-2 py-2 text-base font-bold text-gray-900 hover:bg-gray-100">
                                X
                              </span>
                            </div>
                          )}

                          {/* Dots menu */}
                          {!stock.isEditing && (
                            <div
                              onClick={() => toggleDotsMenu(stock.id)}
                              className="absolute left-0 top-0 z-10 rounded-lg cursor-pointer p-1"
                            >
                              <div className="relative flex flex-row gap-1 z-10">
                                <div className="w-1 h-1 rounded-full" style={{backgroundColor: '#15736d'}}></div>
                                <div className="w-1 h-1 rounded-full" style={{backgroundColor: '#15736d'}}></div>
                                <div className="w-1 h-1 rounded-full" style={{backgroundColor: '#15736d'}}></div>
                              </div>
                              {activeId === stock.id && (
                                <ul className="absolute left-full top-0 ml-2 -mt-2 mb-2 bg-white shadow-lg rounded-md ring-1 ring-black ring-opacity-5 focus:outline-none py-2 z-90">
                                  <li className="py-1 relative z-1002">
                                    <div
                                      className="block px-4 py-2 text-sm hover:bg-gray-100 hover:text-gray-900 cursor-pointer"
                                      onClick={() => editEntry(stock.id)}
                                    >
                                      Edit
                                    </div>
                                  </li>
                                  <li className="py-1 relative z-1002">
                                    <div
                                      className="block px-4 py-2 text-sm hover:bg-gray-100 hover:text-gray-900 cursor-pointer"
                                      onClick={() => deleteEntry(stock.id)}
                                    >
                                      Delete
                                    </div>
                                  </li>
                                </ul>
                              )}
                            </div>
                          )}
                          <span>{isPOwithLOA(stock.PO) ? "LOA" : "DP"}</span>
                        </td>
                        <td className="px-5 py-8">
                          {!stock.isEditing ? (
                            <span>{stock.supplier}</span>
                          ) : (
                            <input
                              value={stock.supplier}
                              onChange={(e) => handleInputChange('supplier', e.target.value, stock)}
                              onKeyUp={(e) => e.key === 'Enter' && saveChanges(stock)}
                              className="editable-input"
                            />
                          )}
                        </td>
                        <td className="px-5 py-8">{stock.PO}</td>
                        <td className="px-5 py-8">
                          {!stock.isEditing ? (
                            <span>{stock.product}</span>
                          ) : (
                            <select
                              value={stock.product}
                              onChange={(e) => handleInputChange('product', e.target.value, stock)}
                              onKeyUp={(e) => e.key === 'Enter' && saveChanges(stock)}
                              className="w-full border focus:ring-green-tom focus:border-green-tom focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                            >
                              {products.map(product => (
                                <option key={product} value={product}>
                                  {product}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-5 py-8">
                          {!stock.isEditing ? (
                            <span>{stock.serotype}</span>
                          ) : (
                            <select
                              value={stock.serotype}
                              onChange={(e) => handleInputChange('serotype', e.target.value, stock)}
                              onKeyUp={(e) => e.key === 'Enter' && saveChanges(stock)}
                              className="w-full border focus:ring-green-tom focus:border-green-tom focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                            >
                              {serotypes.map(serotype => (
                                <option key={serotype} value={serotype}>
                                  {serotype}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-5 py-8">
                          {!stock.isEditing ? (
                            <span>{stock.quantity}</span>
                          ) : (
                            <input
                              type="number"
                              value={stock.quantity}
                              onChange={(e) => handleInputChange('quantity', parseInt(e.target.value), stock)}
                              onKeyUp={(e) => e.key === 'Enter' && saveChanges(stock)}
                              className="editable-input"
                            />
                          )}
                        </td>
                        <td className="px-5 py-8 whitespace-nowrap">
                          {!stock.isEditing ? (
                            <span>{stock.purchase_date}</span>
                          ) : (
                            <input
                              type="date"
                              value={stock.purchase_date}
                              onChange={(e) => handleInputChange('purchase_date', e.target.value, stock)}
                              onKeyUp={(e) => e.key === 'Enter' && saveChanges(stock)}
                              className="editable-input"
                            />
                          )}
                        </td>
                        <td className="px-5 py-8 whitespace-nowrap">
                          {!stock.isEditing ? (
                            <span>{stock.expiry_date}</span>
                          ) : (
                            <input
                              type="date"
                              value={stock.expiry_date}
                              onChange={(e) => handleInputChange('expiry_date', e.target.value, stock)}
                              onKeyUp={(e) => e.key === 'Enter' && saveChanges(stock)}
                              className="editable-input"
                            />
                          )}
                        </td>
                        <td className="px-5 py-8">
                          {!stock.isEditing ? (
                            <span>{stock.notes}</span>
                          ) : (
                            <input
                              value={stock.notes}
                              onChange={(e) => handleInputChange('notes', e.target.value, stock)}
                              onKeyUp={(e) => e.key === 'Enter' && saveChanges(stock)}
                              className="editable-input"
                            />
                          )}
                        </td>
                        <td className="px-5 py-8">
                          <button
                            onClick={() => showDSModal(stock)}
                            disabled={isAnyRowEditing || isToggled}
                            className="send-ds-btn nav-btn"
                          >
                            Select
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center my-4">No stocks available.</div>
              )}
            </div>
          </div>

          <div className={
            !isAddProcurementsVisible && !isAddStockVisible 
              ? 'w-full' 
              : 'w-2/4'
          } style={{ position: 'relative' }}>
            {loading && <div className="text-center">Loading...</div>}

            {/* Add Procurements Modal */}
            {isAddProcurementsVisible && (
              <div className="bg-white w-full max-w-xl lg:max-w-2xl rounded-lg z-50 overflow-y-auto shadow-lg p-4 md:p-6 border-2 border-gray-300" style={{maxHeight: '90vh'}}>
                <div className="py-1 text-left px-8">
                  <div className="flex justify-end items-center mt-5">
                    <button
                      onClick={handleCloseProcurementModal}
                      className="cursor-pointer text-md hover:text-green-600 font-bold text-xl"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="flex flex-col p-5">
                    <form onSubmit={handleAddProcurement} className="mx-auto min-w-min px-4 pb-6">
                      {selectedStock && (
                        <div className="mb-5 p-4 bg-gray-100 rounded">
                          <h4 className="font-semibold mb-2">Selected Stock:</h4>
                          <p><strong>Product:</strong> {selectedStock.product}</p>
                          <p><strong>Serotype:</strong> {selectedStock.serotype}</p>
                          <p><strong>Available Quantity:</strong> {selectedStock.quantity}</p>
                          <p><strong>Supplier:</strong> {selectedStock.supplier}</p>
                          <p><strong>PO:</strong> {selectedStock.PO}</p>
                        </div>
                      )}

                      <div className="mb-5">
                        <label className="mb-2 font-semibold" htmlFor="LOAorDpurchase">
                          LOA or DP
                        </label>
                        <input
                          value={selectedStock ? (isPOwithLOA(selectedStock.PO) ? 'LOA' : 'DP') : ''}
                          readOnly
                          className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2 bg-gray-100"
                        />
                      </div>

                      <div className="mb-5">
                        <label className="mb-2 font-semibold" htmlFor="quantity">
                          Quantity
                        </label>
                        <input
                          value={newProcurement.quantity}
                          onChange={(e) => setNewProcurement(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                          type="number"
                          placeholder={`Maximum ${selectedStock?.quantity || 0}`}
                          max={selectedStock?.quantity || 0}
                          className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                          required
                        />
                      </div>

                      <div className="mb-5">
                        <label className="mb-2 font-semibold" htmlFor="delivery_date">
                          Delivery Date
                        </label>
                        <input
                          value={newProcurement.delivery_date}
                          onChange={(e) => setNewProcurement(prev => ({ ...prev, delivery_date: e.target.value }))}
                          type="date"
                          className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                          required
                        />
                      </div>

                      <div className="mb-5">
                        <label className="mb-2 font-semibold" htmlFor="country">
                          Country
                        </label>
                        <select
                          value={newProcurement.country_id}
                          onChange={(e) => setNewProcurement(prev => ({ ...prev, country_id: e.target.value }))}
                          className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                          required
                        >
                          <option value="">Select country</option>
                          {countries.map(country => (
                            <option key={country.id} value={country.id}>
                              {country.name_un}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="mb-5">
                        <label className="mb-2 font-semibold" htmlFor="description">
                          Description
                        </label>
                        <input
                          value={newProcurement.description}
                          onChange={(e) => setNewProcurement(prev => ({ ...prev, description: e.target.value }))}
                          type="text"
                          placeholder="Description"
                          className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                          required
                        />
                      </div>

                      <div className="mb-5">
                        <label className="mb-2 font-semibold" htmlFor="report_usage">
                          Usage
                        </label>
                        <input
                          value={newProcurement.report_usage}
                          onChange={(e) => setNewProcurement(prev => ({ ...prev, report_usage: e.target.value }))}
                          type="text"
                          placeholder="Usage"
                          className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                        />
                      </div>

                      <div className="mb-5">
                        <label className="mb-2 font-semibold" htmlFor="notes">
                          Notes
                        </label>
                        <textarea
                          value={newProcurement.notes}
                          onChange={(e) => setNewProcurement(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Notes"
                          className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                          rows={3}
                        />
                      </div>

                      <div className="flex justify-center mt-4">
                        <button 
                          className="nav-btn text-white border-2 border-green-600 px-4 py-2 rounded my-2 shadow-none hover:shadow-md hover:shadow-black/30 transition-all duration-300 ml-2" 
                          type="submit"
                        >
                          Send Diagnostic Support
                        </button>
                        <button 
                          className="nav-btn text-white border-2 border-green-600 px-4 py-2 rounded my-2 shadow-none hover:shadow-md hover:shadow-black/30 transition-all duration-300 ml-2" 
                          type="button"
                          onClick={handleCloseProcurementModal}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* Add Stock Modal */}
            {isAddStockVisible && (
              <div className="bg-white w-full max-w-xl lg:max-w-2xl rounded-lg z-50 overflow-y-auto shadow-lg p-4 md:p-6 border-2 border-gray-300" style={{maxHeight: '90vh'}}>
                <div className="py-1 text-left px-8">
                  <div className="flex justify-end items-center mt-5">
                    <button
                      onClick={() => setIsAddStockVisible(false)}
                      className="cursor-pointer text-md hover:text-green-600 font-bold text-xl"
                    >
                      ×
                    </button>
                  </div>
                  
                  <form onSubmit={handleAddStock} className="mx-auto min-w-min px-4 pb-6">
                    <div className="mb-5">
                      <div className="flex items-center mb-2">
                        <label className="inline-flex items-center text-sm">
                          <input
                            type="radio"
                            name="stockType"
                            value="Direct purchase"
                            checked={stockType === 'Direct purchase'}
                            onChange={(e) => setStockType(e.target.value)}
                            className="mr-2 w-5 h-5 text-green-600 focus:ring-green-600 border-gray-300"
                            required
                          />
                          Direct purchase
                        </label>
                      </div>

                      <div>
                        <label className="inline-flex items-center text-sm">
                          <input
                            type="radio"
                            name="stockType"
                            value="LOA purchase"
                            checked={stockType === 'LOA purchase'}
                            onChange={(e) => setStockType(e.target.value)}
                            className="mr-2 w-5 h-5 text-green-600 focus:ring-green-600 border-gray-300"
                            required
                          />
                          LOA purchase
                        </label>
                      </div>
                    </div>

                    {(stockType === 'Direct purchase' || stockType === 'LOA purchase') && (
                      <div>
                        <div className="mb-5">
                          {stockType === 'Direct purchase' && (
                            <>
                              <label className="mb-2 font-semibold" htmlFor="supplier">
                                Supplier
                              </label>
                              <input
                                value={newStock.supplier}
                                onChange={(e) => setNewStock(prev => ({ ...prev, supplier: e.target.value }))}
                                id="supplier"
                                type="text"
                                placeholder="supplier"
                                className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                                required
                              />
                              <label className="mb-2 font-semibold" htmlFor="PO">PO</label>
                              <input
                                value={newStock.PO}
                                onChange={(e) => setNewStock(prev => ({ ...prev, PO: e.target.value }))}
                                id="PO"
                                type="text"
                                placeholder="PO"
                                className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                                required
                              />
                            </>
                          )}

                          {stockType === 'LOA purchase' && (
                            <>
                              <label className="mb-2 font-semibold" htmlFor="supplier">
                                Supplier
                              </label>
                              <select
                                value={selectedLOASupplier}
                                onChange={(e) => {
                                  setSelectedLOASupplier(e.target.value);
                                  // Auto-fill PO when supplier is selected
                                  const selectedLOA = LOAs.find(loa => loa.supplier === e.target.value);
                                  if (selectedLOA) {
                                    setNewStock(prev => ({ ...prev, PO: selectedLOA.PO, supplier: selectedLOA.supplier }));
                                  }
                                }}
                                id="supplier"
                                className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                                required
                              >
                                <option value="">Select supplier</option>
                                {LOAs.map(loa => (
                                  <option key={loa.id} value={loa.supplier}>
                                    {loa.supplier}
                                  </option>
                                ))}
                              </select>

                              <label className="mb-2 font-semibold" htmlFor="POfromLOA">PO</label>
                              <input
                                value={newStock.PO}
                                onChange={(e) => setNewStock(prev => ({ ...prev, PO: e.target.value }))}
                                id="POfromLOA"
                                className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                                required
                              />
                            </>
                          )}

                          <label className="mb-2 font-semibold" htmlFor="product">Product</label>
                          <select
                            value={newStock.product}
                            onChange={(e) => setNewStock(prev => ({ ...prev, product: e.target.value }))}
                            className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                            required
                          >
                            <option value="">Select product</option>
                            {products.map(product => (
                              <option key={product} value={product}>
                                {product}
                              </option>
                            ))}
                          </select>

                          <label className="mb-2 font-semibold" htmlFor="serotype">Serotype</label>
                          <select
                            value={newStock.serotype}
                            onChange={(e) => setNewStock(prev => ({ ...prev, serotype: e.target.value }))}
                            className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                            required
                          >
                            <option value="">Select serotype</option>
                            {serotypes.map(serotype => (
                              <option key={serotype} value={serotype}>
                                {serotype}
                              </option>
                            ))}
                          </select>

                          <label className="mb-2 font-semibold" htmlFor="quantity">Quantity</label>
                          <input
                            value={newStock.quantity}
                            onChange={(e) => setNewStock(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                            type="number"
                            placeholder="quantity"
                            className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                            required
                          />

                          <label className="mb-2 font-semibold" htmlFor="purchase_date">Purchase Date</label>
                          <input
                            value={newStock.purchase_date}
                            onChange={(e) => setNewStock(prev => ({ ...prev, purchase_date: e.target.value }))}
                            type="date"
                            className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                            required
                          />

                          <label className="mb-2 font-semibold" htmlFor="expiry_date">Expiry Date</label>
                          <input
                            value={newStock.expiry_date}
                            onChange={(e) => setNewStock(prev => ({ ...prev, expiry_date: e.target.value }))}
                            type="date"
                            className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                            required
                          />

                          <label className="mb-2 font-semibold" htmlFor="notes">Notes</label>
                          <input
                            value={newStock.notes}
                            onChange={(e) => setNewStock(prev => ({ ...prev, notes: e.target.value }))}
                            type="text"
                            placeholder="notes"
                            className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                          />
                        </div>

                        <div className="flex justify-center mt-4">
                          <button 
                            className="nav-btn text-white border-2 border-green-600 px-4 py-2 rounded my-2 shadow-none hover:shadow-md hover:shadow-black/30 transition-all duration-300 ml-2" 
                            type="submit"
                          >
                            Add Stock
                          </button>
                          <button 
                            className="nav-btn text-white border-2 border-green-600 px-4 py-2 rounded my-2 shadow-none hover:shadow-md hover:shadow-black/30 transition-all duration-300 ml-2" 
                            type="button"
                            onClick={() => setIsAddStockVisible(false)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Confirm Delete Modal */}
        {isConfirmDeleteModalVisible && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg overflow-hidden shadow-xl transform transition-all">
              <div className="p-4">
                <h3 className="text-lg font-medium mb-4">Confirm Delete</h3>
                <p className="text-gray-600 mb-4">Delete this stock entry?</p>
              </div>
              <div className="p-4 flex justify-end space-x-2">
                <button onClick={closeConfirmDeleteModal} className="nav-btn">Cancel</button>
                <button onClick={deleteConfirmed} className="nav-btn bg-red-600 border-red-600">Confirm</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockModal;
