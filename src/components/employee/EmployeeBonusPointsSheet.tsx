"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet, RefreshCw, Download, Calendar } from "lucide-react";
import LoadingSpinner from "@/components/shared/LoadingSpinner";

interface BonusRow {
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  projectRewardTotal: number;
  projectEarned: number;
  projectFine: number;
  checklistRewardTotal: number;
  checklistEarned: number;
  checklistFine: number;
  taskRewardTotal: number;
  taskEarned: number;
  taskFine: number;
  hackathonEarned: number;
  totalPoints: number;
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
      "Project Reward Total",
      "Project Earned",
      "Project Fine",
      "Checklist Reward Total",
      "Checklist Earned",
      "Checklist Fine",
      "Tasks Reward Total",
      "Tasks Earned",
      "Tasks Fine",
      "Hackathon Earned",
      "Total Points",
    ];

    const csvRows = [
      headers.join(","),
      ...filteredRows.map((row) =>
        [
          `"${row.date}"`,
          row.projectRewardTotal,
          row.projectEarned,
          row.projectFine,
          row.checklistRewardTotal,
          row.checklistEarned,
          row.checklistFine,
          row.taskRewardTotal,
          row.taskEarned,
          row.taskFine,
          row.hackathonEarned,
          row.totalPoints,
        ].join(",")
      ),
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
    (acc, row) => ({
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
      totalPoints: acc.totalPoints + row.totalPoints,
    }),
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
            <div className="text-sm text-green-700 font-medium">Total Points Earned</div>
            <div className="text-2xl font-bold text-green-800 mt-1">
              {totals.totalPoints > 0 ? `+${totals.totalPoints}` : totals.totalPoints}
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
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 sticky left-0 bg-neutral-50 z-10 min-w-[110px]">
                  Date
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[120px]">
                  Project Reward Total
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[120px]">
                  Project Earned
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[100px]">
                  Project Fine
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[140px]">
                  Checklist Reward Total
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[120px]">
                  Checklist Earned
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[120px]">
                  Checklist Fine
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[120px]">
                  Tasks Reward Total
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[120px]">
                  Tasks Earned
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[100px]">
                  Tasks Fine
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-yellow-700 uppercase tracking-wider border-r border-neutral-200 min-w-[120px]">
                  Hackathon Earned
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-700 uppercase tracking-wider min-w-[100px]">
                  Total Points
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-neutral-500">
                    No bonus points data found for the selected period
                  </td>
                </tr>
              ) : (
                <>
                  {filteredRows.map((row) => (
                    <tr key={row.date} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-neutral-900 border-r border-neutral-200 sticky left-0 bg-white z-0 font-medium">
                        {new Date(row.date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-700 border-r border-neutral-200 text-center">
                        {row.projectRewardTotal}
                      </td>
                      <td className="px-4 py-3 text-sm text-green-600 font-medium border-r border-neutral-200 text-center">
                        {row.projectEarned > 0 ? `+${row.projectEarned}` : row.projectEarned}
                      </td>
                      <td className="px-4 py-3 text-sm text-red-600 font-medium border-r border-neutral-200 text-center">
                        {row.projectFine > 0 ? `-${row.projectFine}` : row.projectFine}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-700 border-r border-neutral-200 text-center">
                        {row.checklistRewardTotal}
                      </td>
                      <td className="px-4 py-3 text-sm text-green-600 font-medium border-r border-neutral-200 text-center">
                        {row.checklistEarned > 0 ? `+${row.checklistEarned}` : row.checklistEarned}
                      </td>
                      <td className="px-4 py-3 text-sm text-red-600 font-medium border-r border-neutral-200 text-center">
                        {row.checklistFine > 0 ? `-${row.checklistFine}` : row.checklistFine}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-700 border-r border-neutral-200 text-center">
                        {row.taskRewardTotal}
                      </td>
                      <td className="px-4 py-3 text-sm text-green-600 font-medium border-r border-neutral-200 text-center">
                        {row.taskEarned > 0 ? `+${row.taskEarned}` : row.taskEarned}
                      </td>
                      <td className="px-4 py-3 text-sm text-red-600 font-medium border-r border-neutral-200 text-center">
                        {row.taskFine > 0 ? `-${row.taskFine}` : row.taskFine}
                      </td>
                      <td className="px-4 py-3 text-sm text-yellow-700 font-medium border-r border-neutral-200 text-center">
                        {row.hackathonEarned > 0 ? `+${row.hackathonEarned}` : row.hackathonEarned || 0}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-center">
                        <span
                          className={
                            row.totalPoints >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }
                        >
                          {row.totalPoints > 0 ? `+${row.totalPoints}` : row.totalPoints}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className="bg-emerald-50 border-t-2 border-emerald-300 font-semibold">
                    <td className="px-4 py-3 text-sm text-neutral-900 border-r border-neutral-200 sticky left-0 bg-emerald-50 z-0">
                      Total
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700 border-r border-neutral-200 text-center">
                      {totals.projectRewardTotal}
                    </td>
                    <td className="px-4 py-3 text-sm text-green-600 border-r border-neutral-200 text-center">
                      +{totals.projectEarned}
                    </td>
                    <td className="px-4 py-3 text-sm text-red-600 border-r border-neutral-200 text-center">
                      -{totals.projectFine}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700 border-r border-neutral-200 text-center">
                      {totals.checklistRewardTotal}
                    </td>
                    <td className="px-4 py-3 text-sm text-green-600 border-r border-neutral-200 text-center">
                      +{totals.checklistEarned}
                    </td>
                    <td className="px-4 py-3 text-sm text-red-600 border-r border-neutral-200 text-center">
                      -{totals.checklistFine}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700 border-r border-neutral-200 text-center">
                      {totals.taskRewardTotal}
                    </td>
                    <td className="px-4 py-3 text-sm text-green-600 border-r border-neutral-200 text-center">
                      +{totals.taskEarned}
                    </td>
                    <td className="px-4 py-3 text-sm text-red-600 border-r border-neutral-200 text-center">
                      -{totals.taskFine}
                    </td>
                    <td className="px-4 py-3 text-sm text-yellow-700 border-r border-neutral-200 text-center">
                      +{totals.hackathonEarned}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      <span
                        className={
                          totals.totalPoints >= 0 ? "text-green-600" : "text-red-600"
                        }
                      >
                        {totals.totalPoints > 0 ? `+${totals.totalPoints}` : totals.totalPoints}
                      </span>
                    </td>
                  </tr>
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

