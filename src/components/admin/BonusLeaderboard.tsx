"use client";

import { useState, useEffect } from "react";
import { TrendingUp, Award, Edit2, Save, X, AlertCircle, CheckCircle, Calculator, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

interface BonusFineCalculation {
  employeeId: string;
  employeeName: string;
  email: string;
  productsCount: number;
  attendanceHours: number;
  absentDays: number;
  dailyUpdatesCount: number;
  missingDailyUpdates: number;
  missingTeamMeetings: number;
  missingInternalMeetings: number;
  missingClientMeetings: number;
  completedProjects: number;
  approvedClientProjects: number;
  isProjectLead: boolean;
  isInTraining: boolean;
  monthsWorked: number;
  hasDailyLoomAndGForm: boolean;
  baseBonus: number;
  productsBonus: number;
  attendanceBonus140: number;
  attendanceBonus160: number;
  attendanceBonus200: number;
  dailyLoomGFormBonus: number;
  loyaltyBonus: number;
  completedProjectsBonus: number;
  hackathonBonus: number;
  fresherBonus: number;
  totalBonus: number;
  missingDailyUpdatesFine: number;
  missingTeamMeetingsFine: number;
  missingInternalMeetingsFine: number;
  missingClientMeetingsFine: number;
  absenceFines: number;
  totalFine: number;
  netAmount: number;
  noPaymentConditions: string[];
  noFineConditions: string[];
  manualBonus?: number;
  manualFine?: number;
  adminNotes?: string;
  approvedByCoreTeam?: boolean;
}

interface BonusLeaderboardProps {
  readOnly?: boolean;
}

export default function BonusLeaderboard({ readOnly = false }: BonusLeaderboardProps) {
  const [calculations, setCalculations] = useState<BonusFineCalculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{
    manualBonus?: number;
    manualFine?: number;
    adminNotes?: string;
    approvedByCoreTeam?: boolean;
  }>({});

  useEffect(() => {
    fetchCalculations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCalculations = async () => {
    try {
      setLoading(true);
      // Always use monthly period for bonus/fine calculations
      const response = await fetch(`/api/admin/bonus-fine/all`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({period: 'monthly'})
      });
      const data = await response.json();
      if (response.ok && data.calculations) {
        // Sort by net amount descending
        const sorted = data.calculations.sort((a: BonusFineCalculation, b: BonusFineCalculation) => 
          b.netAmount - a.netAmount
        );
        setCalculations(sorted);
      } else {
        setCalculations([]);
      }
    } catch (error) {
      console.error("Error fetching calculations:", error);
      setCalculations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (calc: BonusFineCalculation) => {
    setEditingId(calc.employeeId);
    setEditData({
      manualBonus: calc.manualBonus,
      manualFine: calc.manualFine,
      adminNotes: calc.adminNotes || '',
      approvedByCoreTeam: calc.approvedByCoreTeam || false
    });
  };

  const handleSave = async (employeeId: string) => {
    try {
      const response = await fetch('/api/admin/bonus-fine', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          employeeId,
          period: 'monthly', // Always use monthly
          ...editData
        })
      });

      if (response.ok) {
        await fetchCalculations();
        setEditingId(null);
        setEditData({});
      } else {
        alert('Failed to save changes');
      }
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save changes');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  const getStatusColor = (netAmount: number, noPaymentConditions: string[]) => {
    if (noPaymentConditions.length > 0) return 'bg-red-50 border-red-200';
    if (netAmount < 0) return 'bg-orange-50 border-orange-200';
    if (netAmount === 0) return 'bg-gray-50 border-gray-200';
    return 'bg-green-50 border-green-200';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Calculating bonuses and fines...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 rounded-lg px-4 py-2 border border-emerald-200">
            <p className="text-sm font-semibold text-emerald-700">
              Monthly Calculation
            </p>
            <p className="text-xs text-emerald-600">
              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
        {!readOnly && (
          <motion.button
            whileHover={{scale: 1.05}}
            whileTap={{scale: 0.95}}
            onClick={fetchCalculations}
            className="inline-flex items-center gap-2 px-4 py-2 gradient-emerald text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg"
          >
            <RefreshCw className="w-4 h-4" />
            Recalculate All
          </motion.button>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Bonuses</p>
              <p className="text-2xl font-bold text-green-700">
                ₹{calculations.reduce((sum, c) => sum + c.totalBonus, 0).toLocaleString()}
              </p>
            </div>
            <Award className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Fines</p>
              <p className="text-2xl font-bold text-red-700">
                ₹{calculations.reduce((sum, c) => sum + c.totalFine, 0).toLocaleString()}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Net Amount</p>
              <p className="text-2xl font-bold text-blue-700">
                ₹{calculations.reduce((sum, c) => sum + c.netAmount, 0).toLocaleString()}
              </p>
            </div>
            <Calculator className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Employees</p>
              <p className="text-2xl font-bold text-purple-700">{calculations.length}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Calculations Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1600px]">
            <thead className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Metrics</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Base</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Bonuses</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Fines</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Net</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Status</th>
                {!readOnly && (
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {calculations.length === 0 ? (
                <tr>
                  <td colSpan={readOnly ? 7 : 8} className="px-6 py-12 text-center text-gray-500">
                    No calculations found. Click "Recalculate All" to generate bonus/fine calculations.
                  </td>
                </tr>
              ) : (
                calculations.map((calc) => {
                  const isEditing = editingId === calc.employeeId;
                  return (
                    <motion.tr
                      key={calc.employeeId}
                      initial={{opacity: 0, y: 10}}
                      animate={{opacity: 1, y: 0}}
                      className={`${getStatusColor(calc.netAmount, calc.noPaymentConditions)} border-l-4 transition-colors hover:bg-opacity-75`}
                    >
                      {/* Employee Info */}
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-gray-900">{calc.employeeName}</p>
                          <p className="text-xs text-gray-500">{calc.email}</p>
                          {calc.isProjectLead && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                              Project Lead (2x)
                            </span>
                          )}
                          {calc.isInTraining && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                              Training
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Metrics */}
                      <td className="px-4 py-3 text-sm">
                        <div className="space-y-1">
                          <p>Products: <span className="font-semibold">{calc.productsCount}</span></p>
                          <p>Attendance: <span className="font-semibold">{calc.attendanceHours}h</span></p>
                          <p>Absent: <span className="font-semibold">{calc.absentDays}d</span></p>
                          <p>Updates: <span className="font-semibold">{calc.dailyUpdatesCount}</span></p>
                          <p>Months: <span className="font-semibold">{calc.monthsWorked}</span></p>
                        </div>
                      </td>

                      {/* Base */}
                      <td className="px-4 py-3 text-sm">
                        <div className="text-center">
                          <p className="font-bold text-blue-700 text-lg">
                            ₹{calc.baseBonus.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">Base Salary</p>
                        </div>
                      </td>

                      {/* Bonuses */}
                      <td className="px-4 py-3 text-sm">
                        <div className="space-y-1">
                          {calc.productsBonus > 0 && (
                            <p>Products: <span className="font-semibold text-green-700">₹{calc.productsBonus}</span></p>
                          )}
                          {calc.attendanceBonus140 > 0 && (
                            <p>Att 140+: <span className="font-semibold text-green-700">₹{calc.attendanceBonus140}</span></p>
                          )}
                          {calc.attendanceBonus160 > 0 && (
                            <p>Att 160+: <span className="font-semibold text-green-700">₹{calc.attendanceBonus160}</span></p>
                          )}
                          {calc.attendanceBonus200 > 0 && (
                            <p>Att 200+: <span className="font-semibold text-green-700">₹{calc.attendanceBonus200}</span></p>
                          )}
                          {calc.dailyLoomGFormBonus > 0 && (
                            <p>Loom/GForm: <span className="font-semibold text-green-700">₹{calc.dailyLoomGFormBonus}</span></p>
                          )}
                          {calc.loyaltyBonus > 0 && (
                            <p>Loyalty: <span className="font-semibold text-green-700">₹{calc.loyaltyBonus}</span></p>
                          )}
                          {calc.completedProjectsBonus > 0 && (
                            <p>Projects: <span className="font-semibold text-green-700">₹{calc.completedProjectsBonus}</span></p>
                          )}
                          {calc.isProjectLead && (
                            <p className="text-xs text-purple-600 font-medium mt-1">
                              (2x multiplier applied)
                            </p>
                          )}
                          <p className="pt-1 border-t font-bold text-green-800">
                            Total Bonuses: ₹{calc.totalBonus.toLocaleString()}
                          </p>
                        </div>
                      </td>

                      {/* Fines */}
                      <td className="px-4 py-3 text-sm">
                        {calc.noFineConditions.length > 0 ? (
                          <div className="text-green-600 font-medium">
                            No Fines
                            <p className="text-xs text-gray-500 mt-1">
                              {calc.noFineConditions.join(', ')}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {calc.missingDailyUpdatesFine > 0 && (
                              <p>Daily Updates: <span className="font-semibold text-red-700">₹{calc.missingDailyUpdatesFine}</span></p>
                            )}
                            {calc.missingTeamMeetingsFine > 0 && (
                              <p>Team Meetings: <span className="font-semibold text-red-700">₹{calc.missingTeamMeetingsFine}</span></p>
                            )}
                            {calc.missingInternalMeetingsFine > 0 && (
                              <p>Internal Meetings: <span className="font-semibold text-red-700">₹{calc.missingInternalMeetingsFine}</span></p>
                            )}
                            {calc.missingClientMeetingsFine > 0 && (
                              <p>Client Meetings: <span className="font-semibold text-red-700">₹{calc.missingClientMeetingsFine}</span></p>
                            )}
                            {calc.absenceFines !== 0 && (
                              <p>Absence: <span className={`font-semibold ${
                                calc.absenceFines < 0 ? 'text-green-700' : 'text-red-700'
                              }`}>₹{calc.absenceFines}</span></p>
                            )}
                            {calc.isProjectLead && (
                              <p className="text-xs text-purple-600 font-medium mt-1">
                                (2x multiplier applied)
                              </p>
                            )}
                            <p className="pt-1 border-t font-bold text-red-800">
                              Total Fines: ₹{calc.totalFine.toLocaleString()}
                            </p>
                          </div>
                        )}
                      </td>

                      {/* Net Amount */}
                      <td className="px-4 py-3 text-sm">
                        <div className="text-center">
                          <p className={`font-bold text-lg ${
                            calc.netAmount >= 0 ? 'text-green-700' : 'text-red-700'
                          }`}>
                            ₹{calc.netAmount.toLocaleString()}
                          </p>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-sm">
                        <div className="space-y-1">
                          {calc.noPaymentConditions.length > 0 && (
                            <div className="flex items-center gap-1 text-red-600">
                              <AlertCircle className="w-4 h-4" />
                              <span className="text-xs font-medium">No Payment</span>
                            </div>
                          )}
                          {calc.approvedByCoreTeam && (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="w-4 h-4" />
                              <span className="text-xs font-medium">Approved</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      {!readOnly && (
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                type="number"
                                placeholder="Manual Bonus"
                                value={editData.manualBonus || ''}
                                onChange={(e) => setEditData({...editData, manualBonus: parseFloat(e.target.value) || undefined})}
                                className="w-full px-2 py-1 text-xs border rounded"
                              />
                              <input
                                type="number"
                                placeholder="Manual Fine"
                                value={editData.manualFine || ''}
                                onChange={(e) => setEditData({...editData, manualFine: parseFloat(e.target.value) || undefined})}
                                className="w-full px-2 py-1 text-xs border rounded"
                              />
                              <textarea
                                placeholder="Admin Notes"
                                value={editData.adminNotes || ''}
                                onChange={(e) => setEditData({...editData, adminNotes: e.target.value})}
                                className="w-full px-2 py-1 text-xs border rounded"
                                rows={2}
                              />
                              <div className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={editData.approvedByCoreTeam || false}
                                  onChange={(e) => setEditData({...editData, approvedByCoreTeam: e.target.checked})}
                                  className="w-3 h-3"
                                />
                                <label className="text-xs">Core Team Approved</label>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleSave(calc.employeeId)}
                                  className="p-1 bg-green-500 text-white rounded text-xs"
                                >
                                  <Save className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={handleCancel}
                                  className="p-1 bg-red-500 text-white rounded text-xs"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleEdit(calc)}
                              className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      )}
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
