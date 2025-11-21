"use client";

import {useState, useEffect} from "react";
import {useSession} from "next-auth/react";
import {motion} from "framer-motion";
import {CheckCircle, XCircle, CheckSquare, Square, Edit2, Save, X, RefreshCw, Search, Calendar} from "lucide-react";

interface DailyUpdate {
  _id: string;
  employeeId: {
    _id: string;
    name: string;
    email: string;
  };
  date: string;
  status: "pending" | "submitted" | "reviewed" | "approved";
  score: number;
  adminScore: number;
  adminNotes: string;
  adminApproved: boolean;

  // Essential Daily Updates
  workedOnProject: boolean;
  updatedDailyProgress: boolean;
  recordedLoomVideos: boolean;
  updatedClient: boolean;
  completedAllTasks: boolean;
  tasksForTheDay: string;
  hoursWorked: number;
  additionalNotes: string;
}

// Define only essential checkbox fields
const checkboxFields = [
  {key: "workedOnProject", label: "Worked on Project", shortLabel: "Project"},
  {key: "updatedDailyProgress", label: "Daily Progress", shortLabel: "Progress"},
  {key: "recordedLoomVideos", label: "Loom Videos", shortLabel: "Loom"},
  {key: "updatedClient", label: "Updated Client", shortLabel: "Client"},
  {key: "completedAllTasks", label: "All Tasks Done", shortLabel: "Done"}
];

export default function DailyUpdatesReview() {
  const {data: session} = useSession();
  const [updates, setUpdates] = useState<DailyUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [filterDate, setFilterDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [filterEmployee, setFilterEmployee] = useState("");
  const [editingUpdate, setEditingUpdate] = useState<string | null>(null);
  const [editData, setEditData] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchUpdates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDate, filterEmployee]);

  const fetchUpdates = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterDate) params.append("date", filterDate);
      if (filterEmployee) params.append("employeeId", filterEmployee);

      const url = `/api/daily-updates?${params.toString()}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        setUpdates([]);
        return;
      }

      setUpdates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching updates:", error);
      setUpdates([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleRowSelection = (updateId: string) => {
    setSelectedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(updateId)) {
        newSet.delete(updateId);
      } else {
        newSet.add(updateId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === updates.length && updates.length > 0) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(updates.map((u) => u._id)));
    }
  };

  const handleCheckboxChange = (updateId: string, field: string, value: boolean) => {
    if (!editData[updateId]) {
      const update = updates.find((u) => u._id === updateId);
      if (update) {
        setEditData((prev) => ({
          ...prev,
          [updateId]: {...update}
        }));
      }
    }
    setEditData((prev) => ({
      ...prev,
      [updateId]: {
        ...prev[updateId],
        [field]: value
      }
    }));
  };

  const calculateAutoScore = (data: DailyUpdate | any) => {
    let checkedCount = 0;
    checkboxFields.forEach((field) => {
      if (data[field.key]) checkedCount++;
    });
    // Score based on essential fields (5 fields = 100%)
    return Math.round((checkedCount / checkboxFields.length) * 100);
  };

  const handleSaveUpdate = async (updateId: string) => {
    const update = editData[updateId];
    if (!update) return;

    try {
      const autoScore = calculateAutoScore(update);
      const response = await fetch(`/api/daily-updates/${updateId}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          status: "reviewed",
          adminScore: autoScore,
          adminNotes: update.adminNotes || "",
          adminApproved: update.adminApproved || false,
          ...Object.fromEntries(
            checkboxFields.map((f) => [f.key, update[f.key] || false])
          ),
          tasksForTheDay: update.tasksForTheDay || "",
          hoursWorked: update.hoursWorked || 0,
          additionalNotes: update.additionalNotes || ""
        })
      });

      if (response.ok) {
        setEditingUpdate(null);
        setEditData((prev) => {
          const newData = {...prev};
          delete newData[updateId];
          return newData;
        });
        fetchUpdates();
        alert("Update saved successfully!");
      } else {
        alert("Failed to save update");
      }
    } catch (error) {
      console.error("Error saving update:", error);
      alert("Error saving update");
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      approved: "bg-green-100 text-green-800 border-green-200",
      reviewed: "bg-blue-100 text-blue-800 border-blue-200",
      submitted: "bg-yellow-100 text-yellow-800 border-yellow-200",
      pending: "bg-gray-100 text-gray-800 border-gray-200"
    };
    return (
      <span
        className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
          colors[status as keyof typeof colors] || colors.pending
        }`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading updates...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Daily Updates Review</h2>
            <p className="text-sm text-neutral-600 mt-1.5">
              Review and manage employee daily updates
            </p>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 bg-neutral-50 rounded-xl border border-neutral-200">
            <span className="text-sm font-medium text-neutral-700">
              {updates.length} update{updates.length !== 1 ? 's' : ''} found
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-neutral-500" />
              Date
            </label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all bg-white shadow-sm hover:shadow-md"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2 flex items-center gap-2">
              <Search className="w-4 h-4 text-neutral-500" />
              Employee (Optional)
            </label>
            <input
              type="text"
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              placeholder="Filter by employee ID or name"
              className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all bg-white shadow-sm hover:shadow-md placeholder-neutral-400"
            />
          </div>
          <div className="flex items-end">
            <motion.button
              whileHover={{scale: 1.02}}
              whileTap={{scale: 0.98}}
              onClick={fetchUpdates}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </motion.button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleSelectAll}
                      className="hover:opacity-80 transition-opacity p-1 rounded-lg hover:bg-white/10"
                      title="Select All"
                    >
                      {selectedRows.size === updates.length && updates.length > 0 ? (
                        <CheckSquare className="w-5 h-5" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                    <span>Select</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider">
                  Hours
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider">
                  Score
                </th>
                {checkboxFields.map((field) => (
                  <th
                    key={field.key}
                    className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wider"
                    title={field.label}
                  >
                    <div className="flex flex-col items-center">
                      <span className="hidden md:inline">{field.label}</span>
                      <span className="md:hidden">{field.shortLabel}</span>
                    </div>
                  </th>
                ))}
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider min-w-[200px]">
                  Tasks
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-100">
              {updates.length === 0 ? (
                <tr>
                  <td
                    colSpan={checkboxFields.length + 8}
                    className="px-6 py-16 text-center"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center">
                        <Search className="w-8 h-8 text-neutral-400" />
                      </div>
                      <p className="text-lg font-semibold text-neutral-900">No updates found</p>
                      <p className="text-sm text-neutral-500">
                        Try adjusting your filters or check back later
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                updates.map((update) => {
                  const isEditing = editingUpdate === update._id;
                  const currentData = isEditing
                    ? editData[update._id] || update
                    : update;
                  const isSelected = selectedRows.has(update._id);

                  return (
                    <tr
                      key={update._id}
                      className={`transition-colors ${
                        isSelected 
                          ? "bg-emerald-50/50 hover:bg-emerald-100/50" 
                          : "hover:bg-neutral-50/50"
                      } ${isEditing ? "bg-blue-50/50" : ""}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => toggleRowSelection(update._id)}
                          className="hover:opacity-80 transition-opacity p-1.5 rounded-lg hover:bg-neutral-200"
                          title={isSelected ? "Deselect" : "Select"}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <Square className="w-5 h-5 text-neutral-400" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="font-semibold text-neutral-900">
                            {update.employeeId.name}
                          </div>
                          <div className="text-xs text-neutral-500 mt-0.5">
                            {update.employeeId.email}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-neutral-700">
                          {new Date(update.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(update.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm font-semibold text-neutral-900">
                          {update.hoursWorked || 0}h
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-sm font-bold ${
                          (update.adminScore || update.score || 0) >= 80 
                            ? 'bg-green-100 text-green-700' 
                            : (update.adminScore || update.score || 0) >= 60 
                            ? 'bg-yellow-100 text-yellow-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {update.adminScore || update.score || 0}%
                        </span>
                      </td>
                      {checkboxFields.map((field) => (
                        <td key={field.key} className="px-4 py-4 whitespace-nowrap text-center">
                          {isEditing ? (
                            <input
                              type="checkbox"
                              checked={currentData[field.key] || false}
                              onChange={(e) =>
                                handleCheckboxChange(
                                  update._id,
                                  field.key,
                                  e.target.checked
                                )
                              }
                              className="w-5 h-5 text-emerald-600 rounded-lg focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                            />
                          ) : (
                            <div className="flex justify-center">
                              {currentData[field.key] ? (
                                <CheckCircle className="w-6 h-6 text-green-600" />
                              ) : (
                                <XCircle className="w-6 h-6 text-neutral-300" />
                              )}
                            </div>
                          )}
                        </td>
                      ))}
                      <td className="px-6 py-4 max-w-xs">
                        <div className="truncate text-sm text-neutral-700" title={update.tasksForTheDay || ""}>
                          {update.tasksForTheDay || (
                            <span className="text-neutral-400 italic">No tasks listed</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {isEditing ? (
                          <div className="flex gap-2 justify-center">
                            <motion.button
                              whileHover={{scale: 1.1}}
                              whileTap={{scale: 0.9}}
                              onClick={() => handleSaveUpdate(update._id)}
                              className="p-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:from-emerald-600 hover:to-teal-700 transition-all shadow-md hover:shadow-lg"
                              title="Save changes"
                            >
                              <Save className="w-4 h-4" />
                            </motion.button>
                            <motion.button
                              whileHover={{scale: 1.1}}
                              whileTap={{scale: 0.9}}
                              onClick={() => {
                                setEditingUpdate(null);
                                setEditData((prev) => {
                                  const newData = {...prev};
                                  delete newData[update._id];
                                  return newData;
                                });
                              }}
                              className="p-2 bg-neutral-400 text-white rounded-lg hover:bg-neutral-500 transition-all shadow-md hover:shadow-lg"
                              title="Cancel editing"
                            >
                              <X className="w-4 h-4" />
                            </motion.button>
                          </div>
                        ) : (
                          <motion.button
                            whileHover={{scale: 1.1}}
                            whileTap={{scale: 0.9}}
                            onClick={() => setEditingUpdate(update._id)}
                            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
                            title="Edit update"
                          >
                            <Edit2 className="w-4 h-4" />
                          </motion.button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRows.size > 0 && (
        <motion.div
          initial={{opacity: 0, y: 10}}
          animate={{opacity: 1, y: 0}}
          className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between shadow-sm"
        >
          <p className="text-sm text-emerald-900 font-semibold">
            {selectedRows.size} row{selectedRows.size !== 1 ? 's' : ''} selected
          </p>
          <button
            onClick={() => setSelectedRows(new Set())}
            className="text-sm text-emerald-700 hover:text-emerald-900 font-medium underline transition-colors"
          >
            Clear selection
          </button>
        </motion.div>
      )}
    </div>
  );
}
