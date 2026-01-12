"use client";

import { useState, useEffect } from "react";
import { Award, AlertCircle, Calculator, TrendingUp, RefreshCw, CheckCircle } from "lucide-react";
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
  missingDailyTasksFine: number;
  absenceFines: number;
  totalFine: number;
  netAmount: number;
  noPaymentConditions: string[];
  noFineConditions: string[];
  manualBonus?: number;
  manualFine?: number;
  adminNotes?: string;
  approvedByCoreTeam?: boolean;
  missingDailyTasksFineDetails?: string;
}

export default function EmployeeBonusFine() {
  const [calculation, setCalculation] = useState<BonusFineCalculation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCalculation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCalculation = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/employee/bonus-fine?period=monthly`);
      const data = await response.json();
      if (response.ok && data.calculation) {
        setCalculation(data.calculation);
      } else {
        setCalculation(null);
      }
    } catch (error) {
      console.error("Error fetching calculation:", error);
      setCalculation(null);
    } finally {
      setLoading(false);
    }
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

  if (!calculation) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Unable to calculate bonus/fine at this time.</p>
        <button
          onClick={fetchCalculation}
          className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          Retry
        </button>
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
        <motion.button
          whileHover={{scale: 1.05}}
          whileTap={{scale: 0.95}}
          onClick={fetchCalculation}
          className="inline-flex items-center gap-2 px-4 py-2 gradient-emerald text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </motion.button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Base Salary</p>
              <p className="text-2xl font-bold text-blue-700">
                ₹{calculation.baseBonus.toLocaleString()}
              </p>
            </div>
            <Award className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Bonuses</p>
              <p className="text-2xl font-bold text-green-700">
                ₹{(calculation.totalBonus - calculation.baseBonus).toLocaleString()}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Fines</p>
              <p className="text-2xl font-bold text-red-700">
                ₹{calculation.totalFine.toLocaleString()}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Net Amount</p>
              <p className={`text-2xl font-bold ${
                calculation.netAmount >= 0 ? 'text-purple-700' : 'text-red-700'
              }`}>
                ₹{calculation.netAmount.toLocaleString()}
              </p>
            </div>
            <Calculator className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bonuses */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-green-600" />
            Bonuses Breakdown
          </h3>
          <div className="space-y-3">
            {calculation.productsBonus > 0 && (
              <div className="flex justify-between items-center p-2 bg-green-50 rounded-lg">
                <span className="text-sm text-gray-700">Products (&gt;3):</span>
                <span className="font-semibold text-green-700">₹{calculation.productsBonus.toLocaleString()}</span>
              </div>
            )}
            {calculation.attendanceBonus140 > 0 && (
              <div className="flex justify-between items-center p-2 bg-green-50 rounded-lg">
                <span className="text-sm text-gray-700">Attendance 140+:</span>
                <span className="font-semibold text-green-700">₹{calculation.attendanceBonus140.toLocaleString()}</span>
              </div>
            )}
            {calculation.attendanceBonus160 > 0 && (
              <div className="flex justify-between items-center p-2 bg-green-50 rounded-lg">
                <span className="text-sm text-gray-700">Attendance 160+:</span>
                <span className="font-semibold text-green-700">₹{calculation.attendanceBonus160.toLocaleString()}</span>
              </div>
            )}
            {calculation.attendanceBonus200 > 0 && (
              <div className="flex justify-between items-center p-2 bg-green-50 rounded-lg">
                <span className="text-sm text-gray-700">Attendance 200+:</span>
                <span className="font-semibold text-green-700">₹{calculation.attendanceBonus200.toLocaleString()}</span>
              </div>
            )}
            {calculation.dailyLoomGFormBonus > 0 && (
              <div className="flex justify-between items-center p-2 bg-green-50 rounded-lg">
                <span className="text-sm text-gray-700">Daily Loom/GForm:</span>
                <span className="font-semibold text-green-700">₹{calculation.dailyLoomGFormBonus.toLocaleString()}</span>
              </div>
            )}
            {calculation.loyaltyBonus > 0 && (
              <div className="flex justify-between items-center p-2 bg-green-50 rounded-lg">
                <span className="text-sm text-gray-700">Loyalty (6+ months):</span>
                <span className="font-semibold text-green-700">₹{calculation.loyaltyBonus.toLocaleString()}</span>
              </div>
            )}
            {calculation.completedProjectsBonus > 0 && (
              <div className="flex justify-between items-center p-2 bg-green-50 rounded-lg">
                <span className="text-sm text-gray-700">Completed Projects:</span>
                <span className="font-semibold text-green-700">₹{calculation.completedProjectsBonus.toLocaleString()}</span>
              </div>
            )}
            {calculation.isProjectLead && (
              <div className="mt-3 p-2 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-xs text-purple-700 font-medium">
                  ⚡ Project Lead: 2x multiplier applied to bonuses
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Fines */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            Fines Breakdown
          </h3>
          {calculation.noFineConditions.length > 0 ? (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm font-medium text-green-700">No Fines Applied</p>
              <p className="text-xs text-green-600 mt-1">
                {calculation.noFineConditions.join(', ')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {calculation.missingDailyUpdatesFine > 0 && (
                <div className="flex justify-between items-center p-2 bg-red-50 rounded-lg">
                  <span className="text-sm text-gray-700">Missing Daily Updates:</span>
                  <span className="font-semibold text-red-700">₹{calculation.missingDailyUpdatesFine.toLocaleString()}</span>
                </div>
              )}
              {calculation.missingTeamMeetingsFine > 0 && (
                <div className="flex justify-between items-center p-2 bg-red-50 rounded-lg">
                  <span className="text-sm text-gray-700">Missing Team Meetings:</span>
                  <span className="font-semibold text-red-700">₹{calculation.missingTeamMeetingsFine.toLocaleString()}</span>
                </div>
              )}
              {calculation.missingInternalMeetingsFine > 0 && (
                <div className="flex justify-between items-center p-2 bg-red-50 rounded-lg">
                  <span className="text-sm text-gray-700">Missing Internal Meetings:</span>
                  <span className="font-semibold text-red-700">₹{calculation.missingInternalMeetingsFine.toLocaleString()}</span>
                </div>
              )}
              {calculation.missingClientMeetingsFine > 0 && (
                <div className="flex justify-between items-center p-2 bg-red-50 rounded-lg">
                  <span className="text-sm text-gray-700">Missing Client Meetings:</span>
                  <span className="font-semibold text-red-700">₹{calculation.missingClientMeetingsFine.toLocaleString()}</span>
                </div>
              )}
              {calculation.missingDailyTasksFine > 0 && (
                <div className="p-2 bg-red-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">Missing Daily Tasks:</span>
                    <span className="font-semibold text-red-700">₹{calculation.missingDailyTasksFine.toLocaleString()}</span>
                  </div>
                  {(calculation as any).missingDailyTasksFineDetails && (
                    <div className="text-xs text-gray-600 mt-1">
                      {(calculation as any).missingDailyTasksFineDetails}
                    </div>
                  )}
                </div>
              )}
              {calculation.absenceFines !== 0 && (
                <div className="flex justify-between items-center p-2 bg-red-50 rounded-lg">
                  <span className="text-sm text-gray-700">Absence Fines:</span>
                  <span className={`font-semibold ${
                    calculation.absenceFines < 0 ? 'text-green-700' : 'text-red-700'
                  }`}>
                    ₹{calculation.absenceFines.toLocaleString()}
                  </span>
                </div>
              )}
              {(calculation as any).customFinesCurrency > 0 && (
                <div className="p-2 bg-red-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">Custom Fines:</span>
                    <span className="font-semibold text-red-700">
                      ₹{(calculation as any).customFinesCurrency.toLocaleString()}
                    </span>
                  </div>
                  {(calculation as any).customFinesPoints > 0 && (
                    <div className="text-xs text-gray-600 mt-1">
                      Points: {(calculation as any).customFinesPoints}
                    </div>
                  )}
                </div>
              )}
              {calculation.isProjectLead && (
                <div className="mt-3 p-2 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-xs text-purple-700 font-medium">
                    ⚡ Project Lead: 2x multiplier applied to fines
                  </p>
                </div>
              )}
              {calculation.totalFine === 0 && (
                <p className="text-sm text-gray-500 text-center py-2">No fines applied</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600">Products</p>
            <p className="text-xl font-bold text-gray-900">{calculation.productsCount}</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600">Attendance</p>
            <p className="text-xl font-bold text-gray-900">{calculation.attendanceHours}h</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600">Absent Days</p>
            <p className="text-xl font-bold text-gray-900">{calculation.absentDays}</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600">Daily Updates</p>
            <p className="text-xl font-bold text-gray-900">{calculation.dailyUpdatesCount}</p>
          </div>
        </div>
      </div>

      {/* Admin Notes */}
      {calculation.adminNotes && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <h4 className="text-sm font-semibold text-amber-900 mb-2">Admin Notes</h4>
          <p className="text-sm text-amber-800">{calculation.adminNotes}</p>
        </div>
      )}

      {/* Core Team Approval */}
      {calculation.approvedByCoreTeam && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-sm font-semibold text-green-700">Approved by Core Team</p>
          </div>
        </div>
      )}

      {/* No Payment Conditions */}
      {calculation.noPaymentConditions.length > 0 && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <h4 className="text-sm font-semibold text-red-900 mb-2">No Payment Conditions</h4>
          <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
            {calculation.noPaymentConditions.map((condition, index) => (
              <li key={index}>{condition}</li>
            ))}
          </ul>
          {!calculation.approvedByCoreTeam && (
            <p className="text-xs text-red-600 mt-2">
              Payment requires core team approval
            </p>
          )}
        </div>
      )}
    </div>
  );
}

