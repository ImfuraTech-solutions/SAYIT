import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

// Types
interface AdminProfile {
  _id: string;
  name: string;
  email: string;
  role: string;
  profileImage?: string;
  lastLogin?: string;
}

interface Agency {
  _id: string;
  name: string;
  logo?: string;
}

interface Agent {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  profileImage?: string;
  agency: Agency;
  position?: string;
  employeeId?: string;
  department?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AgentFormData {
  name: string;
  email: string;
  phone: string;
  position: string;
  employeeId: string;
  department: string;
  agency: string;
  isActive: boolean;
}

interface AgentManagementProps {
  adminProfile: AdminProfile | null;
}

const AdAgentManagement: React.FC<AgentManagementProps> = ({ adminProfile }) => {
  // State
  const [agents, setAgents] = useState<Agent[]>([]);
  
  // Log admin activity
  useEffect(() => {
    if (adminProfile) {
      console.log(`Agent Management accessed by admin: ${adminProfile.name} (${adminProfile.email})`);
    }
  }, [adminProfile]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showViewModal, setShowViewModal] = useState<boolean>(false);
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [filterAgency, setFilterAgency] = useState<string>('');
  const [formData, setFormData] = useState<AgentFormData>({
    name: '',
    email: '',
    phone: '',
    position: '',
    employeeId: '',
    department: '',
    agency: '',
    isActive: true
  });
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Fetch agents
  const fetchAgents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get('/api/admin/agents');
      if (response.data.success) {
        setAgents(response.data.data);
      } else {
        setError('Failed to fetch agents');
        toast.error('Could not load agents');
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
      setError('An error occurred while fetching agents');
      toast.error('Failed to load agents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch agencies for dropdown
  const fetchAgencies = useCallback(async () => {
    try {
      const response = await axios.get('/api/admin/agencies');
      if (response.data.success) {
        setAgencies(response.data.data);
      } else {
        toast.error('Could not load agencies');
      }
    } catch (error) {
      console.error('Error fetching agencies:', error);
      toast.error('Failed to load agencies');
    }
  }, []);

  // Initialize component
  useEffect(() => {
    fetchAgents();
    fetchAgencies();
  }, [fetchAgents, fetchAgencies]);

  // Form handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checkbox = e.target as HTMLInputElement;
      setFormData({
        ...formData,
        [name]: checkbox.checked
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfileImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Modal handlers
  const openAddModal = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      position: '',
      employeeId: '',
      department: '',
      agency: agencies.length > 0 ? agencies[0]._id : '',
      isActive: true
    });
    setProfileImage(null);
    setPreviewImage(null);
    setShowAddModal(true);
  };

  const openEditModal = (agent: Agent) => {
    setCurrentAgent(agent);
    setFormData({
      name: agent.name,
      email: agent.email,
      phone: agent.phone || '',
      position: agent.position || '',
      employeeId: agent.employeeId || '',
      department: agent.department || '',
      agency: agent.agency._id,
      isActive: agent.isActive
    });
    setPreviewImage(agent.profileImage || null);
    setProfileImage(null);
    setShowEditModal(true);
  };

  const openDeleteModal = (agent: Agent) => {
    setCurrentAgent(agent);
    setShowDeleteModal(true);
  };

  const openViewModal = (agent: Agent) => {
    setCurrentAgent(agent);
    setShowViewModal(true);
  };

  const closeAllModals = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setShowDeleteModal(false);
    setShowViewModal(false);
    setCurrentAgent(null);
    setProfileImage(null);
    setPreviewImage(null);
  };

  // CRUD operations
  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const formDataObj = new FormData();
      formDataObj.append('name', formData.name);
      formDataObj.append('email', formData.email);
      formDataObj.append('phone', formData.phone);
      formDataObj.append('position', formData.position);
      formDataObj.append('employeeId', formData.employeeId);
      formDataObj.append('department', formData.department);
      formDataObj.append('agency', formData.agency);
      formDataObj.append('isActive', formData.isActive.toString());
      
      if (profileImage) {
        formDataObj.append('profileImage', profileImage);
      }
      
      const response = await axios.post('/api/admin/agents', formDataObj);
      
      if (response.data.success) {
        toast.success('Agent added successfully');
        fetchAgents();
        closeAllModals();
      } else {
        toast.error(response.data.message || 'Failed to add agent');
      }
    } catch (error: any) {
      console.error('Error adding agent:', error);
      toast.error(error.response?.data?.message || 'An error occurred while adding the agent');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAgent) return;
    
    setIsLoading(true);
    
    try {
      const formDataObj = new FormData();
      formDataObj.append('name', formData.name);
      formDataObj.append('email', formData.email);
      formDataObj.append('phone', formData.phone);
      formDataObj.append('position', formData.position);
      formDataObj.append('employeeId', formData.employeeId);
      formDataObj.append('department', formData.department);
      formDataObj.append('agency', formData.agency);
      formDataObj.append('isActive', formData.isActive.toString());
      
      if (profileImage) {
        formDataObj.append('profileImage', profileImage);
      }
      
      const response = await axios.put(`/api/admin/agents/${currentAgent._id}`, formDataObj);
      
      if (response.data.success) {
        toast.success('Agent updated successfully');
        fetchAgents();
        closeAllModals();
      } else {
        toast.error(response.data.message || 'Failed to update agent');
      }
    } catch (error: any) {
      console.error('Error updating agent:', error);
      toast.error(error.response?.data?.message || 'An error occurred while updating the agent');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAgent = async () => {
    if (!currentAgent) return;
    
    setIsLoading(true);
    
    try {
      const response = await axios.delete(`/api/admin/agents/${currentAgent._id}`);
      
      if (response.data.success) {
        toast.success('Agent deleted successfully');
        fetchAgents();
        closeAllModals();
      } else {
        toast.error(response.data.message || 'Failed to delete agent');
      }
    } catch (error: any) {
      console.error('Error deleting agent:', error);
      toast.error(error.response?.data?.message || 'An error occurred while deleting the agent');
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle agent active status
  const toggleAgentStatus = async (agent: Agent) => {
    setIsLoading(true);
    
    try {
      const response = await axios.put(`/api/admin/agents/${agent._id}/toggle-status`, {
        isActive: !agent.isActive
      });
      
      if (response.data.success) {
        toast.success(`Agent ${agent.isActive ? 'deactivated' : 'activated'} successfully`);
        fetchAgents();
      } else {
        toast.error(response.data.message || 'Failed to update agent status');
      }
    } catch (error: any) {
      console.error('Error toggling agent status:', error);
      toast.error(error.response?.data?.message || 'An error occurred while updating agent status');
    } finally {
      setIsLoading(false);
    }
  };

  // Send setup email to agent
  const sendSetupEmail = async (agent: Agent) => {
    setIsLoading(true);
    
    try {
      const response = await axios.post(`/api/admin/agents/${agent._id}/send-setup-email`);
      
      if (response.data.success) {
        toast.success('Account setup email sent successfully');
      } else {
        toast.error(response.data.message || 'Failed to send setup email');
      }
    } catch (error: any) {
      console.error('Error sending setup email:', error);
      toast.error(error.response?.data?.message || 'An error occurred while sending setup email');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate access code for password reset
  const generateAccessCode = async (agent: Agent) => {
    setIsLoading(true);
    
    try {
      const response = await axios.post(`/api/admin/generate-access-code/agent/${agent._id}`);
      
      if (response.data.success) {
        toast.success('Access code generated and sent to agent\'s email');
      } else {
        toast.error(response.data.message || 'Failed to generate access code');
      }
    } catch (error: any) {
      console.error('Error generating access code:', error);
      toast.error(error.response?.data?.message || 'An error occurred while generating access code');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter agents
  const filteredAgents = agents.filter(agent => {
    const matchesSearch = 
      agent.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      agent.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (agent.phone && agent.phone.includes(searchTerm));
    
    const matchesAgency = filterAgency ? agent.agency._id === filterAgency : true;
    
    if (filterActive === null) return matchesSearch && matchesAgency;
    return matchesSearch && matchesAgency && agent.isActive === filterActive;
  });
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 space-y-4 md:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Agent Management</h2>
          {adminProfile && (
            <p className="text-sm text-gray-600">
              Logged in as {adminProfile.name} ({adminProfile.role})
            </p>
          )}
        </div>
        <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4">
          <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2">
            <input
              type="text"
              placeholder="Search agents..."
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filterActive === null ? 'all' : filterActive ? 'active' : 'inactive'}
              onChange={(e) => {
                if (e.target.value === 'all') setFilterActive(null);
                else setFilterActive(e.target.value === 'active');
              }}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filterAgency}
              onChange={(e) => setFilterAgency(e.target.value)}
            >
              <option value="">All Agencies</option>
              {agencies.map((agency) => (
                <option key={agency._id} value={agency._id}>{agency.name}</option>
              ))}
            </select>
          </div>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            onClick={openAddModal}
          >
            Add Agent
          </button>
        </div>
      </div>

      {isLoading && !showAddModal && !showEditModal && !showDeleteModal && (
        <div className="flex justify-center my-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 p-4 rounded-md mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <button 
                onClick={fetchAgents}
                className="mt-2 bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded text-sm"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agent Table */}
      {!isLoading && !error && (
        <>
          {filteredAgents.length > 0 ? (
            <div className="overflow-x-auto mt-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Agent
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Agency
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Position
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAgents.map((agent) => (
                    <tr key={agent._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            {agent.profileImage ? (
                              <img className="h-10 w-10 rounded-full object-cover" src={agent.profileImage} alt={agent.name} />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <span className="text-blue-600 font-semibold text-sm">
                                  {agent.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{agent.name}</div>
                            <div className="text-sm text-gray-500">
                              {agent.employeeId ? `ID: ${agent.employeeId}` : 'No ID'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{agent.email}</div>
                        <div className="text-sm text-gray-500">{agent.phone || 'No phone'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {agent.agency.logo ? (
                            <img className="h-6 w-6 rounded-full mr-2" src={agent.agency.logo} alt={agent.agency.name} />
                          ) : null}
                          <div className="text-sm text-gray-900">{agent.agency.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{agent.position || 'Not specified'}</div>
                        <div className="text-sm text-gray-500">{agent.department || 'No department'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            agent.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {agent.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => openViewModal(agent)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          View
                        </button>
                        <button
                          onClick={() => openEditModal(agent)}
                          className="text-indigo-600 hover:text-indigo-900 mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleAgentStatus(agent)}
                          className={`${
                            agent.isActive ? 'text-amber-600 hover:text-amber-900' : 'text-green-600 hover:text-green-900'
                          } mr-3`}
                        >
                          {agent.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => generateAccessCode(agent)}
                          className="text-purple-600 hover:text-purple-900 mr-3"
                          title="Generate password reset code"
                        >
                          Reset Code
                        </button>
                        <button
                          onClick={() => sendSetupEmail(agent)}
                          className="text-teal-600 hover:text-teal-900 mr-3"
                          title="Send account setup email"
                        >
                          Setup Email
                        </button>
                        <button
                          onClick={() => openDeleteModal(agent)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-10">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No agents found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || filterActive !== null || filterAgency
                  ? 'Try adjusting your search or filters to find what you\'re looking for.'
                  : 'Get started by creating a new agent.'}
              </p>
              {(searchTerm || filterActive !== null || filterAgency) && (
                <button
                  onClick={() => { setSearchTerm(''); setFilterActive(null); setFilterAgency(''); }}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-500"
                >
                  Clear filters
                </button>
              )}
              {!searchTerm && filterActive === null && !filterAgency && (
                <button
                  onClick={openAddModal}
                  className="mt-3 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Add Agent
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Add Agent Modal */}
      {showAddModal && (
        <div className="fixed inset-0 overflow-y-auto z-50">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeAllModals}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Add Agent</h3>
                    <div className="mt-4">
                      <form onSubmit={handleAddAgent}>
                        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                          <div className="sm:col-span-6">
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                              Name <span className="text-red-500">*</span>
                            </label>
                            <div className="mt-1">
                              <input
                                type="text"
                                name="name"
                                id="name"
                                required
                                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                value={formData.name}
                                onChange={handleInputChange}
                              />
                            </div>
                          </div>

                          <div className="sm:col-span-6">
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                              Email <span className="text-red-500">*</span>
                            </label>
                            <div className="mt-1">
                              <input
                                type="email"
                                name="email"
                                id="email"
                                required
                                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                value={formData.email}
                                onChange={handleInputChange}
                              />
                            </div>
                          </div>

                          <div className="sm:col-span-3">
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                              Phone
                            </label>
                            <div className="mt-1">
                              <input
                                type="tel"
                                name="phone"
                                id="phone"
                                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                value={formData.phone}
                                onChange={handleInputChange}
                              />
                            </div>
                          </div>

                          <div className="sm:col-span-3">
                            <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700">
                              Employee ID
                            </label>
                            <div className="mt-1">
                              <input
                                type="text"
                                name="employeeId"
                                id="employeeId"
                                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                value={formData.employeeId}
                                onChange={handleInputChange}
                              />
                            </div>
                          </div>

                          <div className="sm:col-span-3">
                            <label htmlFor="position" className="block text-sm font-medium text-gray-700">
                              Position
                            </label>
                            <div className="mt-1">
                              <input
                                type="text"
                                name="position"
                                id="position"
                                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                value={formData.position}
                                onChange={handleInputChange}
                              />
                            </div>
                          </div>

                          <div className="sm:col-span-3">
                            <label htmlFor="department" className="block text-sm font-medium text-gray-700">
                              Department
                            </label>
                            <div className="mt-1">
                              <input
                                type="text"
                                name="department"
                                id="department"
                                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                value={formData.department}
                                onChange={handleInputChange}
                              />
                            </div>
                          </div>

                          <div className="sm:col-span-6">
                            <label htmlFor="agency" className="block text-sm font-medium text-gray-700">
                              Agency <span className="text-red-500">*</span>
                            </label>
                            <div className="mt-1">
                              <select
                                id="agency"
                                name="agency"
                                required
                                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                value={formData.agency}
                                onChange={handleInputChange}
                              >
                                {agencies.length === 0 ? (
                                  <option value="">No agencies available</option>
                                ) : (
                                  agencies.map((agency) => (
                                    <option key={agency._id} value={agency._id}>{agency.name}</option>
                                  ))
                                )}
                              </select>
                            </div>
                          </div>

                          <div className="sm:col-span-6">
                            <label htmlFor="profileImage" className="block text-sm font-medium text-gray-700">
                              Profile Image
                            </label>
                            <div className="mt-1 flex items-center space-x-4">
                              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 overflow-hidden">
                                {previewImage ? (
                                  <img src={previewImage} alt="Preview" className="w-12 h-12 object-cover" />
                                ) : (
                                  <svg className="h-6 w-6 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                )}
                              </div>
                              <input
                                type="file"
                                name="profileImage"
                                id="profileImage"
                                accept="image/*"
                                onChange={handleProfileImageChange}
                                className="sr-only"
                              />
                              <label
                                htmlFor="profileImage"
                                className="cursor-pointer py-1 px-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                              >
                                {profileImage ? 'Change Image' : 'Upload Image'}
                              </label>
                              {profileImage && (
                                <button
                                  type="button"
                                  className="text-red-600 hover:text-red-900"
                                  onClick={() => {
                                    setProfileImage(null);
                                    setPreviewImage(null);
                                  }}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="sm:col-span-6">
                            <div className="flex items-start">
                              <div className="flex items-center h-5">
                                <input
                                  id="isActive"
                                  name="isActive"
                                  type="checkbox"
                                  checked={formData.isActive}
                                  onChange={handleInputChange}
                                  className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                                />
                              </div>
                              <div className="ml-3 text-sm">
                                <label htmlFor="isActive" className="font-medium text-gray-700">
                                  Active
                                </label>
                                <p className="text-gray-500">Set the agent as active or inactive.</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleAddAgent}
                  disabled={isLoading || !formData.agency}
                >
                  {isLoading ? 'Adding...' : 'Add Agent'}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={closeAllModals}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Agent Modal */}
      {showEditModal && currentAgent && (
        <div className="fixed inset-0 overflow-y-auto z-50">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeAllModals}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Edit Agent</h3>
                    <div className="mt-4">
                      <form onSubmit={handleUpdateAgent}>
                        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                          <div className="sm:col-span-6">
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                              Name <span className="text-red-500">*</span>
                            </label>
                            <div className="mt-1">
                              <input
                                type="text"
                                name="name"
                                id="name"
                                required
                                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                value={formData.name}
                                onChange={handleInputChange}
                              />
                            </div>
                          </div>

                          <div className="sm:col-span-6">
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                              Email <span className="text-red-500">*</span>
                            </label>
                            <div className="mt-1">
                              <input
                                type="email"
                                name="email"
                                id="email"
                                required
                                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                value={formData.email}
                                onChange={handleInputChange}
                              />
                            </div>
                          </div>

                          <div className="sm:col-span-3">
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                              Phone
                            </label>
                            <div className="mt-1">
                              <input
                                type="tel"
                                name="phone"
                                id="phone"
                                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                value={formData.phone}
                                onChange={handleInputChange}
                              />
                            </div>
                          </div>

                          <div className="sm:col-span-3">
                            <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700">
                              Employee ID
                            </label>
                            <div className="mt-1">
                              <input
                                type="text"
                                name="employeeId"
                                id="employeeId"
                                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                value={formData.employeeId}
                                onChange={handleInputChange}
                              />
                            </div>
                          </div>

                          <div className="sm:col-span-3">
                            <label htmlFor="position" className="block text-sm font-medium text-gray-700">
                              Position
                            </label>
                            <div className="mt-1">
                              <input
                                type="text"
                                name="position"
                                id="position"
                                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                value={formData.position}
                                onChange={handleInputChange}
                              />
                            </div>
                          </div>

                          <div className="sm:col-span-3">
                            <label htmlFor="department" className="block text-sm font-medium text-gray-700">
                              Department
                            </label>
                            <div className="mt-1">
                              <input
                                type="text"
                                name="department"
                                id="department"
                                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                value={formData.department}
                                onChange={handleInputChange}
                              />
                            </div>
                          </div>

                          <div className="sm:col-span-6">
                            <label htmlFor="agency" className="block text-sm font-medium text-gray-700">
                              Agency <span className="text-red-500">*</span>
                            </label>
                            <div className="mt-1">
                              <select
                                id="agency"
                                name="agency"
                                required
                                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                value={formData.agency}
                                onChange={handleInputChange}
                              >
                                {agencies.map((agency) => (
                                  <option key={agency._id} value={agency._id}>{agency.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="sm:col-span-6">
                            <label htmlFor="editProfileImage" className="block text-sm font-medium text-gray-700">
                              Profile Image
                            </label>
                            <div className="mt-1 flex items-center space-x-4">
                              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 overflow-hidden">
                                {previewImage ? (
                                  <img src={previewImage} alt="Preview" className="w-12 h-12 object-cover" />
                                ) : (
                                  <svg className="h-6 w-6 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                )}
                              </div>
                              <input
                                type="file"
                                name="profileImage"
                                id="editProfileImage"
                                accept="image/*"
                                onChange={handleProfileImageChange}
                                className="sr-only"
                              />
                              <label
                                htmlFor="editProfileImage"
                                className="cursor-pointer py-1 px-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                              >
                                {profileImage ? 'Change Image' : 'Upload New Image'}
                              </label>
                              {previewImage && (
                                <button
                                  type="button"
                                  className="text-red-600 hover:text-red-900"
                                  onClick={() => {
                                    setProfileImage(null);
                                    setPreviewImage(null);
                                  }}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="sm:col-span-6">
                            <div className="flex items-start">
                              <div className="flex items-center h-5">
                                <input
                                  id="isActive"
                                  name="isActive"
                                  type="checkbox"
                                  checked={formData.isActive}
                                  onChange={handleInputChange}
                                  className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                                />
                              </div>
                              <div className="ml-3 text-sm">
                                <label htmlFor="isActive" className="font-medium text-gray-700">
                                  Active
                                </label>
                                <p className="text-gray-500">Set the agent as active or inactive.</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleUpdateAgent}
                  disabled={isLoading}
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={closeAllModals}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Agent Modal */}
      {showDeleteModal && currentAgent && (
        <div className="fixed inset-0 overflow-y-auto z-50">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeAllModals}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Delete Agent</h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to delete the agent <strong>{currentAgent.name}</strong>? This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleDeleteAgent}
                  disabled={isLoading}
                >
                  {isLoading ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={closeAllModals}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Agent Modal */}
      {showViewModal && currentAgent && (
        <div className="fixed inset-0 overflow-y-auto z-50">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeAllModals}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Agent Details</h3>
                    <div className="mt-4">
                      <div className="flex justify-center sm:justify-start mb-4">
                        {currentAgent.profileImage ? (
                          <img src={currentAgent.profileImage} alt={`${currentAgent.name}'s profile`} className="h-24 w-24 rounded-full object-cover" />
                        ) : (
                          <div className="h-24 w-24 rounded-full flex items-center justify-center bg-blue-100 text-blue-600 text-2xl font-semibold">
                            {currentAgent.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <dt className="text-sm font-medium text-gray-500">Name</dt>
                          <dd className="mt-1 text-sm text-gray-900">{currentAgent.name}</dd>
                        </div>
                        <div className="sm:col-span-1">
                          <dt className="text-sm font-medium text-gray-500">Email</dt>
                          <dd className="mt-1 text-sm text-gray-900">{currentAgent.email}</dd>
                        </div>
                        <div className="sm:col-span-1">
                          <dt className="text-sm font-medium text-gray-500">Phone</dt>
                          <dd className="mt-1 text-sm text-gray-900">{currentAgent.phone || 'N/A'}</dd>
                        </div>
                        <div className="sm:col-span-1">
                          <dt className="text-sm font-medium text-gray-500">Employee ID</dt>
                          <dd className="mt-1 text-sm text-gray-900">{currentAgent.employeeId || 'N/A'}</dd>
                        </div>
                        <div className="sm:col-span-1">
                          <dt className="text-sm font-medium text-gray-500">Status</dt>
                          <dd className="mt-1 text-sm">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                currentAgent.isActive
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {currentAgent.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </dd>
                        </div>
                        <div className="sm:col-span-1">
                          <dt className="text-sm font-medium text-gray-500">Position</dt>
                          <dd className="mt-1 text-sm text-gray-900">{currentAgent.position || 'N/A'}</dd>
                        </div>
                        <div className="sm:col-span-1">
                          <dt className="text-sm font-medium text-gray-500">Department</dt>
                          <dd className="mt-1 text-sm text-gray-900">{currentAgent.department || 'N/A'}</dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-sm font-medium text-gray-500">Agency</dt>
                          <dd className="mt-1 text-sm text-gray-900 flex items-center">
                            {currentAgent.agency.logo && (
                              <img src={currentAgent.agency.logo} alt={currentAgent.agency.name} className="h-6 w-6 rounded-full mr-2" />
                            )}
                            {currentAgent.agency.name}
                          </dd>
                        </div>
                        <div className="sm:col-span-1">
                          <dt className="text-sm font-medium text-gray-500">Created At</dt>
                          <dd className="mt-1 text-sm text-gray-900">{new Date(currentAgent.createdAt).toLocaleString()}</dd>
                        </div>
                        <div className="sm:col-span-1">
                          <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                          <dd className="mt-1 text-sm text-gray-900">{new Date(currentAgent.updatedAt).toLocaleString()}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => {
                    closeAllModals();
                    openEditModal(currentAgent);
                  }}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={closeAllModals}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdAgentManagement;