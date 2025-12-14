"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet, RefreshCw, Download, Calendar } from "lucide-react";
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

export default function EmployeeBonusPointsSheet() {
  const [rows, setRows] = useState<BonusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDateFilter, setStartDateFilter] = useState<string>("");
  const [endDateFilter, setEndDateFilter] = useState<string>("");

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDateFilter) params.append("startDate", startDateFilter);
      if (endDateFilter) params.append("endDate", endDateFilter);

      const response = await fetch(`/api/employee/bonus-summary?${params.toString()}`, {
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
  }, [startDateFilter, endDateFilter]);

  const filteredRows = rows;

  const exportToCSV = () => {
    if (filteredRows.length === 0) return;

    const headers = [
      "Date",
      "Project Reward Total (Pts)",
      "Project Reward Total (Currency)",
      "Project Earned (Pts)",
      "Project Earned (Currency)",
      "Project Fine (Pts)",
      "Project Fine (Currency)",
      "Checklist Reward Total (Pts)",
      "Checklist Reward Total (Currency)",
      "Checklist Earned (Pts)",
      "Checklist Earned (Currency)",
      "Checklist Fine (Pts)",
      "Checklist Fine (Currency)",
      "Tasks Reward Total (Pts)",
      "Tasks Reward Total (Currency)",
      "Tasks Earned (Pts)",
      "Tasks Earned (Currency)",
      "Tasks Fine (Pts)",
      "Tasks Fine (Currency)",
      "Hackathon Earned (Pts)",
      "Hackathon Earned (Currency)",
      "Custom Bonus Points",
      "Custom Bonus Currency",
      "Custom Fine Points",
      "Custom Fine Currency",
      "Net Points",
      "Net Currency",
    ];

    const csvRows = [
      headers.join(","),
      ...filteredRows.map((row) => {
        const customBonusPts = (row.customBonusEntries || []).filter(e => e.type === 'points').reduce((sum, e) => sum + e.value, 0);
        const customBonusCurr = (row.customBonusEntries || []).filter(e => e.type === 'currency').reduce((sum, e) => sum + e.value, 0);
        const customFinePts = (row.customFineEntries || []).filter(e => e.type === 'points').reduce((sum, e) => sum + e.value, 0);
        const customFineCurr = (row.customFineEntries || []).filter(e => e.type === 'currency').reduce((sum, e) => sum + e.value, 0);
        return [
          `"${row.date}"`,
          row.projectRewardTotal,
          row.projectRewardTotalCurrency || 0,
          row.projectEarned,
          row.projectEarnedCurrency || 0,
          row.projectFine,
          row.projectFineCurrency || 0,
          row.checklistRewardTotal,
          row.checklistRewardTotalCurrency || 0,
          row.checklistEarned,
          row.checklistEarnedCurrency || 0,
          row.checklistFine,
          row.checklistFineCurrency || 0,
          row.taskRewardTotal,
          row.taskRewardTotalCurrency || 0,
          row.taskEarned,
          row.taskEarnedCurrency || 0,
          row.taskFine,
          row.taskFineCurrency || 0,
          row.hackathonEarned,
          row.hackathonEarnedCurrency || 0,
          customBonusPts,
          customBonusCurr,
          customFinePts,
          customFineCurr,
          row.totalPoints + customBonusPts - customFinePts,
          row.totalCurrency + customBonusCurr - customFineCurr,
        ].join(",");
      }),
    ];

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `my-bonus-points-${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate totals
  const totals = filteredRows.reduce(
    (acc, row) => {
      const customBonusPts = (row.customBonusEntries || []).filter(e => e.type === 'points').reduce((sum, e) => sum + e.value, 0);
      const customBonusCurr = (row.customBonusEntries || []).filter(e => e.type === 'currency').reduce((sum, e) => sum + e.value, 0);
      const customFinePts = (row.customFineEntries || []).filter(e => e.type === 'points').reduce((sum, e) => sum + e.value, 0);
      const customFineCurr = (row.customFineEntries || []).filter(e => e.type === 'currency').reduce((sum, e) => sum + e.value, 0);
      return {
        projectRewardTotal: acc.projectRewardTotal + row.projectRewardTotal,
        projectEarned: acc.projectEarned + row.projectEarned,
        projectFine: acc.projectFine + row.projectFine,
        checklistRewardTotal: acc.checklistRewardTotal + row.checklistRewardTotal,
        checklistEarned: acc.checklistEarned + row.checklistEarned,
        checklistFine: acc.checklistFine + row.checklistFine,
        taskRewardTotal: acc.taskRewardTotal + row.taskRewardTotal,
        taskEarned: acc.taskEarned + row.taskEarned,
        taskFine: acc.taskFine + row.taskFine,
        hackathonEarned: acc.hackathonEarned + (row.hackathonEarned || 0),
        customBonusPoints: acc.customBonusPoints + customBonusPts,
        customBonusCurrency: acc.customBonusCurrency + customBonusCurr,
        customFinePoints: acc.customFinePoints + customFinePts,
        customFineCurrency: acc.customFineCurrency + customFineCurr,
        totalPoints: acc.totalPoints + row.totalPoints,
      };
    },
    {
      projectRewardTotal: 0,
      projectEarned: 0,
      projectFine: 0,
      checklistRewardTotal: 0,
      checklistEarned: 0,
      checklistFine: 0,
      taskRewardTotal: 0,
      taskEarned: 0,
      taskFine: 0,
      hackathonEarned: 0,
      customBonusPoints: 0,
      customBonusCurrency: 0,
      customFinePoints: 0,
      customFineCurrency: 0,
      totalPoints: 0,
    }
  );

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
            My Bonus Points Summary
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchRows}
            className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={exportToCSV}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-neutral-500" />
            <label className="text-sm font-medium text-neutral-700">From Date:</label>
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="bg-white border border-neutral-300 rounded-lg px-3 py-1.5 text-sm text-neutral-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-neutral-700">To Date:</label>
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="bg-white border border-neutral-300 rounded-lg px-3 py-1.5 text-sm text-neutral-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
            />
          </div>
          {(startDateFilter || endDateFilter) && (
            <button
              onClick={() => {
                setStartDateFilter("");
                setEndDateFilter("");
              }}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      {filteredRows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="text-sm text-green-700 font-medium">Net Points Earned</div>
            <div className="text-2xl font-bold text-green-800 mt-1">
              {(() => {
                const netTotal = totals.totalPoints + totals.customBonusPoints - totals.customFinePoints;
                return netTotal > 0 ? `+${netTotal}` : netTotal;
              })()}
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="text-sm text-blue-700 font-medium">Project Points</div>
            <div className="text-xl font-bold text-blue-800 mt-1">
              {totals.projectEarned - totals.projectFine}
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="text-sm text-purple-700 font-medium">Checklist Points</div>
            <div className="text-xl font-bold text-purple-800 mt-1">
              {totals.checklistEarned - totals.checklistFine}
            </div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <div className="text-sm text-orange-700 font-medium">Task Points</div>
            <div className="text-xl font-bold text-orange-800 mt-1">
              {totals.taskEarned - totals.taskFine}
            </div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <div className="text-sm text-yellow-700 font-medium">Hackathon Points</div>
            <div className="text-xl font-bold text-yellow-800 mt-1">
              {totals.hackathonEarned}
            </div>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              {/* Main header row with category names */}
              <tr className="bg-gradient-to-b from-neutral-100 to-neutral-50 border-b-2 border-neutral-300">
                <th className="px-4 py-3 text-left text-xs font-bold text-neutral-800 uppercase tracking-wide border-r border-neutral-300 sticky left-0 bg-gradient-to-b from-neutral-100 to-neutral-50 z-10 min-w-[110px]" rowSpan={2}>
                  Date
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
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-600 min-w-[100px]">
                  <div className="text-neutral-800 font-medium">Pts | ₹</div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-8 text-center text-neutral-500">
                    No bonus points data found for the selected period
                  </td>
                </tr>
              ) : (
                <>
                  {filteredRows.map((row) => (
                    <tr key={row.date} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-3.5 text-sm text-neutral-900 border-r border-neutral-200 sticky left-0 bg-white hover:bg-blue-50/30 z-0 font-medium">
                        {new Date(row.date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      {/* Projects */}
                      <td className="px-4 py-4 text-sm text-center border-r border-neutral-200">
                        <div className="text-neutral-700">{row.projectRewardTotal} | ₹{row.projectRewardTotalCurrency || 0}</div>
                      </td>
                      <td className="px-4 py-4 text-sm text-center border-r border-neutral-200">
                        <div className="text-green-600 font-medium">{row.projectEarned} | ₹{row.projectEarnedCurrency || 0}</div>
                      </td>
                      <td className="px-4 py-4 text-sm text-center border-r border-neutral-300">
                        <div className="text-red-600 font-medium">{row.projectFine} | ₹{row.projectFineCurrency || 0}</div>
                      </td>
                      {/* Checklists */}
                      <td className="px-4 py-4 text-sm text-center border-r border-neutral-200">
                        <div className="text-neutral-700">{row.checklistRewardTotal} | ₹{row.checklistRewardTotalCurrency || 0}</div>
                      </td>
                      <td className="px-4 py-4 text-sm text-center border-r border-neutral-200">
                        <div className="text-green-600 font-medium">{row.checklistEarned} | ₹{row.checklistEarnedCurrency || 0}</div>
                      </td>
                      <td className="px-4 py-4 text-sm text-center border-r border-neutral-300">
                        <div className="text-red-600 font-medium">{row.checklistFine} | ₹{row.checklistFineCurrency || 0}</div>
                      </td>
                      {/* Tasks */}
                      <td className="px-4 py-4 text-sm text-center border-r border-neutral-200">
                        <div className="text-neutral-700">{row.taskRewardTotal} | ₹{row.taskRewardTotalCurrency || 0}</div>
                      </td>
                      <td className="px-4 py-4 text-sm text-center border-r border-neutral-200">
                        <div className="text-green-600 font-medium">{row.taskEarned} | ₹{row.taskEarnedCurrency || 0}</div>
                      </td>
                      <td className="px-4 py-4 text-sm text-center border-r border-neutral-300">
                        <div className="text-red-600 font-medium">{row.taskFine} | ₹{row.taskFineCurrency || 0}</div>
                      </td>
                      {/* Hackathons */}
                      <td className="px-4 py-4 text-sm text-center border-r border-neutral-300">
                        <div className="text-yellow-700 font-medium">{row.hackathonEarned || 0} | ₹{row.hackathonEarnedCurrency || 0}</div>
                      </td>
                      {/* Custom Bonus */}
                      <td className="px-4 py-4 text-sm text-center border-r border-neutral-300">
                        {row.customBonusEntries && row.customBonusEntries.length > 0 ? (
                          <div className="space-y-1">
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
                          <div className="text-neutral-400">0 | ₹0</div>
                        )}
                      </td>
                      {/* Custom Fine */}
                      <td className="px-4 py-4 text-sm text-center border-r border-neutral-300">
                        {row.customFineEntries && row.customFineEntries.length > 0 ? (
                          <div className="space-y-1">
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
                          <div className="text-neutral-400">0 | ₹0</div>
                        )}
                      </td>
                      {/* Net Total */}
                      <td className="px-4 py-4 text-sm text-center font-bold">
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
                  ))}

                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="text-sm text-neutral-600">
        Total Records: <span className="font-semibold">{filteredRows.length}</span> day(s)
      </div>
    </div>
  );
}

