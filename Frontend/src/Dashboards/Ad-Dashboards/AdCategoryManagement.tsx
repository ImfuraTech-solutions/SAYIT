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

interface Category {
  _id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  isActive: boolean;
  parentCategory?: string | Category;
  subCategories?: Category[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

interface CategoryFormData {
  name: string;
  description: string;
  icon: string;
  color: string;
  isActive: boolean;
  parentCategory: string;
}

interface AdCategoryManagementProps {
  adminProfile: AdminProfile | null;
}

const AdCategoryManagement: React.FC<AdCategoryManagementProps> = ({ adminProfile }) => {
  // State
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [filterParent, setFilterParent] = useState<string>('');
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    description: '',
    icon: '',
    color: '#3B82F6', // Default blue color
    isActive: true,
    parentCategory: ''
  });
  const [iconOptions] = useState<string[]>([
    'report', 'infrastructure', 'safety', 'environment', 'community', 
    'transportation', 'utilities', 'health', 'education', 'other'
  ]);
  const [colorOptions] = useState<string[]>([
    '#3B82F6', // Blue
    '#EF4444', // Red
    '#10B981', // Green
    '#F59E0B', // Amber
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#6B7280', // Gray
    '#06B6D4', // Cyan
    '#14B8A6', // Teal
    '#F97316'  // Orange
  ]);

  // Fetch categories with admin information for audit logging
  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get('/api/admin/categories', {
        params: { 
          adminId: adminProfile?._id // Include admin ID for server-side logging
        }
      });
      
      if (response.data.success) {
        setCategories(response.data.data);
      } else {
        setError('Failed to fetch categories');
        toast.error('Could not load categories');
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      setError('An error occurred while fetching categories');
      toast.error('Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  }, [adminProfile]);

  // Initialize component
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

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

  const handleColorChange = (color: string) => {
    setFormData({
      ...formData,
      color
    });
  };

  const handleIconChange = (icon: string) => {
    setFormData({
      ...formData,
      icon
    });
  };

  // Modal handlers
  const openAddModal = () => {
    setFormData({
      name: '',
      description: '',
      icon: iconOptions[0],
      color: colorOptions[0],
      isActive: true,
      parentCategory: ''
    });
    setShowAddModal(true);
  };

  const openEditModal = (category: Category) => {
    setCurrentCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      icon: category.icon || iconOptions[0],
      color: category.color || colorOptions[0],
      isActive: category.isActive,
      parentCategory: category.parentCategory ? 
        (typeof category.parentCategory === 'string' ? category.parentCategory : category.parentCategory._id) 
        : ''
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (category: Category) => {
    setCurrentCategory(category);
    setShowDeleteModal(true);
  };

  const closeAllModals = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setShowDeleteModal(false);
    setCurrentCategory(null);
  };

  // CRUD operations with admin audit information
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Include admin info in the request for audit purposes
      const requestData = {
        ...formData,
        createdBy: adminProfile?._id,
        createdByName: adminProfile?.name
      };
      
      const response = await axios.post('/api/admin/categories', requestData);
      
      if (response.data.success) {
        toast.success('Category added successfully');
        fetchCategories();
        closeAllModals();
      } else {
        toast.error(response.data.message || 'Failed to add category');
      }
    } catch (error: any) {
      console.error('Error adding category:', error);
      toast.error(error.response?.data?.message || 'An error occurred while adding the category');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCategory) return;
    
    setIsLoading(true);
    
    try {
      // Include admin info in the request for audit purposes
      const requestData = {
        ...formData,
        updatedBy: adminProfile?._id,
        updatedByName: adminProfile?.name
      };
      
      const response = await axios.put(`/api/admin/categories/${currentCategory._id}`, requestData);
      
      if (response.data.success) {
        toast.success('Category updated successfully');
        fetchCategories();
        closeAllModals();
      } else {
        toast.error(response.data.message || 'Failed to update category');
      }
    } catch (error: any) {
      console.error('Error updating category:', error);
      toast.error(error.response?.data?.message || 'An error occurred while updating the category');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!currentCategory) return;
    
    setIsLoading(true);
    
    try {
      // Include admin info in delete request for audit trail
      const response = await axios.delete(`/api/admin/categories/${currentCategory._id}`, {
        data: {
          deletedBy: adminProfile?._id,
          deletedByName: adminProfile?.name
        }
      });
      
      if (response.data.success) {
        toast.success('Category deleted successfully');
        fetchCategories();
        closeAllModals();
      } else {
        toast.error(response.data.message || 'Failed to delete category');
      }
    } catch (error: any) {
      console.error('Error deleting category:', error);
      toast.error(error.response?.data?.message || 'An error occurred while deleting the category');
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle category active status
  const toggleCategoryStatus = async (category: Category) => {
    setIsLoading(true);
    
    try {
      // Include admin info for audit trail
      const response = await axios.put(`/api/admin/categories/${category._id}/toggle-status`, {
        isActive: !category.isActive,
        updatedBy: adminProfile?._id,
        updatedByName: adminProfile?.name
      });
      
      if (response.data.success) {
        toast.success(`Category ${category.isActive ? 'deactivated' : 'activated'} successfully`);
        fetchCategories();
      } else {
        toast.error(response.data.message || 'Failed to update category status');
      }
    } catch (error: any) {
      console.error('Error toggling category status:', error);
      toast.error(error.response?.data?.message || 'An error occurred while updating category status');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter categories
  const filteredCategories = categories.filter(category => {
    const matchesSearch = 
      category.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesActive = filterActive === null ? true : category.isActive === filterActive;
    
    const matchesParent = !filterParent || 
      (filterParent === 'parent' && !category.parentCategory) ||
      (filterParent === 'child' && category.parentCategory) ||
      (category.parentCategory && typeof category.parentCategory !== 'string' && category.parentCategory._id === filterParent);
    
    return matchesSearch && matchesActive && matchesParent;
  });

  // Get parent categories for dropdown
  const parentCategories = categories.filter(category => !category.parentCategory);

  // Helper to get category name by ID
  const getCategoryNameById = (id: string | undefined): string => {
    if (!id) return 'None';
    const category = categories.find(cat => cat._id === id);
    return category ? category.name : 'Unknown';
  };

  // Display current admin info in the UI
  const renderAdminInfo = () => {
    if (!adminProfile) return null;
    
    return (
      <div className="text-sm text-gray-500 mb-2">
        <span className="font-medium">Administrator:</span> {adminProfile.name}
      </div>
    );
  };

  // Get icon JSX based on name
  const getIconComponent = (iconName: string, color: string = '#3B82F6') => {
    switch (iconName) {
      case 'report':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke={color}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'infrastructure':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke={color}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        );
      case 'safety':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke={color}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
      case 'environment':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke={color}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'community':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke={color}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        );
      case 'transportation':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke={color}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        );
      case 'utilities':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke={color}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      case 'health':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke={color}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        );
      case 'education':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke={color}>
            <path d="M12 14l9-5-9-5-9 5 9 5z" />
            <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
          </svg>
        );
      case 'other':
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke={color}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 space-y-4 md:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Category Management</h2>
          {/* Display admin info in the component header */}
          {renderAdminInfo()}
        </div>
        <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4">
          <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2">
            <input
              type="text"
              placeholder="Search categories..."
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
              value={filterParent}
              onChange={(e) => setFilterParent(e.target.value)}
            >
              <option value="">All Categories</option>
              <option value="parent">Main Categories</option>
              <option value="child">Subcategories</option>
              {parentCategories.map((category) => (
                <option key={category._id} value={category._id}>
                  Children of: {category.name}
                </option>
              ))}
            </select>
          </div>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            onClick={openAddModal}
            disabled={!adminProfile}
            title={!adminProfile ? "You need admin privileges to add categories" : ""}
          >
            Add Category
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
                onClick={fetchCategories}
                className="mt-2 bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded text-sm"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Categories Grid */}
      {!isLoading && !error && (
        <>
          {filteredCategories.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCategories.map((category) => (
                <div 
                  key={category._id} 
                  className="border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden"
                >
                  <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="rounded-full p-2"
                        style={{ backgroundColor: `${category.color || '#3B82F6'}20` }}
                      >
                        {getIconComponent(category.icon || 'other', category.color || '#3B82F6')}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{category.name}</h3>
                        {category.parentCategory && (
                          <p className="text-xs text-gray-500">
                            Sub-category of {
                              typeof category.parentCategory === 'string' 
                                ? getCategoryNameById(category.parentCategory)
                                : category.parentCategory.name
                            }
                          </p>
                        )}
                      </div>
                    </div>
                    <span 
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        category.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {category.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {category.description || 'No description provided'}
                    </p>
                    
                    {category.subCategories && category.subCategories.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-medium text-gray-500 mb-1">Subcategories:</p>
                        <div className="flex flex-wrap gap-1">
                          {category.subCategories.map(sub => (
                            <span 
                              key={sub._id} 
                              className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded"
                            >
                              {sub.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex justify-end space-x-2 mt-2">
                      <button
                        onClick={() => openEditModal(category)}
                        className="px-3 py-1 text-xs text-blue-700 hover:text-blue-900 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleCategoryStatus(category)}
                        className={`px-3 py-1 text-xs ${
                          category.isActive 
                            ? 'text-amber-600 hover:text-amber-800' 
                            : 'text-green-600 hover:text-green-800'
                        } font-medium`}
                      >
                        {category.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => openDeleteModal(category)}
                        className="px-3 py-1 text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
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
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No categories found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || filterActive !== null || filterParent
                  ? 'Try adjusting your search or filters to find what you\'re looking for.'
                  : 'Get started by creating a new category.'}
              </p>
              {(searchTerm || filterActive !== null || filterParent) && (
                <button
                  onClick={() => { setSearchTerm(''); setFilterActive(null); setFilterParent(''); }}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-500"
                >
                  Clear filters
                </button>
              )}
              {!searchTerm && filterActive === null && !filterParent && (
                <button
                  onClick={openAddModal}
                  className="mt-3 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Add Category
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Add Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 overflow-y-auto z-50">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeAllModals}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                {/* Add modal content */}
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Add Category</h3>
                    {/* Show admin creating the category for audit purposes */}
                    {adminProfile && (
                      <p className="text-xs text-gray-500 mt-1">
                        Creating as: {adminProfile.name}
                      </p>
                    )}
                    <div className="mt-4">
                      <form onSubmit={handleAddCategory}>
                        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                          <div className="sm:col-span-6">
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                              Category Name <span className="text-red-500">*</span>
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
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                              Description
                            </label>
                            <div className="mt-1">
                              <textarea
                                name="description"
                                id="description"
                                rows={3}
                                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                value={formData.description}
                                onChange={handleInputChange}
                              />
                            </div>
                          </div>

                          <div className="sm:col-span-6">
                            <label htmlFor="parentCategory" className="block text-sm font-medium text-gray-700">
                              Parent Category
                            </label>
                            <div className="mt-1">
                              <select
                                id="parentCategory"
                                name="parentCategory"
                                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                value={formData.parentCategory}
                                onChange={handleInputChange}
                              >
                                <option value="">None (Main Category)</option>
                                {parentCategories.map((category) => (
                                  <option key={category._id} value={category._id}>
                                    {category.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="sm:col-span-3">
                            <label className="block text-sm font-medium text-gray-700">
                              Icon
                            </label>
                            <div className="mt-1 grid grid-cols-5 gap-2">
                              {iconOptions.map((icon) => (
                                <div
                                  key={icon}
                                  onClick={() => handleIconChange(icon)}
                                  className={`cursor-pointer p-2 border rounded-md ${
                                    formData.icon === icon 
                                      ? 'border-blue-500 bg-blue-50' 
                                      : 'border-gray-300 hover:bg-gray-50'
                                  } flex items-center justify-center`}
                                >
                                  {getIconComponent(icon, formData.color)}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="sm:col-span-3">
                            <label className="block text-sm font-medium text-gray-700">
                              Color
                            </label>
                            <div className="mt-1 grid grid-cols-5 gap-2">
                              {colorOptions.map((color) => (
                                <div
                                  key={color}
                                  onClick={() => handleColorChange(color)}
                                  className={`cursor-pointer w-full h-10 rounded-md border-2 ${
                                    formData.color === color 
                                      ? 'border-gray-800' 
                                      : 'border-transparent'
                                  }`}
                                  style={{ backgroundColor: color }}
                                />
                              ))}
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
                                <p className="text-gray-500">Set the category as active or inactive.</p>
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
                  onClick={handleAddCategory}
                  disabled={isLoading || !formData.name.trim()}
                >
                  {isLoading ? 'Adding...' : 'Add Category'}
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

      {/* Edit Category Modal */}
      {showEditModal && currentCategory && (
        <div className="fixed inset-0 overflow-y-auto z-50">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeAllModals}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Edit Category</h3>
                    <div className="mt-4">
                      <form onSubmit={handleUpdateCategory}>
                        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                          <div className="sm:col-span-6">
                            <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700">
                              Category Name <span className="text-red-500">*</span>
                            </label>
                            <div className="mt-1">
                              <input
                                type="text"
                                name="name"
                                id="edit-name"
                                required
                                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                value={formData.name}
                                onChange={handleInputChange}
                              />
                            </div>
                          </div>

                          <div className="sm:col-span-6">
                            <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700">
                              Description
                            </label>
                            <div className="mt-1">
                              <textarea
                                name="description"
                                id="edit-description"
                                rows={3}
                                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                value={formData.description}
                                onChange={handleInputChange}
                              />
                            </div>
                          </div>

                          <div className="sm:col-span-6">
                            <label htmlFor="edit-parentCategory" className="block text-sm font-medium text-gray-700">
                              Parent Category
                            </label>
                            <div className="mt-1">
                              <select
                                id="edit-parentCategory"
                                name="parentCategory"
                                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                value={formData.parentCategory}
                                onChange={handleInputChange}
                              >
                                <option value="">None (Main Category)</option>
                                {parentCategories
                                  .filter(category => category._id !== currentCategory._id)
                                  .map((category) => (
                                    <option key={category._id} value={category._id}>
                                      {category.name}
                                    </option>
                                  ))
                                }
                              </select>
                            </div>
                          </div>

                          <div className="sm:col-span-3">
                            <label className="block text-sm font-medium text-gray-700">
                              Icon
                            </label>
                            <div className="mt-1 grid grid-cols-5 gap-2">
                              {iconOptions.map((icon) => (
                                <div
                                  key={icon}
                                  onClick={() => handleIconChange(icon)}
                                  className={`cursor-pointer p-2 border rounded-md ${
                                    formData.icon === icon 
                                      ? 'border-blue-500 bg-blue-50' 
                                      : 'border-gray-300 hover:bg-gray-50'
                                  } flex items-center justify-center`}
                                >
                                  {getIconComponent(icon, formData.color)}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="sm:col-span-3">
                            <label className="block text-sm font-medium text-gray-700">
                              Color
                            </label>
                            <div className="mt-1 grid grid-cols-5 gap-2">
                              {colorOptions.map((color) => (
                                <div
                                  key={color}
                                  onClick={() => handleColorChange(color)}
                                  className={`cursor-pointer w-full h-10 rounded-md border-2 ${
                                    formData.color === color 
                                      ? 'border-gray-800' 
                                      : 'border-transparent'
                                  }`}
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                          </div>

                          <div className="sm:col-span-6">
                            <div className="flex items-start">
                              <div className="flex items-center h-5">
                                <input
                                  id="edit-isActive"
                                  name="isActive"
                                  type="checkbox"
                                  checked={formData.isActive}
                                  onChange={handleInputChange}
                                  className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                                />
                              </div>
                              <div className="ml-3 text-sm">
                                <label htmlFor="edit-isActive" className="font-medium text-gray-700">
                                  Active
                                </label>
                                <p className="text-gray-500">Set the category as active or inactive.</p>
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
                  onClick={handleUpdateCategory}
                  disabled={isLoading || !formData.name.trim()}
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

      {/* Delete Category Modal */}
      {showDeleteModal && currentCategory && (
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
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Delete Category</h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to delete the category <strong className="text-gray-700">{currentCategory.name}</strong>? This action cannot be undone.
                      </p>
                      
                      {currentCategory.subCategories && currentCategory.subCategories.length > 0 && (
                        <div className="mt-3 bg-yellow-50 p-3 rounded-md">
                          <p className="text-sm text-yellow-800">
                            <strong>Warning:</strong> This category has {currentCategory.subCategories.length} subcategories that will also be deleted.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleDeleteCategory}
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
    </div>
  );
};

export default AdCategoryManagement;