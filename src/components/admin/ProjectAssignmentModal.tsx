'use client';

import { useState, useEffect } from 'react';

interface Employee {
  _id: string;
  name: string;
  email: string;
  skills?: string[];
}

interface Project {
  _id: string;
  projectName: string;
  clientName: string;
  leadAssignee?: any;
  vaIncharge?: any;
  assignees?: any[];
  freelancer?: string;
  codersRecommendation?: string;
  leadership?: string;
  githubLink?: string;
  loomLink?: string;
  whatsappGroupLink?: string;
  tags?: string[];
  priority?: string;
  bonusPoints?: number;
  bonusCurrency?: number;
  penaltyPoints?: number;
  penaltyCurrency?: number;
}

interface ProjectAssignmentModalProps {
  project: Project;
  onClose: () => void;
  onSuccess: () => void;
  isEdit?: boolean;
}

export default function ProjectAssignmentModal({ project, onClose, onSuccess, isEdit = false }: ProjectAssignmentModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [skillFilter, setSkillFilter] = useState('');
  const [formData, setFormData] = useState({
    leadAssignees: [] as string[], // Changed from single to array
    vaIncharge: [] as string[], // Changed from single to array
    freelancer: '',
    assignees: [] as string[],
    codersRecommendation: '',
    leadership: '',
    githubLink: '',
    loomLink: '',
    whatsappGroupLink: '',
    tags: '',
    priority: 'medium',
    bonusPoints: 50,
    bonusCurrency: 0,
    penaltyPoints: 0,
    penaltyCurrency: 0,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEmployees();
    // Prefill form if editing
    if (isEdit && project) {
      const assignees = project.assignees || [];
      const assigneeIds = assignees.map((a: any) => 
        typeof a === 'object' && a._id ? a._id.toString() : a.toString()
      );
      
      // Handle leadAssignee (can be single or array)
      let leadAssigneeIds: string[] = [];
      if (project.leadAssignee) {
        if (Array.isArray(project.leadAssignee)) {
          leadAssigneeIds = project.leadAssignee.map((lead: any) =>
            typeof lead === 'object' && lead._id ? lead._id.toString() : lead.toString()
          );
        } else {
          const leadId = typeof project.leadAssignee === 'object' && project.leadAssignee._id
            ? project.leadAssignee._id.toString()
            : project.leadAssignee.toString();
          leadAssigneeIds = [leadId];
        }
      }
      
      // Handle vaIncharge (can be single or array)
      let vaInchargeIds: string[] = [];
      if (project.vaIncharge) {
        if (Array.isArray(project.vaIncharge)) {
          vaInchargeIds = project.vaIncharge.map((va: any) =>
            typeof va === 'object' && va._id ? va._id.toString() : va.toString()
          );
        } else {
          const vaId = typeof project.vaIncharge === 'object' && project.vaIncharge._id
            ? project.vaIncharge._id.toString()
            : project.vaIncharge.toString();
          vaInchargeIds = [vaId];
        }
      }
      
      setFormData({
        leadAssignees: leadAssigneeIds,
        vaIncharge: vaInchargeIds,
        assignees: assigneeIds,
        freelancer: project.freelancer || '',
        codersRecommendation: project.codersRecommendation || '',
        leadership: project.leadership || '',
        githubLink: project.githubLink || '',
        loomLink: project.loomLink || '',
        whatsappGroupLink: project.whatsappGroupLink || '',
        tags: project.tags?.join(', ') || '',
        priority: project.priority || 'medium',
        bonusPoints: project.bonusPoints ?? 50,
        bonusCurrency: project.bonusCurrency ?? 0,
        penaltyPoints: project.penaltyPoints ?? 0,
        penaltyCurrency: project.penaltyCurrency ?? 0,
      });
    }
  }, [isEdit, project]);

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees/approved');
      const data = await response.json();
      if (response.ok) {
        setEmployees(data.employees);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const getFilteredEmployees = () => {
    const filter = skillFilter.toLowerCase().trim();
    if (!filter) return employees;

    const filterTokens = filter
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (filterTokens.length === 0) return employees;

    return employees.filter((emp) => {
      const empSkills = (emp.skills || []).map((s) => s.toLowerCase());
      if (empSkills.length === 0) return false;
      // Match if every filter token is contained in at least one employee skill
      return filterTokens.every((token) =>
        empSkills.some((skill) => skill.includes(token))
      );
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate at least one lead assignee is selected
    if (formData.leadAssignees.length === 0) {
      alert('Please select at least one lead assignee');
      return;
    }
    
    // Validate no person is in multiple roles
    const allSelectedIds = new Set([
      ...formData.leadAssignees,
      ...formData.vaIncharge,
      ...formData.assignees
    ]);
    
    if (allSelectedIds.size !== (formData.leadAssignees.length + formData.vaIncharge.length + formData.assignees.length)) {
      alert('A person can only be assigned to one role at a time (Lead Assignee, VA Incharge, or Assignee). Please remove duplicates.');
      return;
    }
    
    setLoading(true);

    try {
      const response = await fetch('/api/admin/assign-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project._id,
          ...formData,
          tags: formData.tags.split(',').map(t => t.trim()).filter(t => t),
          assignees: formData.assignees, // Send assignees array
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const data = await response.json();
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error assigning project:', error);
      alert('Failed to assign project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full my-8">
        <div className="bg-linear-to-r from-emerald-600 to-emerald-700 px-6 py-4 rounded-t-2xl">
          <h2 className="text-2xl font-bold text-white">{isEdit ? 'Edit Project' : 'Assign Project'}</h2>
          <p className="text-emerald-100 text-sm mt-1">{project.projectName} - {project.clientName}</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Skills Filter + Lead Assignee */}
          <div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filter employees by skills
              </label>
              <input
                type="text"
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
                placeholder="e.g., React, Next.js"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Type one or more skills, separated by commas, to narrow down the employee list.
              </p>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lead Assignees <span className="text-red-500">*</span>
            </label>
            <div className="border border-gray-300 rounded-lg p-2 max-h-48 overflow-y-auto bg-white">
              {getFilteredEmployees().map((emp) => {
                const isInOtherRole = formData.vaIncharge.includes(emp._id) || formData.assignees.includes(emp._id);
                return (
                  <label key={emp._id} className={`flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer ${isInOtherRole ? 'opacity-50' : ''}`}>
                    <input
                      type="checkbox"
                      checked={formData.leadAssignees.includes(emp._id)}
                      disabled={isInOtherRole}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, leadAssignees: [...formData.leadAssignees, emp._id] });
                        } else {
                          setFormData({ ...formData, leadAssignees: formData.leadAssignees.filter(id => id !== emp._id) });
                        }
                      }}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-gray-700">
                      {emp.name} ({emp.email}
                      {emp.skills && emp.skills.length > 0
                        ? ` - ${emp.skills.join(', ')}`
                        : ''}
                      )
                      {isInOtherRole && <span className="text-red-500 text-xs ml-1">(Already assigned)</span>}
                    </span>
                  </label>
                );
              })}
            </div>
            {formData.leadAssignees.length > 0 && (
              <p className="mt-2 text-xs text-gray-500">
                {formData.leadAssignees.length} lead {formData.leadAssignees.length === 1 ? 'assignee' : 'assignees'} selected
              </p>
            )}
            {formData.leadAssignees.length === 0 && (
              <p className="mt-2 text-xs text-red-500">
                Please select at least one lead assignee
              </p>
            )}
          </div>

          {/* Grid for other fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">VA Incharge (Multiple)</label>
              <div className="border border-gray-300 rounded-lg p-2 max-h-48 overflow-y-auto bg-white">
                {getFilteredEmployees().map((emp) => {
                  const isInOtherRole = formData.leadAssignees.includes(emp._id) || formData.assignees.includes(emp._id);
                  return (
                    <label key={emp._id} className={`flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer ${isInOtherRole ? 'opacity-50' : ''}`}>
                      <input
                        type="checkbox"
                        checked={formData.vaIncharge.includes(emp._id)}
                        disabled={isInOtherRole}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, vaIncharge: [...formData.vaIncharge, emp._id] });
                          } else {
                            setFormData({ ...formData, vaIncharge: formData.vaIncharge.filter(id => id !== emp._id) });
                          }
                        }}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-gray-700">
                        {emp.name} ({emp.email}
                        {emp.skills && emp.skills.length > 0
                          ? ` - ${emp.skills.join(', ')}`
                          : ''}
                        )
                        {isInOtherRole && <span className="text-red-500 text-xs ml-1">(Already assigned)</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
              {formData.vaIncharge.length > 0 && (
                <p className="mt-2 text-xs text-gray-500">
                  {formData.vaIncharge.length} VA {formData.vaIncharge.length === 1 ? 'incharge' : 'incharges'} selected
                </p>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assignees (Multiple employees can be assigned to this project)
              </label>
              <div className="border border-gray-300 rounded-lg p-2 max-h-48 overflow-y-auto">
                {getFilteredEmployees().map((emp) => {
                  const isInOtherRole = formData.leadAssignees.includes(emp._id) || formData.vaIncharge.includes(emp._id);
                  return (
                    <label key={emp._id} className={`flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer ${isInOtherRole ? 'opacity-50' : ''}`}>
                      <input
                        type="checkbox"
                        checked={formData.assignees.includes(emp._id)}
                        disabled={isInOtherRole}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, assignees: [...formData.assignees, emp._id] });
                          } else {
                            setFormData({ ...formData, assignees: formData.assignees.filter(id => id !== emp._id) });
                          }
                        }}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-gray-700">
                        {emp.name} ({emp.email}
                        {emp.skills && emp.skills.length > 0
                          ? ` - ${emp.skills.join(', ')}`
                          : ''}
                        )
                        {isInOtherRole && <span className="text-red-500 text-xs ml-1">(Already assigned)</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
              {formData.assignees.length > 0 && (
                <p className="mt-2 text-xs text-gray-500">
                  {formData.assignees.length} {formData.assignees.length === 1 ? 'employee' : 'employees'} selected
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Freelancer</label>
              <input
                type="text"
                value={formData.freelancer}
                onChange={(e) => setFormData({ ...formData, freelancer: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Coders Recommendation</label>
              <input
                type="text"
                value={formData.codersRecommendation}
                onChange={(e) => setFormData({ ...formData, codersRecommendation: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Leadership</label>
              <input
                type="text"
                value={formData.leadership}
                onChange={(e) => setFormData({ ...formData, leadership: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bonus Points
              </label>
              <input
                type="number"
                min={0}
                value={formData.bonusPoints}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    bonusPoints: Number.isNaN(parseInt(e.target.value))
                      ? 0
                      : parseInt(e.target.value),
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bonus Currency (₹)
              </label>
              <input
                type="number"
                min={0}
                value={formData.bonusCurrency}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    bonusCurrency: Number.isNaN(parseInt(e.target.value))
                      ? 0
                      : parseInt(e.target.value),
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                Awarded when the project is completed successfully.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Penalty Points
              </label>
              <input
                type="number"
                min={0}
                value={formData.penaltyPoints}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    penaltyPoints: Number.isNaN(parseInt(e.target.value))
                      ? 0
                      : parseInt(e.target.value),
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Penalty Currency (₹)
              </label>
              <input
                type="number"
                min={0}
                value={formData.penaltyCurrency}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    penaltyCurrency: Number.isNaN(parseInt(e.target.value))
                      ? 0
                      : parseInt(e.target.value),
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                Applied as fine if the project misses its deadline.
              </p>
            </div>
          </div>

          {/* Links */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">GitHub Link</label>
              <input
                type="url"
                value={formData.githubLink}
                onChange={(e) => setFormData({ ...formData, githubLink: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="https://github.com/..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Loom Link</label>
              <input
                type="url"
                value={formData.loomLink}
                onChange={(e) => setFormData({ ...formData, loomLink: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="https://loom.com/..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">WhatsApp Group Link</label>
              <input
                type="url"
                value={formData.whatsappGroupLink}
                onChange={(e) => setFormData({ ...formData, whatsappGroupLink: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="https://chat.whatsapp.com/..."
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tags (comma-separated)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="web, mobile, urgent"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? (isEdit ? 'Updating...' : 'Assigning...') : (isEdit ? 'Update Project' : 'Assign Project')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


