"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet, RefreshCw } from "lucide-react";
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

export default function BonusPointsSheet() {
  const [rows, setRows] = useState<BonusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [startDateFilter, setStartDateFilter] = useState<string>("");
  const [endDateFilter, setEndDateFilter] = useState<string>("");

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
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[110px]">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[160px]">
                  Employee
                </th>
                {/* Project columns */}
                <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-700 uppercase tracking-wider border-r border-neutral-200 min-w-[120px]">
                  Project Reward Total
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-700 uppercase tracking-wider border-r border-neutral-200 min-w-[120px]">
                  Project Earned
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-red-700 uppercase tracking-wider border-r border-neutral-200 min-w-[100px]">
                  Project Fine
                </th>
                {/* Checklist columns */}
                <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-700 uppercase tracking-wider border-r border-neutral-200 min-w-[140px]">
                  Checklist Reward Total
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-700 uppercase tracking-wider border-r border-neutral-200 min-w-[120px]">
                  Checklist Earned
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-red-700 uppercase tracking-wider border-r border-neutral-200 min-w-[120px]">
                  Checklist Fine
                </th>
                {/* Task columns */}
                <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-700 uppercase tracking-wider border-r border-neutral-200 min-w-[120px]">
                  Tasks Reward Total
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-700 uppercase tracking-wider border-r border-neutral-200 min-w-[110px]">
                  Tasks Earned
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-red-700 uppercase tracking-wider border-r border-neutral-200 min-w-[100px]">
                  Tasks Fine
                </th>
                {/* Hackathon column */}
                <th className="px-4 py-3 text-left text-xs font-semibold text-yellow-700 uppercase tracking-wider border-r border-neutral-200 min-w-[120px]">
                  Hackathon Earned
                </th>
                {/* New columns before Net Points */}
                <th className="px-4 py-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-r border-neutral-200 min-w-[180px]">
                  Total Points Accumulated He Could Have Got
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-700 uppercase tracking-wider border-r border-neutral-200 min-w-[150px]">
                  Total Points He Got
                </th>
                {/* Overall */}
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-800 uppercase tracking-wider min-w-[110px]">
                  Net Points
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
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
                    className="hover:bg-neutral-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-neutral-800 border-r border-neutral-200">
                      {row.date}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-900 border-r border-neutral-200">
                      {row.employeeName}
                    </td>
                    {/* Project */}
                    <td className="px-4 py-3 text-sm text-emerald-700 border-r border-neutral-200">
                      {row.projectRewardTotal || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-emerald-700 border-r border-neutral-200">
                      {row.projectEarned || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-red-600 border-r border-neutral-200">
                      {row.projectFine || 0}
                    </td>
                    {/* Checklist */}
                    <td className="px-4 py-3 text-sm text-emerald-700 border-r border-neutral-200">
                      {row.checklistRewardTotal || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-emerald-700 border-r border-neutral-200">
                      {row.checklistEarned || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-red-600 border-r border-neutral-200">
                      {row.checklistFine || 0}
                    </td>
                    {/* Tasks */}
                    <td className="px-4 py-3 text-sm text-emerald-700 border-r border-neutral-200">
                      {row.taskRewardTotal || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-emerald-700 border-r border-neutral-200">
                      {row.taskEarned || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-red-600 border-r border-neutral-200">
                      {row.taskFine || 0}
                    </td>
                    {/* Hackathon */}
                    <td className="px-4 py-3 text-sm text-yellow-700 border-r border-neutral-200">
                      {row.hackathonEarned || 0}
                    </td>
                    {/* Total Points Accumulated He Could Have Got */}
                    <td className="px-4 py-3 text-sm text-blue-700 border-r border-neutral-200 font-medium">
                      {(row.projectRewardTotal || 0) + 
                       (row.checklistRewardTotal || 0) + 
                       (row.taskRewardTotal || 0) + 
                       (row.hackathonEarned || 0)}
                    </td>
                    {/* Total Points He Got */}
                    <td className="px-4 py-3 text-sm text-emerald-700 border-r border-neutral-200 font-medium">
                      {(row.projectEarned || 0) + 
                       (row.checklistEarned || 0) + 
                       (row.taskEarned || 0) + 
                       (row.hackathonEarned || 0)}
                    </td>
                    {/* Net Points */}
                    <td className="px-4 py-3 text-sm font-semibold border-neutral-200">
                      <span
                        className={
                          row.totalPoints > 0
                            ? "text-emerald-700"
                            : row.totalPoints < 0
                            ? "text-red-600"
                            : "text-neutral-700"
                        }
                      >
                        {row.totalPoints}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="text-sm text-neutral-600">
        Rows: <span className="font-semibold">{filteredRows.length}</span>
      </div>
    </div>
  );
}


