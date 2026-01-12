"use client";

import { useState, useEffect } from "react";
import { Save, AlertCircle, Clock, DollarSign, Plus, Trash2, X, Check, Users, Briefcase, Calendar, Coins, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LeadAssignee {
  employeeId: string;
  employeeName: string;
  email: string;
  projects: Array<{
    projectId: string;
    projectName: string;
    clientName: string;
  }>;
}

interface CustomFine {
  _id: string;
  criteria: string;
  employeeIds: string[];
  projectIds?: string[];
  timeHour?: number;
  timeMinute?: number;
  finePoints: number;
  fineCurrency: number;
  fineType?: 'daily' | 'one-time';
  description?: string;
  isActive: boolean;
  createdAt: Date;
  applicationStatus?: {
    appliedToday: boolean;
    appliedCountToday: number;
    employeesAppliedToday: string[];
    lastAppliedAt: Date | null;
    totalAppliedCount: number;
  };
}

interface Employee {
  _id: string;
  name: string;
  email: string;
}

export default function FineControl() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Custom fines state
  const [customFines, setCustomFines] = useState<CustomFine[]>([]);
  const [loadingCustomFines, setLoadingCustomFines] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [leadAssignees, setLeadAssignees] = useState<LeadAssignee[]>([]);
  const [loadingLeadAssignees, setLoadingLeadAssignees] = useState(false);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [loadingAllEmployees, setLoadingAllEmployees] = useState(false);
  const [applyingFines, setApplyingFines] = useState(false);
  const [applyingFineId, setApplyingFineId] = useState<string | null>(null);
  
  // Form state for new custom fine
  const [formData, setFormData] = useState({
    criteria: 'lead_assignee_no_task_created',
    selectedEmployeeIds: [] as string[],
    selectedProjectIds: [] as string[],
    timeHour: 10,
    timeMinute: 0,
    finePoints: 0,
    fineCurrency: 0,
    fineType: 'daily' as 'daily' | 'one-time',
    description: '',
    isActive: true
  });

  useEffect(() => {
    fetchCustomFines();
    if (showAddForm) {
      if (formData.criteria === 'lead_assignee_no_task_created') {
        fetchLeadAssignees();
      } else if (formData.criteria === 'default_fine') {
        fetchAllEmployees();
      }
    }
  }, [showAddForm, formData.criteria]);

  useEffect(() => {
    fetchCustomFines();
    
    // Automatically check and apply fines when component loads and periodically
    // This ensures fines are applied as soon as deadlines pass
    const checkAndApplyFines = async () => {
      try {
        console.log('[FineControl] Auto-checking for fines to apply...');
        const response = await fetch('/api/admin/apply-custom-fines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await response.json();
        console.log('[FineControl] Auto-check result:', data);
        if (response.ok) {
          if (data.finesApplied > 0) {
            // Refresh custom fines if any were applied
            fetchCustomFines();
            // Show a notification
            setMessage({ 
              type: 'success', 
              text: `✓ Automatically applied ${data.finesApplied} fine(s). ${data.finesSkipped > 0 ? `Skipped: ${data.finesSkipped}` : ''}` 
            });
            setTimeout(() => setMessage(null), 5000);
          } else if (data.finesSkipped > 0 && data.details?.skipped) {
            // Log skipped reasons for debugging
            console.log('[FineControl] Fines skipped:', data.details.skipped);
          }
        } else {
          console.error('[FineControl] Auto-check failed:', data.error);
        }
      } catch (error) {
        console.error('[FineControl] Auto-apply fines check failed:', error);
      }
    };
    
    // Check immediately when page loads (with small delay to ensure component is ready)
    const initialTimeout = setTimeout(checkAndApplyFines, 1000);
    
    // Then check every 30 seconds while the page is open
    // This ensures fines are applied within 30 seconds of deadline passing
    const interval = setInterval(checkAndApplyFines, 30000); // Check every 30 seconds
    
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  const fetchCustomFines = async () => {
    try {
      setLoadingCustomFines(true);
      const response = await fetch('/api/admin/custom-fines');
      const data = await response.json();
      if (response.ok && data.customFines) {
        setCustomFines(data.customFines.map((fine: any) => ({
          ...fine,
          employeeIds: fine.employeeIds?.map((id: any) => id.toString()) || [],
          projectIds: fine.projectIds?.map((id: any) => id.toString()) || [],
          createdAt: new Date(fine.createdAt)
        })));
      }
    } catch (error) {
      console.error('Error fetching custom fines:', error);
    } finally {
      setLoadingCustomFines(false);
    }
  };

  const fetchLeadAssignees = async () => {
    try {
      setLoadingLeadAssignees(true);
      const response = await fetch('/api/admin/lead-assignees');
      const data = await response.json();
      if (response.ok) {
        if (data.leadAssignees && data.leadAssignees.length > 0) {
          setLeadAssignees(data.leadAssignees);
        } else {
          setLeadAssignees([]);
          setMessage({ type: 'error', text: 'No lead assignees found. Make sure projects have lead assignees assigned.' });
          setTimeout(() => setMessage(null), 5000);
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to fetch lead assignees' });
        setTimeout(() => setMessage(null), 5000);
      }
    } catch (error) {
      console.error('Error fetching lead assignees:', error);
      setMessage({ type: 'error', text: 'Failed to fetch lead assignees. Please try again.' });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setLoadingLeadAssignees(false);
    }
  };

  const fetchAllEmployees = async () => {
    try {
      setLoadingAllEmployees(true);
      const response = await fetch('/api/admin/employees');
      const data = await response.json();
      if (response.ok) {
        if (data.employees && data.employees.length > 0) {
          // Map to Employee interface format - use userId as the ID since that's what's stored in projects
          setAllEmployees(data.employees.map((emp: any) => ({
            _id: emp.userId || emp._id?.toString() || String(emp._id),
            name: emp.name || emp.fullName || 'Unknown',
            email: emp.email || ''
          })).filter((emp: Employee) => emp._id)); // Filter out any without IDs
        } else {
          setAllEmployees([]);
          setMessage({ type: 'error', text: 'No employees found.' });
          setTimeout(() => setMessage(null), 5000);
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to fetch employees' });
        setTimeout(() => setMessage(null), 5000);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      setMessage({ type: 'error', text: 'Failed to fetch employees. Please try again.' });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setLoadingAllEmployees(false);
    }
  };


  const handleAddCustomFine = async () => {
    if (formData.selectedEmployeeIds.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one employee' });
      return;
    }
    if (formData.finePoints < 0 || formData.fineCurrency < 0) {
      setMessage({ type: 'error', text: 'Fine amounts cannot be negative' });
      return;
    }
    if (formData.criteria === 'lead_assignee_no_task_created') {
      if (formData.timeHour < 0 || formData.timeHour > 23) {
        setMessage({ type: 'error', text: 'Hour must be between 0 and 23' });
        return;
      }
      if (formData.timeMinute < 0 || formData.timeMinute > 59) {
        setMessage({ type: 'error', text: 'Minute must be between 0 and 59' });
        return;
      }
    }
    if (formData.criteria === 'default_fine' && !formData.description.trim()) {
      setMessage({ type: 'error', text: 'Please enter a description for the fine' });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);
      const requestBody: any = {
        criteria: formData.criteria,
        employeeIds: formData.selectedEmployeeIds,
        finePoints: formData.finePoints,
        fineCurrency: formData.fineCurrency,
        isActive: formData.isActive
      };

      if (formData.criteria === 'lead_assignee_no_task_created') {
        requestBody.projectIds = formData.selectedProjectIds.length > 0 ? formData.selectedProjectIds : undefined;
        requestBody.timeHour = formData.timeHour;
        requestBody.timeMinute = formData.timeMinute;
        requestBody.fineType = formData.fineType;
      } else if (formData.criteria === 'default_fine') {
        requestBody.description = formData.description;
        requestBody.fineType = 'one-time'; // Always one-time for default fines
      }

      const response = await fetch('/api/admin/custom-fines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Custom fine created successfully!' });
        setShowAddForm(false);
        setFormData({
          criteria: 'lead_assignee_no_task_created',
          selectedEmployeeIds: [],
          selectedProjectIds: [],
          timeHour: 10,
          timeMinute: 0,
          finePoints: 0,
          fineCurrency: 0,
          fineType: 'daily',
          description: '',
          isActive: true
        });
        fetchCustomFines();
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create custom fine' });
      }
    } catch (error) {
      console.error('Error creating custom fine:', error);
      setMessage({ type: 'error', text: 'Failed to create custom fine' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCustomFine = async (fineId: string) => {
    if (!confirm('Are you sure you want to delete this custom fine?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/custom-fines?id=${fineId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Custom fine deleted successfully!' });
        fetchCustomFines();
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to delete custom fine' });
      }
    } catch (error) {
      console.error('Error deleting custom fine:', error);
      setMessage({ type: 'error', text: 'Failed to delete custom fine' });
    }
  };

  const handleApplyCustomFines = async () => {
    if (!confirm('This will check and apply all active custom fines. Continue?')) {
      return;
    }

    try {
      setApplyingFines(true);
      setMessage(null);
      const response = await fetch('/api/admin/apply-custom-fines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      if (response.ok) {
        const appliedCount = data.finesApplied || 0;
        const skippedCount = data.finesSkipped || 0;
        
        // Show detailed message
        let messageText = `Custom fines check completed! Applied: ${appliedCount}, Skipped: ${skippedCount}`;
        
        if (data.details && data.details.skipped && data.details.skipped.length > 0) {
          const reasons = data.details.skipped.map((s: any) => s.reason).filter((r: string, i: number, arr: string[]) => arr.indexOf(r) === i);
          if (reasons.length > 0) {
            messageText += `\n\nReasons: ${reasons.join(', ')}`;
          }
        }
        
        if (data.debug) {
          console.log('Apply Custom Fines Debug:', data.debug);
          console.log('Skipped Details:', data.details?.skipped);
        }
        
        setMessage({ 
          type: appliedCount > 0 ? 'success' : 'error', 
          text: messageText
        });
        setTimeout(() => setMessage(null), 8000);
        
        // Refresh custom fines list
        fetchCustomFines();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to apply custom fines' });
      }
    } catch (error) {
      console.error('Error applying custom fines:', error);
      setMessage({ type: 'error', text: 'Failed to apply custom fines' });
    } finally {
      setApplyingFines(false);
    }
  };

  const handleApplySingleFine = async (fineId: string) => {
    if (!confirm('Apply this fine now?')) {
      return;
    }

    try {
      setApplyingFineId(fineId);
      setMessage(null);
      const response = await fetch(`/api/admin/apply-custom-fines/${fineId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      if (response.ok) {
        const appliedCount = data.finesApplied || 0;
        setMessage({ 
          type: appliedCount > 0 ? 'success' : 'error', 
          text: appliedCount > 0 
            ? `Fine applied successfully! Applied to ${appliedCount} employee(s).`
            : 'No fines were applied. Check if criteria is met.'
        });
        setTimeout(() => setMessage(null), 5000);
        fetchCustomFines();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to apply fine' });
      }
    } catch (error) {
      console.error('Error applying fine:', error);
      setMessage({ type: 'error', text: 'Failed to apply fine' });
    } finally {
      setApplyingFineId(null);
    }
  };

  const toggleEmployeeSelection = (employeeId: string) => {
    setFormData(prev => {
      const isSelected = prev.selectedEmployeeIds.includes(employeeId);
      return {
        ...prev,
        selectedEmployeeIds: isSelected
          ? prev.selectedEmployeeIds.filter(id => id !== employeeId)
          : [...prev.selectedEmployeeIds, employeeId]
      };
    });
  };

  const toggleProjectSelection = (projectId: string) => {
    setFormData(prev => {
      const isSelected = prev.selectedProjectIds.includes(projectId);
      return {
        ...prev,
        selectedProjectIds: isSelected
          ? prev.selectedProjectIds.filter(id => id !== projectId)
          : [...prev.selectedProjectIds, projectId]
      };
    });
  };

  const getCriteriaLabel = (criteria: string) => {
    switch (criteria) {
      case 'lead_assignee_no_task_created':
        return 'Lead Assignee - No Task Created';
      case 'default_fine':
        return 'Default Fine';
      default:
        return criteria;
    }
  };

  if (loading && loadingCustomFines) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Loading fine control settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Fine Control</h2>
          <p className="text-neutral-600">Configure fine amounts and deadlines for various violations</p>
        </div>
      </div>

      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-lg border ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {message.text}
        </motion.div>
      )}

      {/* Custom Fines Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Custom Fines</h3>
            <p className="text-sm text-gray-600">Create and manage custom fine rules</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-md inline-flex">
              <Clock className="w-3 h-3" />
              <span>Fines are automatically applied every 5 minutes via cron job (no need to stay on this page)</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleApplyCustomFines}
              disabled={applyingFines}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Clock className="w-5 h-5" />
              {applyingFines ? 'Applying...' : 'Apply Fines Now'}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg"
            >
              <Plus className="w-5 h-5" />
              {showAddForm ? 'Cancel' : 'Add Custom Fine'}
            </motion.button>
          </div>
        </div>

        {/* Add Custom Fine Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border border-gray-200 rounded-lg p-6 mb-6 bg-gray-50"
            >
              <h4 className="text-md font-semibold text-gray-900 mb-4">Create New Custom Fine</h4>
              
              <div className="space-y-4">
                {/* Criteria Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Criteria *
                  </label>
                  <select
                    value={formData.criteria}
                    onChange={(e) => {
                      const newCriteria = e.target.value;
                      setFormData(prev => ({ 
                        ...prev, 
                        criteria: newCriteria,
                        selectedEmployeeIds: [],
                        selectedProjectIds: [],
                        description: ''
                      }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="lead_assignee_no_task_created">Lead Assignee - No Task Created</option>
                    <option value="default_fine">Default Fine</option>
                  </select>
                </div>

                {/* Employee Selection - Lead Assignees */}
                {formData.criteria === 'lead_assignee_no_task_created' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Lead Assignees *
                    </label>
                    {loadingLeadAssignees ? (
                      <div className="text-sm text-gray-500">Loading lead assignees...</div>
                    ) : (
                      <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-white">
                        {leadAssignees.length === 0 ? (
                          <p className="text-sm text-gray-500">No lead assignees found</p>
                        ) : (
                          <div className="space-y-3">
                            {leadAssignees.map((leadAssignee) => (
                              <div key={leadAssignee.employeeId} className="border border-gray-200 rounded-lg p-3">
                                <label className="flex items-start gap-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={formData.selectedEmployeeIds.includes(leadAssignee.employeeId)}
                                    onChange={() => toggleEmployeeSelection(leadAssignee.employeeId)}
                                    className="mt-1 w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                                  />
                                  <div className="flex-1">
                                    <div className="font-medium text-gray-900">{leadAssignee.employeeName}</div>
                                    <div className="text-xs text-gray-500">{leadAssignee.email}</div>
                                    <div className="mt-2 space-y-1">
                                      {leadAssignee.projects.map((project) => (
                                        <div key={project.projectId} className="flex items-center gap-2 text-xs text-gray-600">
                                          <Briefcase className="w-3 h-3" />
                                          <span>{project.projectName}</span>
                                          <span className="text-gray-400">({project.clientName})</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Selected: {formData.selectedEmployeeIds.length} employee(s)
                    </p>
                  </div>
                )}

                {/* Employee Selection - All Employees for Default Fine */}
                {formData.criteria === 'default_fine' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Employees *
                    </label>
                    {loadingAllEmployees ? (
                      <div className="text-sm text-gray-500">Loading employees...</div>
                    ) : (
                      <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-white">
                        {allEmployees.length === 0 ? (
                          <p className="text-sm text-gray-500">No employees found</p>
                        ) : (
                          <div className="space-y-2">
                            {allEmployees.map((employee) => (
                              <label key={employee._id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded">
                                <input
                                  type="checkbox"
                                  checked={formData.selectedEmployeeIds.includes(employee._id)}
                                  onChange={() => toggleEmployeeSelection(employee._id)}
                                  className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                                />
                                <div>
                                  <div className="font-medium text-gray-900">{employee.name}</div>
                                  <div className="text-xs text-gray-500">{employee.email}</div>
                                </div>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Selected: {formData.selectedEmployeeIds.length} employee(s)
                    </p>
                  </div>
                )}

                {/* Description Field for Default Fine */}
                {formData.criteria === 'default_fine' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description *
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="Enter description for this fine..."
                    />
                  </div>
                )}

                {/* Time Selection - Only for Lead Assignee criteria */}
                {formData.criteria === 'lead_assignee_no_task_created' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Deadline Time *
                    </label>
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-gray-400" />
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={formData.timeHour}
                        onChange={(e) => setFormData(prev => ({ ...prev, timeHour: parseInt(e.target.value) || 0 }))}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        placeholder="10"
                      />
                      <span className="text-gray-600">:</span>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={formData.timeMinute}
                        onChange={(e) => setFormData(prev => ({ ...prev, timeMinute: parseInt(e.target.value) || 0 }))}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        placeholder="00"
                      />
                      <span className="text-sm text-gray-600">(24-hour format)</span>
                    </div>
                  </div>
                )}

                {/* Fine Type - Only for Lead Assignee criteria */}
                {formData.criteria === 'lead_assignee_no_task_created' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fine Type *
                    </label>
                    <select
                      value={formData.fineType}
                      onChange={(e) => setFormData(prev => ({ ...prev, fineType: e.target.value as 'daily' | 'one-time' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="daily">Daily</option>
                      <option value="one-time">One Time</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.fineType === 'daily' 
                        ? 'Fine will be applied daily if criteria is met'
                        : 'Fine will be applied only once when criteria is met'}
                    </p>
                  </div>
                )}

                {/* Fine Amounts */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fine Points *
                    </label>
                    <div className="relative">
                      <Coins className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="number"
                        min="0"
                        value={formData.finePoints}
                        onChange={(e) => setFormData(prev => ({ ...prev, finePoints: parseInt(e.target.value) || 0 }))}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fine Currency (₹) *
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={formData.fineCurrency}
                        onChange={(e) => setFormData(prev => ({ ...prev, fineCurrency: parseInt(e.target.value) || 0 }))}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end gap-3 pt-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleAddCustomFine}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Check className="w-5 h-5" />
                    {saving ? 'Creating...' : 'Create Fine'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Custom Fines List */}
        {loadingCustomFines ? (
          <div className="text-center py-8">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading custom fines...</p>
          </div>
        ) : customFines.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">No custom fines created yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {customFines.map((fine) => (
              <motion.div
                key={fine._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="border border-gray-200 rounded-lg p-4 bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h4 className="font-semibold text-gray-900">{getCriteriaLabel(fine.criteria)}</h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        fine.isActive 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {fine.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        fine.fineType === 'daily'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {fine.fineType === 'daily' ? 'Daily' : 'One-Time'}
                      </span>
                      {fine.applicationStatus?.appliedToday && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-emerald-100 text-emerald-700 font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          Applied Today ({fine.applicationStatus.appliedCountToday})
                        </span>
                      )}
                      {fine.applicationStatus?.lastAppliedAt && !fine.applicationStatus.appliedToday && (
                        <span className="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-700">
                          Last: {new Date(fine.applicationStatus.lastAppliedAt).toLocaleDateString()}
                        </span>
                      )}
                      {fine.applicationStatus && fine.applicationStatus.totalAppliedCount > 0 && (
                        <span className="px-2 py-1 text-xs rounded-full bg-indigo-100 text-indigo-700">
                          Total Applied: {fine.applicationStatus.totalAppliedCount}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {fine.criteria === 'lead_assignee_no_task_created' && fine.timeHour !== undefined && fine.timeMinute !== undefined && (
                        <div>
                          <span className="text-gray-600">Time:</span>
                          <span className="ml-2 font-medium">{String(fine.timeHour).padStart(2, '0')}:{String(fine.timeMinute).padStart(2, '0')}</span>
                        </div>
                      )}
                      {fine.criteria === 'default_fine' && fine.description && (
                        <div className="col-span-2 md:col-span-4">
                          <span className="text-gray-600">Description:</span>
                          <span className="ml-2 font-medium">{fine.description}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-600">Points:</span>
                        <span className="ml-2 font-medium">{fine.finePoints}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Currency:</span>
                        <span className="ml-2 font-medium">₹{fine.fineCurrency}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Employees:</span>
                        <span className="ml-2 font-medium">{fine.employeeIds.length}</span>
                      </div>
                    </div>
                    {fine.applicationStatus?.appliedToday && fine.applicationStatus.employeesAppliedToday.length > 0 && (
                      <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded-md">
                        <p className="text-xs font-medium text-emerald-800 mb-1">
                          ✓ Applied to {fine.applicationStatus.employeesAppliedToday.length} employee(s) today:
                        </p>
                        <p className="text-xs text-emerald-700">
                          {fine.applicationStatus.employeesAppliedToday.slice(0, 3).join(', ')}
                          {fine.applicationStatus.employeesAppliedToday.length > 3 && ` +${fine.applicationStatus.employeesAppliedToday.length - 3} more`}
                        </p>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Created: {fine.createdAt.toLocaleString()}
                      {fine.applicationStatus?.lastAppliedAt && (
                        <span className="ml-2">
                          • Last applied: {new Date(fine.applicationStatus.lastAppliedAt).toLocaleString()}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleApplySingleFine(fine._id)}
                      disabled={applyingFineId === fine._id}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Apply this fine now"
                    >
                      <Clock className="w-4 h-4" />
                      {applyingFineId === fine._id ? 'Applying...' : 'Apply Now'}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleDeleteCustomFine(fine._id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete custom fine"
                    >
                      <Trash2 className="w-5 h-5" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
