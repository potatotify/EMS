"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  CheckSquare,
  Square,
  RefreshCw,
  Search,
  Calendar,
  Check,
  Trash2,
  User
} from "lucide-react";

interface ChecklistItem {
  label: string;
  checked: boolean;
  type: 'global' | 'role' | 'custom';
}

interface Employee {
  _id: string;
  name: string;
  email: string;
}

interface DailyUpdate {
  _id: string;
  employeeId: {
    _id: string;
    name: string;
    email: string;
  };
  date: string;
  status: "pending" | "submitted" | "reviewed" | "approved";
  adminNotes: string;
  adminApproved: boolean;

  // New dynamic checklist
  checklist?: ChecklistItem[];

  // Legacy fields (for backward compatibility)
  workedOnProject?: boolean;
  updatedDailyProgress?: boolean;
  recordedLoomVideos?: boolean;
  updatedClient?: boolean;
  completedAllTasks?: boolean;
  tasksForTheDay: string;
  hoursWorked: number;
  additionalNotes: string;
}

// Legacy fields mapping
const legacyFields = [
  { key: "workedOnProject", label: "Worked on Project" },
  { key: "updatedDailyProgress", label: "Daily Progress" },
  { key: "recordedLoomVideos", label: "Loom Videos" },
  { key: "updatedClient", label: "Updated Client" },
  { key: "completedAllTasks", label: "All Tasks Done" }
];

export default function DailyUpdatesReview() {
  const { data: session } = useSession();
  const [updates, setUpdates] = useState<DailyUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [filterStartDate, setFilterStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [filterEndDate, setFilterEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [filterEmployee, setFilterEmployee] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DailyUpdate>>({});
  const [bulkApproving, setBulkApproving] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchUpdates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStartDate, filterEndDate, filterEmployee]);

  const fetchEmployees = async () => {
    try {
      const response = await fetch("/api/employees/approved");
      const data = await response.json();
      if (response.ok && data.employees) {
        setEmployees(data.employees);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchUpdates = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      // For date range, we'll fetch all updates and filter on frontend
      // Or we can make multiple requests for each date in range
      if (filterEmployee) params.append("employeeId", filterEmployee);

      // If date range is same day, use single date query
      if (filterStartDate === filterEndDate) {
        params.append("date", filterStartDate);
        const url = `/api/daily-updates?${params.toString()}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
          setUpdates([]);
          return;
        }

        const normalizedUpdates = (Array.isArray(data) ? data : []).map((u: DailyUpdate) => {
          if (!u.checklist || u.checklist.length === 0) {
            return {
              ...u,
              checklist: legacyFields.map(f => ({
                label: f.label,
                checked: !!u[f.key as keyof DailyUpdate],
                type: "global" as const
              }))
            };
          }
          return u;
        });

        setUpdates(normalizedUpdates);
        
        const draftMap: Record<string, DailyUpdate> = {};
        normalizedUpdates.forEach((u) => {
          draftMap[u._id] = {
            ...u,
            checklist: u.checklist ? [...u.checklist] : []
          };
        });
        setDrafts(draftMap);
      } else {
        // Fetch for date range - we'll fetch without date filter and filter on frontend
        const url = `/api/daily-updates?${params.toString()}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
          setUpdates([]);
          return;
        }

        // Filter by date range on frontend
        const start = new Date(filterStartDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(filterEndDate);
        end.setHours(23, 59, 59, 999);

        const filteredData = (Array.isArray(data) ? data : []).filter((u: DailyUpdate) => {
          const updateDate = new Date(u.date);
          return updateDate >= start && updateDate <= end;
        });

        const normalizedUpdates = filteredData.map((u: DailyUpdate) => {
          if (!u.checklist || u.checklist.length === 0) {
            return {
              ...u,
              checklist: legacyFields.map(f => ({
                label: f.label,
                checked: !!u[f.key as keyof DailyUpdate],
                type: "global" as const
              }))
            };
          }
          return u;
        });

        setUpdates(normalizedUpdates);

        const draftMap: Record<string, DailyUpdate> = {};
        normalizedUpdates.forEach((u) => {
          draftMap[u._id] = {
            ...u,
            checklist: u.checklist ? [...u.checklist] : []
          };
        });
        setDrafts(draftMap);
      }
    } catch (error) {
      console.error("Error fetching updates:", error);
      setUpdates([]);
    } finally {
      setLoading(false);
    }
  };

  // Extract all unique checklist labels to form columns
  const checklistColumns = useMemo(() => {
    const labels = new Set<string>();
    updates.forEach(u => {
      u.checklist?.forEach(c => labels.add(c.label));
    });
    // Sort to keep consistent order, maybe prioritize legacy ones?
    return Array.from(labels).sort((a, b) => {
      const aIndex = legacyFields.findIndex(f => f.label === a);
      const bIndex = legacyFields.findIndex(f => f.label === b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [updates]);

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

  const handleChecklistChange = (updateId: string, label: string, checked: boolean) => {
    setDrafts((prev) => {
      const current = prev[updateId] || updates.find((u) => u._id === updateId);
      if (!current) return prev;

      const existingChecklist = current.checklist || [];
      let newChecklist = existingChecklist.map((item: ChecklistItem) =>
        item.label === label ? { ...item, checked } : item
      );

      // If the label doesn't exist yet (because columns come from all updates), add it
      const exists = newChecklist.find((item: ChecklistItem) => item.label === label);
      if (!exists) {
        newChecklist = [
          ...newChecklist,
          {
            label,
            checked,
            type: "custom"
          }
        ];
      }

      return {
        ...prev,
        [updateId]: {
          ...current,
          checklist: newChecklist
        }
      };
    });
  };

  const handleHoursChange = (updateId: string, value: string) => {
    const hours = value === "" ? 0 : Number(value);
    if (Number.isNaN(hours) || hours < 0) return;

    setDrafts((prev) => {
      const current = prev[updateId] || updates.find((u) => u._id === updateId);
      if (!current) return prev;

      return {
        ...prev,
        [updateId]: {
          ...current,
          hoursWorked: hours
        }
      };
    });
  };

  // Compare original update vs current draft to see if anything changed
  const isRowDirty = (original: DailyUpdate, draft: DailyUpdate) => {
    if (!draft) return false;

    // Hours changed
    if ((original.hoursWorked || 0) !== (draft.hoursWorked || 0)) {
      return true;
    }

    const origChecklist = original.checklist || [];
    const draftChecklist = draft.checklist || [];

    if (origChecklist.length !== draftChecklist.length) {
      return true;
    }

    // Compare checklist by label + checked flag (ignore order differences by normalizing)
    const normalizeList = (list: ChecklistItem[]) =>
      [...list]
        .map((c) => ({ label: c.label, checked: !!c.checked }))
        .sort((a, b) => a.label.localeCompare(b.label));

    const a = normalizeList(origChecklist);
    const b = normalizeList(draftChecklist);

    for (let i = 0; i < a.length; i++) {
      if (a[i].label !== b[i].label || a[i].checked !== b[i].checked) {
        return true;
      }
    }

    return false;
  };

  const buildApprovalPayload = (update: DailyUpdate) => {
    const checklist = update.checklist || [];

    return {
      status: "approved",
      adminApproved: true,
      checklist,
      tasksForTheDay: update.tasksForTheDay || "",
      hoursWorked: update.hoursWorked || 0,
      additionalNotes: update.additionalNotes || ""
    };
  };

  const approveSingle = async (updateId: string) => {
    const baseUpdate = drafts[updateId] || updates.find((u) => u._id === updateId);
    if (!baseUpdate) return;

    try {
      setApprovingId(updateId);
      const payload = buildApprovalPayload(baseUpdate);

      const response = await fetch(`/api/daily-updates/${updateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        alert("Failed to approve update");
        return;
      }

      // Refresh list to reflect latest data
      await fetchUpdates();
      setSelectedRows((prev) => {
        const next = new Set(prev);
        next.delete(updateId);
        return next;
      });
    } catch (error) {
      console.error("Error approving update:", error);
      alert("Error approving update");
    } finally {
      setApprovingId(null);
    }
  };

  const approveSelected = async () => {
    if (selectedRows.size === 0) return;

    try {
      setBulkApproving(true);
      const ids = Array.from(selectedRows);

      for (const id of ids) {
        const baseUpdate = drafts[id] || updates.find((u) => u._id === id);
        if (!baseUpdate) continue;

        const payload = buildApprovalPayload(baseUpdate);
        const response = await fetch(`/api/daily-updates/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          console.error("Failed to approve update", id);
        }
      }

      await fetchUpdates();
      setSelectedRows(new Set());
    } catch (error) {
      console.error("Error approving selected updates:", error);
      alert("Error approving selected updates");
    } finally {
      setBulkApproving(false);
    }
  };

  const deleteUpdate = async (updateId: string) => {
    if (!confirm("Are you sure you want to delete this daily update? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/daily-updates/${updateId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        alert("Failed to delete update");
        return;
      }

      // Remove from local state and refresh
      setUpdates((prev) => prev.filter((u) => u._id !== updateId));
      setDrafts((prev) => {
        const newDrafts = { ...prev };
        delete newDrafts[updateId];
        return newDrafts;
      });
      setSelectedRows((prev) => {
        const next = new Set(prev);
        next.delete(updateId);
        return next;
      });
      
      alert("Daily update deleted successfully");
    } catch (error) {
      console.error("Error deleting update:", error);
      alert("Error deleting update");
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
        className={`px-2.5 py-1 rounded-md text-xs font-medium border ${colors[status as keyof typeof colors] || colors.pending
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-neutral-500" />
              From Date
            </label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all bg-white shadow-sm hover:shadow-md"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-neutral-500" />
              To Date
            </label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all bg-white shadow-sm hover:shadow-md"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-neutral-500" />
              Employee (Optional)
            </label>
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all bg-white shadow-sm hover:shadow-md"
            >
              <option value="">All Employees</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
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
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider">
                  Hours
                </th>
                {checklistColumns.map((label) => (
                  <th
                    key={label}
                    className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wider"
                    title={label}
                  >
                    <div className="flex flex-col items-center">
                      <span className="whitespace-nowrap">{label}</span>
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
                    colSpan={checklistColumns.length + 8}
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
                  const currentData = drafts[update._id] || update;
                  const isSelected = selectedRows.has(update._id);
                  const isApproved = update.adminApproved || update.status === "approved";
                  const dirty = isRowDirty(update, currentData);

                  return (
                    <tr
                      key={update._id}
                      className={`transition-colors ${isSelected
                          ? "bg-emerald-50/50 hover:bg-emerald-100/50"
                          : "hover:bg-neutral-50/50"
                        }`}
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
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {isApproved ? (
                          getStatusBadge("approved")
                        ) : (
                          getStatusBadge(update.status)
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={currentData.hoursWorked ?? 0}
                          onChange={(e) =>
                            handleHoursChange(update._id, e.target.value)
                          }
                          className="w-20 px-2 py-1 border border-neutral-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                      </td>
                      {checklistColumns.map((label) => {
                        const item = currentData.checklist?.find((c: ChecklistItem) => c.label === label);
                        const isChecked = item?.checked || false;

                        return (
                          <td key={label} className="px-4 py-4 whitespace-nowrap text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) =>
                                handleChecklistChange(
                                  update._id,
                                  label,
                                  e.target.checked
                                )
                              }
                              className="w-5 h-5 text-emerald-600 rounded-lg focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                            />
                          </td>
                        );
                      })}
                      <td className="px-6 py-4 max-w-xs">
                        <div
                          className="truncate text-sm text-neutral-700"
                          title={currentData.tasksForTheDay || ""}
                        >
                          {currentData.tasksForTheDay || (
                            <span className="text-neutral-400 italic">No tasks listed</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          {isApproved ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold bg-green-100 text-green-800 border border-green-300">
                              <CheckCircle className="w-4 h-4" />
                              Approved
                            </span>
                          ) : (
                            <motion.button
                              whileHover={approvingId !== update._id ? { scale: 1.05 } : {}}
                              whileTap={approvingId !== update._id ? { scale: 0.97 } : {}}
                              disabled={approvingId === update._id || bulkApproving}
                              onClick={() => approveSingle(update._id)}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm border transition-all ${
                                approvingId === update._id || bulkApproving
                                  ? "bg-emerald-200 text-emerald-800 border-emerald-300 cursor-not-allowed opacity-60"
                                  : "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 hover:border-emerald-800"
                              }`}
                              title={
                                approvingId === update._id
                                  ? "Approving..."
                                  : "Approve this update"
                              }
                            >
                              <Check className="w-4 h-4" />
                              {approvingId === update._id ? "Approving..." : "Approve"}
                            </motion.button>
                          )}
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => deleteUpdate(update._id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm border bg-red-600 text-white border-red-700 hover:bg-red-700 hover:border-red-800 transition-all"
                            title="Delete this update"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </motion.button>
                        </div>
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
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between shadow-sm"
        >
          <div>
            <p className="text-sm text-emerald-900 font-semibold">
              {selectedRows.size} update{selectedRows.size !== 1 ? "s" : ""} selected for approval
            </p>
            <p className="text-xs text-emerald-800 mt-0.5">
              Checklist changes and hours will be saved when you approve.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedRows(new Set())}
              className="text-sm text-emerald-700 hover:text-emerald-900 font-medium underline transition-colors"
            >
              Clear selection
            </button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              disabled={bulkApproving}
              onClick={approveSelected}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm border transition-all ${
                bulkApproving
                  ? "bg-emerald-200 text-emerald-800 border-emerald-300 cursor-not-allowed"
                  : "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 hover:border-emerald-800"
              }`}
            >
              <Check className="w-4 h-4" />
              {bulkApproving ? "Approving..." : "Approve selected"}
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
