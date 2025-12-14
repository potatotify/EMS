"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet, RefreshCw, Plus, X } from "lucide-react";
import LoadingSpinner from "@/components/shared/LoadingSpinner";

interface CustomEntry {
  value: number;
  type: 'points' | 'currency';
  description: string;
}

interface BonusRow {
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  projectRewardTotal: number;
  projectRewardTotalCurrency: number;
  projectEarned: number;
  projectEarnedCurrency: number;
  projectFine: number;
  projectFineCurrency: number;
  checklistRewardTotal: number;
  checklistRewardTotalCurrency: number;
  checklistEarned: number;
  checklistEarnedCurrency: number;
  checklistFine: number;
  checklistFineCurrency: number;
  taskRewardTotal: number;
  taskRewardTotalCurrency: number;
  taskEarned: number;
  taskEarnedCurrency: number;
  taskFine: number;
  taskFineCurrency: number;
  hackathonEarned: number;
  hackathonEarnedCurrency: number;
  customBonusEntries?: CustomEntry[];
  customFineEntries?: CustomEntry[];
  totalPoints: number;
  totalCurrency: number;
}

export default function BonusPointsSheet() {
  const [rows, setRows] = useState<BonusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [startDateFilter, setStartDateFilter] = useState<string>("");
  const [endDateFilter, setEndDateFilter] = useState<string>("");
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [savingCell, setSavingCell] = useState<string | null>(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/bonus-summary", {
        cache: "no-store",
      });
      const data = await response.json();
      if (response.ok) {
        setRows(data.rows || []);
      } else {
        setError(data.error || "Failed to fetch bonus summary");
      }
    } catch (err) {
      console.error("Error fetching bonus summary:", err);
      setError("Error fetching bonus summary");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const handleCustomFieldUpdate = async (
    employeeId: string,
    date: string,
    field: 'customBonus' | 'customFine',
    entries: CustomEntry[]
  ) => {
    const cellKey = `${employeeId}-${date}-${field}`;
    setSavingCell(cellKey);
    
    try {
      const response = await fetch('/api/admin/bonus-summary/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          date,
          field,
          entries
        })
      });

      if (response.ok) {
        // Update local state
        setRows(prevRows => prevRows.map(row => {
          if (row.employeeId === employeeId && row.date === date) {
            if (field === 'customBonus') {
              return {
                ...row,
                customBonusEntries: entries
              };
            } else {
              return {
                ...row,
                customFineEntries: entries
              };
            }
          }
          return row;
        }));
        setEditingCell(null);
      } else {
        alert('Failed to save custom field');
      }
    } catch (error) {
      console.error('Error saving custom field:', error);
      alert('Error saving custom field');
    } finally {
      setSavingCell(null);
    }
  };

  const employeeOptions = Array.from(
    new Set(rows.map((r) => r.employeeName).filter(Boolean))
  ).sort();

  const filteredRows = rows.filter((row) => {
    if (employeeFilter !== "all" && row.employeeName !== employeeFilter) {
      return false;
    }

    if (startDateFilter) {
      if (row.date < startDateFilter) return false;
    }

    if (endDateFilter) {
      if (row.date > endDateFilter) return false;
    }

    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
          <h2 className="text-2xl font-bold text-neutral-900">
            Bonus Points Summary
          </h2>
        </div>
        <div className="flex flex-col items-end gap-2">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 justify-end text-xs">
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="bg-white border border-neutral-300 rounded-lg px-2 py-1 text-xs text-neutral-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
            >
              <option value="all">All Employees</option>
              {employeeOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <span className="text-neutral-500">From</span>
              <input
                type="date"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
                className="bg-white border border-neutral-300 rounded-lg px-2 py-1 text-xs text-neutral-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-neutral-500">To</span>
              <input
                type="date"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
                className="bg-white border border-neutral-300 rounded-lg px-2 py-1 text-xs text-neutral-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={fetchRows}
              className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              {/* Main header row with category names */}
              <tr className="bg-gradient-to-b from-neutral-100 to-neutral-50 border-b-2 border-neutral-300">
                <th className="px-4 py-3 text-left text-xs font-bold text-neutral-800 uppercase tracking-wide border-r border-neutral-300 min-w-[110px]" rowSpan={2}>
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-neutral-800 uppercase tracking-wide border-r border-neutral-300 min-w-[150px]" rowSpan={2}>
                  Employee
                </th>
                <th className="px-3 py-2 text-center text-xs font-bold text-blue-700 border-r border-neutral-300" colSpan={3}>
                  Projects
                </th>
                <th className="px-3 py-2 text-center text-xs font-bold text-purple-700 border-r border-neutral-300" colSpan={3}>
                  Checklists
                </th>
                <th className="px-3 py-2 text-center text-xs font-bold text-orange-700 border-r border-neutral-300" colSpan={3}>
                  Tasks
                </th>
                <th className="px-3 py-2 text-center text-xs font-bold text-yellow-700 border-r border-neutral-300" colSpan={1}>
                  Hackathons
                </th>
                <th className="px-3 py-2 text-center text-xs font-bold text-indigo-700 border-r border-neutral-300" colSpan={1}>
                  Custom Bonus
                </th>
                <th className="px-3 py-2 text-center text-xs font-bold text-rose-700 border-r border-neutral-300" colSpan={1}>
                  Custom Fine
                </th>
                <th className="px-3 py-2 text-center text-xs font-bold text-neutral-800" colSpan={1}>
                  Net Total
                </th>
              </tr>
              {/* Sub-header row with Points/Currency columns */}
              <tr className="bg-neutral-50 border-b border-neutral-200">
                {/* Projects */}
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-neutral-600 border-r border-neutral-200">
                  <div className="mb-0.5">Total</div>
                  <div className="text-green-600 font-medium">Pts | ₹</div>
                </th>
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-neutral-600 border-r border-neutral-200">
                  <div className="mb-0.5">Earned</div>
                  <div className="text-green-600 font-medium">Pts | ₹</div>
                </th>
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-neutral-600 border-r border-neutral-300">
                  <div className="mb-0.5">Fine</div>
                  <div className="text-red-600 font-medium">Pts | ₹</div>
                </th>
                {/* Checklists */}
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-600 border-r border-neutral-200 min-w-[100px]">
                  <div className="mb-1">Total</div>
                  <div className="text-green-600 font-medium">Pts | ₹</div>
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-600 border-r border-neutral-200 min-w-[100px]">
                  <div className="mb-1">Earned</div>
                  <div className="text-green-600 font-medium">Pts | ₹</div>
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-600 border-r border-neutral-300 min-w-[100px]">
                  <div className="mb-1">Fine</div>
                  <div className="text-red-600 font-medium">Pts | ₹</div>
                </th>
                {/* Tasks */}
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-600 border-r border-neutral-200 min-w-[100px]">
                  <div className="mb-1">Total</div>
                  <div className="text-green-600 font-medium">Pts | ₹</div>
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-600 border-r border-neutral-200 min-w-[100px]">
                  <div className="mb-1">Earned</div>
                  <div className="text-green-600 font-medium">Pts | ₹</div>
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-600 border-r border-neutral-300 min-w-[100px]">
                  <div className="mb-1">Fine</div>
                  <div className="text-red-600 font-medium">Pts | ₹</div>
                </th>
                {/* Hackathons */}
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-600 border-r border-neutral-300 min-w-[100px]">
                  <div className="mb-1">Earned</div>
                  <div className="text-yellow-600 font-medium">Pts | ₹</div>
                </th>
                {/* Custom Bonus */}
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-600 border-r border-neutral-300 min-w-[140px]">
                  <div className="text-indigo-600 font-medium">Pts | ₹</div>
                </th>
                {/* Custom Fine */}
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-600 border-r border-neutral-300 min-w-[140px]">
                  <div className="text-rose-600 font-medium">Pts | ₹</div>
                </th>
                {/* Net Total */}
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-600 min-w-[120px]">
                  <div className="text-neutral-800 font-medium">Pts | ₹</div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={15}
                    className="px-4 py-8 text-center text-neutral-500"
                  >
                    No bonus data found for selected filters
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, index) => (
                  <tr
                    key={`${row.employeeId}-${row.date}-${index}`}
                    className="hover:bg-blue-50/30 transition-colors"
                  >
                    <td className="px-4 py-3.5 text-sm text-neutral-800 border-r border-neutral-200">
                      {row.date}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-neutral-900 border-r border-neutral-200 font-medium">
                      {row.employeeName}
                    </td>
                    {/* Projects */}
                    <td className="px-4 py-4 text-sm text-center border-r border-neutral-200">
                      <div className="text-neutral-700">{row.projectRewardTotal || 0} | ₹{row.projectRewardTotalCurrency || 0}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-center border-r border-neutral-200">
                      <div className="text-green-600 font-medium">{row.projectEarned || 0} | ₹{row.projectEarnedCurrency || 0}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-center border-r border-neutral-300">
                      <div className="text-red-600 font-medium">{row.projectFine || 0} | ₹{row.projectFineCurrency || 0}</div>
                    </td>
                    {/* Checklists */}
                    <td className="px-4 py-4 text-sm text-center border-r border-neutral-200">
                      <div className="text-neutral-700">{row.checklistRewardTotal || 0} | ₹{row.checklistRewardTotalCurrency || 0}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-center border-r border-neutral-200">
                      <div className="text-green-600 font-medium">{row.checklistEarned || 0} | ₹{row.checklistEarnedCurrency || 0}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-center border-r border-neutral-300">
                      <div className="text-red-600 font-medium">{row.checklistFine || 0} | ₹{row.checklistFineCurrency || 0}</div>
                    </td>
                    {/* Tasks */}
                    <td className="px-4 py-4 text-sm text-center border-r border-neutral-200">
                      <div className="text-neutral-700">{row.taskRewardTotal || 0} | ₹{row.taskRewardTotalCurrency || 0}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-center border-r border-neutral-200">
                      <div className="text-green-600 font-medium">{row.taskEarned || 0} | ₹{row.taskEarnedCurrency || 0}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-center border-r border-neutral-300">
                      <div className="text-red-600 font-medium">{row.taskFine || 0} | ₹{row.taskFineCurrency || 0}</div>
                    </td>
                    {/* Hackathons */}
                    <td className="px-4 py-4 text-sm text-center border-r border-neutral-300">
                      <div className="text-yellow-700 font-medium">{row.hackathonEarned || 0} | ₹{row.hackathonEarnedCurrency || 0}</div>
                    </td>
                    {/* Custom Bonus */}
                    <td className="px-3 py-3.5 text-sm text-center border-r border-neutral-300">
                      <button
                        onClick={() => setEditingCell(`${row.employeeId}-${row.date}-customBonus`)}
                        className="w-full cursor-pointer hover:bg-indigo-50 p-2 rounded-md transition-colors group min-h-[60px] flex flex-col items-center justify-center"
                        title="Click to edit custom bonus"
                      >
                        {row.customBonusEntries && row.customBonusEntries.length > 0 ? (
                          <div className="space-y-1 w-full">
                            {row.customBonusEntries.slice(0, 2).map((entry, idx) => (
                              <div key={idx} className="text-[11px] whitespace-nowrap">
                                <span className="text-indigo-700 font-semibold">
                                  {entry.type === 'points' ? `${entry.value} ` : `₹${entry.value} `}
                                </span>
                                <span className="text-neutral-600">
                                  {entry.description || 'No description'}
                                </span>
                              </div>
                            ))}
                            {row.customBonusEntries.length > 2 && (
                              <div className="text-[10px] text-neutral-400 font-medium">+{row.customBonusEntries.length - 2} more</div>
                            )}
                          </div>
                        ) : (
                          <div className="text-neutral-400 group-hover:text-indigo-600 transition-colors text-xs">Click to add</div>
                        )}
                      </button>
                    </td>
                    {/* Custom Fine */}
                    <td className="px-3 py-3.5 text-sm text-center border-r border-neutral-300">
                      <button
                        onClick={() => setEditingCell(`${row.employeeId}-${row.date}-customFine`)}
                        className="w-full cursor-pointer hover:bg-rose-50 p-2 rounded-md transition-colors group min-h-[60px] flex flex-col items-center justify-center"
                        title="Click to edit custom fine"
                      >
                        {row.customFineEntries && row.customFineEntries.length > 0 ? (
                          <div className="space-y-1 w-full">
                            {row.customFineEntries.slice(0, 2).map((entry, idx) => (
                              <div key={idx} className="text-[11px] whitespace-nowrap">
                                <span className="text-rose-700 font-semibold">
                                  {entry.type === 'points' ? `${entry.value} ` : `₹${entry.value} `}
                                </span>
                                <span className="text-neutral-600">
                                  {entry.description || 'No description'}
                                </span>
                              </div>
                            ))}
                            {row.customFineEntries.length > 2 && (
                              <div className="text-[10px] text-neutral-400 font-medium">+{row.customFineEntries.length - 2} more</div>
                            )}
                          </div>
                        ) : (
                          <div className="text-neutral-400 group-hover:text-rose-600 transition-colors text-xs">Click to add</div>
                        )}
                      </button>
                    </td>
                    {/* Net Total */}
                    <td className="px-3 py-3.5 text-sm text-center font-bold">
                      {(() => {
                        const customBonusPts = (row.customBonusEntries || []).filter(e => e.type === 'points').reduce((sum, e) => sum + e.value, 0);
                        const customFinePts = (row.customFineEntries || []).filter(e => e.type === 'points').reduce((sum, e) => sum + e.value, 0);
                        const customBonusCurr = (row.customBonusEntries || []).filter(e => e.type === 'currency').reduce((sum, e) => sum + e.value, 0);
                        const customFineCurr = (row.customFineEntries || []).filter(e => e.type === 'currency').reduce((sum, e) => sum + e.value, 0);
                        const netPoints = row.totalPoints + customBonusPts - customFinePts;
                        const netCurrency = row.totalCurrency + customBonusCurr - customFineCurr;
                        return (
                          <div className={netPoints >= 0 && netCurrency >= 0 ? "text-green-600" : "text-red-600"}>
                            {netPoints} | ₹{netCurrency}
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Overlay for Custom Field Editor */}
      {editingCell && (() => {
        const isBonus = editingCell.includes('customBonus');
        const currentRow = rows.find(r => `${r.employeeId}-${r.date}-${isBonus ? 'customBonus' : 'customFine'}` === editingCell);
        const [employeeId, date] = editingCell.split('-');
        
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditingCell(null)}>
            <div onClick={(e) => e.stopPropagation()}>
              <CustomFieldEditor
                entries={isBonus ? (currentRow?.customBonusEntries || []) : (currentRow?.customFineEntries || [])}
                onSave={(entries) => {
                  handleCustomFieldUpdate(employeeId, date, isBonus ? 'customBonus' : 'customFine', entries);
                }}
                onCancel={() => setEditingCell(null)}
                saving={savingCell === editingCell}
                title={isBonus ? 'Edit Custom Bonus' : 'Edit Custom Fine'}
              />
            </div>
          </div>
        );
      })()}

      {/* Summary */}
      <div className="text-sm text-neutral-600">
        Rows: <span className="font-semibold">{filteredRows.length}</span>
      </div>
    </div>
  );
}

// Custom Field Editor Component - Modal version
function CustomFieldEditor({
  entries,
  onSave,
  onCancel,
  saving,
  title
}: {
  entries: CustomEntry[];
  onSave: (entries: CustomEntry[]) => void;
  onCancel: () => void;
  saving: boolean;
  title: string;
}) {
  const [localEntries, setLocalEntries] = useState<CustomEntry[]>(
    entries.length > 0 ? entries : [{ value: 0, type: 'points', description: '' }]
  );

  const addEntry = () => {
    setLocalEntries([...localEntries, { value: 0, type: 'points', description: '' }]);
  };

  const removeEntry = (index: number) => {
    if (localEntries.length > 1) {
      setLocalEntries(localEntries.filter((_, i) => i !== index));
    }
  };

  const updateEntry = (index: number, field: 'value' | 'type' | 'description', value: string | number | 'points' | 'currency') => {
    const updated = [...localEntries];
    if (field === 'value') {
      updated[index].value = Number(value);
    } else if (field === 'type') {
      updated[index].type = value as 'points' | 'currency';
    } else {
      updated[index].description = String(value);
    }
    setLocalEntries(updated);
  };

  return (
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-blue-50">
        <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
        <button
          onClick={onCancel}
          disabled={saving}
          className="text-neutral-500 hover:text-neutral-700 disabled:opacity-50 p-1.5 rounded-lg hover:bg-white/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {localEntries.map((entry, index) => (
          <div key={index} className="bg-neutral-50 border-2 border-neutral-200 rounded-xl p-4 space-y-3 hover:border-emerald-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-700 bg-white px-2 py-1 rounded-md">Entry #{index + 1}</span>
              {localEntries.length > 1 && (
                <button
                  onClick={() => removeEntry(index)}
                  disabled={saving}
                  className="text-red-500 hover:text-red-700 disabled:opacity-50 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                  title="Remove entry"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Amount</label>
                <input
                  type="number"
                  value={entry.value}
                  onChange={(e) => updateEntry(index, 'value', e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2.5 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
                  disabled={saving}
                />
              </div>
              <div className="w-36">
                <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Type</label>
                <select
                  value={entry.type}
                  onChange={(e) => updateEntry(index, 'type', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
                  disabled={saving}
                >
                  <option value="points">Points</option>
                  <option value="currency">₹ Currency</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Description</label>
              <textarea
                value={entry.description}
                onChange={(e) => updateEntry(index, 'description', e.target.value)}
                placeholder="Add a description for this entry..."
                className="w-full px-3 py-2.5 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none bg-white"
                rows={3}
                disabled={saving}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 space-y-3">
        <button
          onClick={addEntry}
          disabled={saving}
          className="w-full px-4 py-2.5 bg-white border-2 border-neutral-300 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-100 hover:border-emerald-400 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Another Entry
        </button>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={saving}
            className="flex-1 px-4 py-2.5 bg-white border border-neutral-300 text-neutral-700 font-medium rounded-lg hover:bg-neutral-100 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(localEntries)}
            disabled={saving}
            className="flex-1 px-4 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-md"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}


