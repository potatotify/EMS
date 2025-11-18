// src/components/admin/EmployeeDetailModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Clock, CheckCircle, XCircle, Clock as ClockIcon, Mail, Phone, Briefcase, ClipboardList } from 'lucide-react';

interface EmployeeProfile {
  _id: string;
  fullName: string;
  email: string;
  phone?: string;
  designation?: string;
  department?: string;
  joiningDate?: string;
}

interface AttendanceRecord {
  _id: string;
  userId: string;
  date: string;
  workDetails: string;
  status?: string; // Add status field
  createdAt: string;
}

interface DailyUpdate {
  _id: string;
  date: string;
  tasksCompleted: string[];
  challenges?: string;
  nextSteps?: string;
  notes?: string;
}

interface Props {
  employeeId: string;
  onClose: () => void;
}

export default function EmployeeDetailModal({ employeeId, onClose }: Props) {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [dailyUpdates, setDailyUpdate] = useState<DailyUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('attendance'); // Default to attendance tab

  useEffect(() => {
    fetchEmployeeDetails();
  }, [employeeId]);

  const fetchEmployeeDetails = async () => {
    setLoading(true);
    try {
      console.log('Fetching employee details for ID:', employeeId);
      const response = await fetch(`/api/admin/employee/${employeeId}`);
      const data = await response.json();
      console.log('API Response:', data);
      if (response.ok) {
        setProfile(data.profile);
        setAttendance(data.attendanceRecords || []);
        setDailyUpdate(data.dailyUpdates || []);
      } else {
        console.error('Error fetching employee details:', data.error);
      }
    } catch (error) {
      console.error('Error fetching employee details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white/95 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-emerald-100/50">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-200 border-t-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading employee details...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-emerald-100/50">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 rounded-t-2xl flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Employee Details</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 p-1 rounded-full transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('profile')}
              className={`${
                activeTab === 'profile'
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
            >
              Profile
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`${
                activeTab === 'attendance'
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
            >
              Attendance ({attendance.length})
            </button>
            <button
              onClick={() => setActiveTab('updates')}
              className={`${
                activeTab === 'updates'
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
            >
              Daily Updates ({dailyUpdates.length})
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 flex-1">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4 p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100/50">
                <div className="h-20 w-20 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-2xl font-bold shadow-md">
                  {profile.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{profile.fullName}</h1>
                  <p className="text-emerald-700 font-medium">{profile.designation || 'Employee'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-emerald-100/50 bg-white/50 backdrop-blur-sm">
                  <h3 className="text-sm font-semibold text-emerald-900 mb-3">Contact Information</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <Mail className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">Email</p>
                        <p className="text-sm font-medium text-gray-900 truncate">{profile.email}</p>
                      </div>
                    </div>
                    {profile.phone && (
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-teal-100 flex items-center justify-center">
                          <Phone className="h-4 w-4 text-teal-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500">Phone</p>
                          <p className="text-sm font-medium text-gray-900">{profile.phone}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-emerald-100/50 bg-white/50 backdrop-blur-sm">
                  <h3 className="text-sm font-semibold text-emerald-900 mb-3">Employment Details</h3>
                  <div className="space-y-3">
                    {profile.department && (
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                          <Briefcase className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500">Department</p>
                          <p className="text-sm font-medium text-gray-900">{profile.department}</p>
                        </div>
                      </div>
                    )}
                    {profile.joiningDate && (
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-teal-100 flex items-center justify-center">
                          <Calendar className="h-4 w-4 text-teal-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500">Joined</p>
                          <p className="text-sm font-medium text-gray-900">{new Date(profile.joiningDate).toLocaleDateString()}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">Attendance Records</h3>
                <div className="text-sm text-gray-500">
                  Showing {attendance.length} records
                </div>
              </div>

              {attendance.length > 0 ? (
                <div className="overflow-hidden border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Date & Time
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Status
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Work Details
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {attendance.map((record) => (
                        <tr key={record._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center">
                              <Calendar className="flex-shrink-0 h-4 w-4 text-gray-400 mr-2" />
                              {formatDate(record.date)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {record.status ? (
                              <span
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  record.status === 'present'
                                    ? 'bg-green-100 text-green-800'
                                    : record.status === 'absent'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {record.status === 'present' ? (
                                  <CheckCircle className="inline h-3 w-3 mr-1" />
                                ) : record.status === 'absent' ? (
                                  <XCircle className="inline h-3 w-3 mr-1" />
                                ) : (
                                  <ClockIcon className="inline h-3 w-3 mr-1" />
                                )}
                                {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                              </span>
                            ) : (
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                <ClockIcon className="inline h-3 w-3 mr-1" />
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {record.workDetails || 'No details provided'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                  <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No attendance records</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No attendance records found for this employee.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'updates' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">Daily Updates</h3>
                <div className="text-sm text-gray-500">
                  Showing {dailyUpdates.length} updates
                </div>
              </div>

              {dailyUpdates.length > 0 ? (
                <div className="space-y-4">
                  {dailyUpdates.map((update) => (
                    <div
                      key={update._id}
                      className="group border border-emerald-100/50 rounded-xl overflow-hidden bg-white/50 backdrop-blur-sm hover:border-emerald-200 hover:shadow-md transition-all duration-300"
                    >
                      <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100/50">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                              <Calendar className="h-4 w-4 text-emerald-600" />
                            </div>
                            <span className="text-sm font-semibold text-gray-900">
                              {formatDate(update.date)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 space-y-4">
                        {update.tasksCompleted && update.tasksCompleted.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">
                              Tasks Completed
                            </h4>
                            <ul className="list-disc pl-5 space-y-1">
                              {update.tasksCompleted.map((task, idx) => (
                                <li key={idx} className="text-sm text-gray-600">
                                  {task}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {update.challenges && (
                          <div className="mb-4">
                            <h4 className="text-sm font-medium text-gray-700 mb-1">
                              Challenges Faced
                            </h4>
                            <p className="text-sm text-gray-600">{update.challenges}</p>
                          </div>
                        )}
                        {update.nextSteps && (
                          <div className="mb-4">
                            <h4 className="text-sm font-medium text-gray-700 mb-1">
                              Next Steps
                            </h4>
                            <p className="text-sm text-gray-600">{update.nextSteps}</p>
                          </div>
                        )}
                        {update.notes && (
                          <div className="pt-3 mt-3 border-t border-gray-100">
                            <h4 className="text-sm font-medium text-gray-700 mb-1">Notes</h4>
                            <p className="text-sm text-gray-600">{update.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                  <ClipboardList className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No daily updates</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No daily updates found for this employee.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}