import React, { useState, useEffect } from 'react';

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
  isEditing?: boolean;
}

interface LOAModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const LOAModal: React.FC<LOAModalProps> = ({ isVisible, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [LOAs, setLOAs] = useState<LOA[]>([]);
  const [originalLOAs, setOriginalLOAs] = useState<LOA[]>([]);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [sortColumn, setSortColumn] = useState<string>('');
  const [isConfirmDeleteModalVisible, setIsConfirmDeleteModalVisible] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);

  // Add LOA form state
  const [newLOA, setNewLOA] = useState({
    group: '',
    responsible: '',
    supplier: '',
    start_date: '',
    end_date: '',
    description: '',
    PO: '',
    FO: ''
  });

  useEffect(() => {
    if (isVisible) {
      getLOAs();
    }
  }, [isVisible]);

  const getLOAs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/LOA', {
        headers: {
          'x-access-token': localStorage.getItem('token') || '',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const loasData = Array.isArray(data) ? data : [];
        setLOAs(loasData);
        setOriginalLOAs(loasData);
      } else {
        console.error('LOA API endpoint not found, using empty array');
        setLOAs([]);
        setOriginalLOAs([]);
      }
    } catch (error) {
      console.error('Error fetching LOAs:', error);
      setLOAs([]);
      setOriginalLOAs([]);
    } finally {
      setLoading(false);
    }
  };

  const sortByDate = (column: string) => {
    if (sortColumn === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortOrder('asc');
    }
  };

  const sortedLOAs = () => {
    if (!sortColumn || !Array.isArray(LOAs)) return LOAs || [];
    
    return [...LOAs].sort((a, b) => {
      const dateA = new Date(a[sortColumn as keyof LOA] as string);
      const dateB = new Date(b[sortColumn as keyof LOA] as string);
      
      if (sortOrder === 'asc') {
        return dateA.getTime() - dateB.getTime();
      } else {
        return dateB.getTime() - dateA.getTime();
      }
    });
  };

  const isExpired = (endDate: string) => {
    const currentDate = new Date();
    const expirationDate = new Date(endDate);
    return expirationDate < currentDate;
  };

  const toggleDotsMenu = (id: number) => {
    if (!isConfirmDeleteModalVisible) {
      setActiveId(activeId === id ? null : id);
    }
  };

  const editEntry = (id: number) => {
    const item = LOAs.find((item) => item.id === id);
    if (item) {
      startEditing(item);
    }
  };

  const startEditing = (item: LOA) => {
    const originalItem = JSON.parse(JSON.stringify(item));
    setOriginalLOAs(prev => [...prev, originalItem]);
    
    setLOAs(prev => prev.map(loa => 
      loa.id === item.id ? { ...loa, isEditing: true } : loa
    ));
    setActiveId(null);
  };

  const saveChanges = async (item: LOA) => {
    if (!item.isEditing) return;

    const originalItem = originalLOAs.find(original => original.id === item.id);
    const changes: any = {};

    if (originalItem) {
      for (const key in item) {
        if (item[key as keyof LOA] !== originalItem[key as keyof LOA]) {
          changes[key] = item[key as keyof LOA];
        }
      }
    }

    if (Object.keys(changes).length > 0) {
      try {
        await fetch(`/api/LOA/update/${item.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-access-token': localStorage.getItem('token') || '',
          },
          body: JSON.stringify(changes),
        });
        alert('Changes saved successfully');
      } catch (error) {
        console.error('Error saving changes:', error);
        alert('Error saving changes');
      }
    }

    setLOAs(prev => prev.map(loa => 
      loa.id === item.id ? { ...loa, isEditing: false } : loa
    ));
    setOriginalLOAs(prev => prev.filter(original => original.id !== item.id));
  };

  const exitEditMode = (item: LOA) => {
    const originalItem = originalLOAs.find(original => original.id === item.id);
    
    if (originalItem) {
      setLOAs(prev => prev.map(loa => 
        loa.id === item.id ? { ...originalItem, isEditing: false } : loa
      ));
      setOriginalLOAs(prev => prev.filter(original => original.id !== item.id));
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
      await fetch(`/api/LOA/${entryToDelete}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': localStorage.getItem('token') || '',
        },
      });
      
      setLOAs(prev => prev.filter(item => item.id !== entryToDelete));
      setIsConfirmDeleteModalVisible(false);
      alert('Entry deleted successfully');
    } catch (error) {
      console.error('Error deleting LOA entry:', error);
      alert('Error deleting entry');
    } finally {
      setEntryToDelete(null);
    }
  };

  const closeConfirmDeleteModal = () => {
    setIsConfirmDeleteModalVisible(false);
    setEntryToDelete(null);
  };

  const handleAddLOA = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/LOA/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': localStorage.getItem('token') || '',
        },
        body: JSON.stringify(newLOA),
      });

      if (response.ok) {
        setShowAddModal(false);
        setNewLOA({
          group: '',
          responsible: '',
          supplier: '',
          start_date: '',
          end_date: '',
          description: '',
          PO: '',
          FO: ''
        });
        getLOAs(); // Refresh the list
        alert('LOA added successfully');
      } else {
        alert('Error adding LOA');
      }
    } catch (error) {
      console.error('Error adding LOA:', error);
      alert('Error adding LOA');
    }
  };

  const handleInputChange = (field: string, value: string, item: LOA) => {
    setLOAs(prev => prev.map(loa => 
      loa.id === item.id ? { ...loa, [field]: value } : loa
    ));
  };

  const isAnyRowEditing = Array.isArray(LOAs) ? LOAs.some(item => item.isEditing) : false;

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 z-[9999]">
      <div className="modal-container bg-white mx-20 p-6 rounded shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => setShowAddModal(true)}
            disabled={isAnyRowEditing}
            className="nav-btn w-1/4"
          >
            Add new LOA
          </button>
          <div>
            <button
              onClick={onClose}
              disabled={isAnyRowEditing}
              className="close-btn nav-btn"
            >
              Close
            </button>
          </div>
        </div>

        {loading && <div className="text-center my-4">Loading...</div>}

        <div className="table-container">
          {LOAs.length > 0 ? (
            <table className="w-full border bg-white text-center">
              <thead className="sticky-header sticky">
                <tr className="bg-greens text-white text-sm sticky top-0 font-medium uppercase tracking-wider whitespace-nowrap">
                  <th className="p-1 sticky">Group</th>
                  <th className="p-1">Responsible</th>
                  <th className="p-1">Supplier</th>
                  <th className="p-1">
                    Start date
                    <button 
                      onClick={() => sortByDate('start_date')} 
                      className="ml-2 px-2 py-1 bg-gray-300 rounded text-black"
                    >
                      Sort
                    </button>
                  </th>
                  <th className="p-1">
                    End date
                    <button 
                      onClick={() => sortByDate('end_date')} 
                      className="ml-2 px-2 py-1 bg-gray-300 rounded text-black"
                    >
                      Sort
                    </button>
                  </th>
                  <th className="p-1">Description</th>
                  <th className="p-1">PO</th>
                  <th className="p-1">FO</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedLOAs().map((item) => (
                  <tr
                    key={item.id}
                    className={`${
                      activeId === item.id ? 'selected-row' : ''
                    } ${isExpired(item.end_date) ? 'expired-row' : ''}`}
                  >
                    {/* Group column with dots menu */}
                    <td className="px-5 py-8 relative">
                      {item.isEditing ? (
                        <div
                          className="absolute left-0 top-0 z-20 rounded-lg cursor-pointer p-1"
                          onClick={() => exitEditMode(item)}
                        >
                          <span className="block px-2 py-2 text-base font-bold text-gray-900 hover:bg-gray-100">
                            X
                          </span>
                        </div>
                      ) : (
                        <div
                          onClick={() => toggleDotsMenu(item.id)}
                          className="absolute left-0 top-0 z-10 rounded-lg cursor-pointer p-1"
                        >
                          <div className="relative flex flex-row gap-1 z-10">
                            <div className="w-1 h-1 rounded-full" style={{backgroundColor: '#15736d'}}></div>
                            <div className="w-1 h-1 rounded-full" style={{backgroundColor: '#15736d'}}></div>
                            <div className="w-1 h-1 rounded-full" style={{backgroundColor: '#15736d'}}></div>
                          </div>
                          {activeId === item.id && (
                            <ul className="absolute left-full top-0 ml-2 -mt-2 bg-white shadow-lg rounded-md ring-1 ring-black ring-opacity-5 focus:outline-none py-2 z-50">
                              <li className="py-1 relative z-1002">
                                <div
                                  className="block px-4 py-2 text-sm hover:bg-gray-100 hover:text-gray-900 cursor-pointer"
                                  onClick={() => editEntry(item.id)}
                                >
                                  Edit
                                </div>
                              </li>
                              <li className="py-1 relative z-1002">
                                <div
                                  className="block px-4 py-2 text-sm hover:bg-gray-100 hover:text-gray-900 cursor-pointer"
                                  onClick={() => deleteEntry(item.id)}
                                >
                                  Delete
                                </div>
                              </li>
                            </ul>
                          )}
                        </div>
                      )}
                      {item.isEditing ? (
                        <input
                          value={item.group}
                          onChange={(e) => handleInputChange('group', e.target.value, item)}
                          onKeyPress={(e) => e.key === 'Enter' && saveChanges(item)}
                          className="editable-input"
                        />
                      ) : (
                        <span>{item.group}</span>
                      )}
                    </td>

                    {/* Responsible */}
                    <td className="px-5 py-3">
                      {item.isEditing ? (
                        <input
                          value={item.responsible}
                          onChange={(e) => handleInputChange('responsible', e.target.value, item)}
                          onKeyPress={(e) => e.key === 'Enter' && saveChanges(item)}
                          className="editable-input"
                        />
                      ) : (
                        <span>{item.responsible}</span>
                      )}
                    </td>

                    {/* Supplier */}
                    <td className="px-5 py-3">
                      {item.isEditing ? (
                        <input
                          value={item.supplier}
                          onChange={(e) => handleInputChange('supplier', e.target.value, item)}
                          onKeyPress={(e) => e.key === 'Enter' && saveChanges(item)}
                          className="editable-input"
                        />
                      ) : (
                        <span>{item.supplier}</span>
                      )}
                    </td>

                    {/* Start Date */}
                    <td className="px-5 py-3 whitespace-nowrap">
                      {item.isEditing ? (
                        <input
                          type="date"
                          value={item.start_date}
                          onChange={(e) => handleInputChange('start_date', e.target.value, item)}
                          onKeyPress={(e) => e.key === 'Enter' && saveChanges(item)}
                          className="editable-input"
                        />
                      ) : (
                        <span>{item.start_date}</span>
                      )}
                    </td>

                    {/* End Date */}
                    <td className="px-5 py-3 whitespace-nowrap">
                      {item.isEditing ? (
                        <input
                          type="date"
                          value={item.end_date}
                          onChange={(e) => handleInputChange('end_date', e.target.value, item)}
                          onKeyPress={(e) => e.key === 'Enter' && saveChanges(item)}
                          className="editable-input"
                        />
                      ) : (
                        <span>{item.end_date}</span>
                      )}
                    </td>

                    {/* Description */}
                    <td className="px-5 py-3 description-cell">
                      {item.isEditing ? (
                        <input
                          value={item.description}
                          onChange={(e) => handleInputChange('description', e.target.value, item)}
                          onKeyPress={(e) => e.key === 'Enter' && saveChanges(item)}
                          className="editable-input"
                        />
                      ) : (
                        <span>{item.description}</span>
                      )}
                    </td>

                    {/* PO */}
                    <td className="px-5 py-3">
                      {item.isEditing ? (
                        <input
                          value={item.PO}
                          onChange={(e) => handleInputChange('PO', e.target.value, item)}
                          onKeyPress={(e) => e.key === 'Enter' && saveChanges(item)}
                          className="editable-input"
                        />
                      ) : (
                        <span>{item.PO}</span>
                      )}
                    </td>

                    {/* FO */}
                    <td className="px-5 py-3">
                      {item.isEditing ? (
                        <select
                          value={item.FO}
                          onChange={(e) => handleInputChange('FO', e.target.value, item)}
                          onKeyPress={(e) => e.key === 'Enter' && saveChanges(item)}
                          className="editable-input"
                        >
                          <option disabled value="">Select FO</option>
                          <option value="F1">F1</option>
                          <option value="F2">F2</option>
                          <option value="F3">F3</option>
                        </select>
                      ) : (
                        <span>{item.FO}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center my-4">No LOAs available.</div>
          )}
        </div>

        {/* Add LOA Modal */}
        {showAddModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 z-[99999]">
            <div className="bg-white w-full max-w-xl lg:max-w-2xl rounded-lg z-[999999] overflow-y-auto shadow-lg p-4 md:p-6 border-2 border-gray-300" style={{maxHeight: '90vh'}}>
              <div className="py-1 text-left px-8">
                <div className="flex justify-end items-center mt-5">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="cursor-pointer text-md hover:text-green-600 font-bold text-xl"
                  >
                    ×
                  </button>
                </div>
                <div className="flex flex-col p-5">
                  <form onSubmit={handleAddLOA} className="mx-auto min-w-min px-4 pb-6">
                    <div className="mb-5">
                      <label className="mb-2 font-semibold block" htmlFor="group">Group</label>
                      <input
                        value={newLOA.group}
                        onChange={(e) => setNewLOA({...newLOA, group: e.target.value})}
                        id="group"
                        type="text"
                        placeholder="group"
                        className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                        required
                      />
                    </div>
                    <div className="mb-5">
                      <label className="mb-2 font-semibold block" htmlFor="responsible">Responsible</label>
                      <input
                        value={newLOA.responsible}
                        onChange={(e) => setNewLOA({...newLOA, responsible: e.target.value})}
                        id="responsible"
                        type="text"
                        placeholder="responsible"
                        className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                        required
                      />
                    </div>
                    <div className="mb-5">
                      <label className="mb-2 font-semibold block" htmlFor="supplier">Supplier</label>
                      <input
                        value={newLOA.supplier}
                        onChange={(e) => setNewLOA({...newLOA, supplier: e.target.value})}
                        id="supplier"
                        type="text"
                        placeholder="supplier"
                        className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                        required
                      />
                    </div>
                    <div className="mb-5">
                      <label className="mb-2 font-semibold block" htmlFor="start_date">Start date</label>
                      <input
                        value={newLOA.start_date}
                        onChange={(e) => setNewLOA({...newLOA, start_date: e.target.value})}
                        id="start_date"
                        type="date"
                        className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                        required
                      />
                    </div>
                    <div className="mb-5">
                      <label className="mb-2 font-semibold block" htmlFor="end_date">End date</label>
                      <input
                        value={newLOA.end_date}
                        onChange={(e) => setNewLOA({...newLOA, end_date: e.target.value})}
                        id="end_date"
                        type="date"
                        className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                        required
                      />
                    </div>
                    <div className="mb-5">
                      <label className="mb-2 font-semibold block" htmlFor="description">Description</label>
                      <textarea
                        value={newLOA.description}
                        onChange={(e) => setNewLOA({...newLOA, description: e.target.value})}
                        id="description"
                        placeholder="description"
                        className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                        required
                      />
                    </div>
                    <div className="mb-5">
                      <label className="mb-2 font-semibold block" htmlFor="PO">PO</label>
                      <input
                        value={newLOA.PO}
                        onChange={(e) => setNewLOA({...newLOA, PO: e.target.value})}
                        id="PO"
                        type="text"
                        placeholder="PO"
                        className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                        required
                      />
                    </div>
                    <div className="mb-5">
                      <label className="mb-2 font-semibold block" htmlFor="FO">FO</label>
                      <select
                        value={newLOA.FO}
                        onChange={(e) => setNewLOA({...newLOA, FO: e.target.value})}
                        id="FO"
                        className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                        required
                      >
                        <option disabled value="">Select FO</option>
                        <option value="F1">F1</option>
                        <option value="F2">F2</option>
                        <option value="F3">F3</option>
                      </select>
                    </div>
                    <div className="flex justify-center gap-4 mt-6">
                      <button
                        type="submit"
                        className="nav-btn px-6 py-2"
                      >
                        Add LOA
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddModal(false)}
                        className="nav-btn px-6 py-2"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Delete Modal */}
        {isConfirmDeleteModalVisible && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg overflow-hidden shadow-xl transform transition-all">
              <div className="p-4">
                <h3 className="text-lg font-medium mb-4">Confirm Delete</h3>
                <p className="text-gray-600 mb-4">Delete this entry?</p>
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

export default LOAModal;
