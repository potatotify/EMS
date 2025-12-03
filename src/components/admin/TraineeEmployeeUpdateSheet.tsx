"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  GraduationCap, 
  Search, 
  RefreshCw, 
  Calendar, 
  TrendingUp,
  CheckCircle,
  Clock,
  User,
  Mail,
  FileText,
  Download
} from "lucide-react";

interface TraineeEmployee {
  _id: string;
  fullName: string;
  email: string;
  employeeId: string;
  designation: string;
  department: string;
  joiningDate: string;
  skills: string[];
  monthsWorked: number;
  dailyUpdatesCount: number;
  attendanceHours: number;
  completedProjects: number;
  lastUpdateDate?: string;
  trainingProgress?: number;
}

export default function TraineeEmployeeUpdateSheet() {
  const [trainees, setTrainees] = useState<TraineeEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTrainee, setSelectedTrainee] = useState<string | null>(null);
  const [traineeDetails, setTraineeDetails] = useState<any>(null);

  useEffect(() => {
    fetchTrainees();
  }, []);

  const fetchTrainees = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/trainees");
      const data = await response.json();
      if (response.ok) {
        setTrainees(data.trainees || []);
      }
    } catch (error) {
      console.error("Error fetching trainees:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTraineeDetails = async (traineeId: string) => {
    try {
      const response = await fetch(`/api/admin/trainee/${traineeId}/details`);
      const data = await response.json();
      if (response.ok) {
        setTraineeDetails(data);
      }
    } catch (error) {
      console.error("Error fetching trainee details:", error);
    }
  };

  const filteredTrainees = trainees.filter((trainee) =>
    trainee.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trainee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trainee.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportToCSV = () => {
    const headers = [
      "Employee ID",
      "Name",
      "Email",
      "Department",
      "Designation",
      "Joining Date",
      "Months Worked",
      "Daily Updates",
      "Attendance Hours",
      "Completed Projects",
      "Training Progress %"
    ];

    const rows = filteredTrainees.map(t => [
      t.employeeId,
      t.fullName,
      t.email,
      t.department,
      t.designation,
      new Date(t.joiningDate).toLocaleDateString(),
      t.monthsWorked,
      t.dailyUpdatesCount,
      t.attendanceHours,
      t.completedProjects,
      t.trainingProgress || 0
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trainee-employees-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search trainees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={fetchTrainees}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={exportToCSV}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </motion.button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Total Trainees</p>
              <p className="text-2xl font-bold text-neutral-900">{trainees.length}</p>
            </div>
            <GraduationCap className="w-8 h-8 text-emerald-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Avg. Updates</p>
              <p className="text-2xl font-bold text-neutral-900">
                {trainees.length > 0 
                  ? Math.round(trainees.reduce((sum, t) => sum + t.dailyUpdatesCount, 0) / trainees.length)
                  : 0}
              </p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Avg. Hours</p>
              <p className="text-2xl font-bold text-neutral-900">
                {trainees.length > 0 
                  ? Math.round(trainees.reduce((sum, t) => sum + t.attendanceHours, 0) / trainees.length)
                  : 0}
              </p>
            </div>
            <Clock className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Avg. Progress</p>
              <p className="text-2xl font-bold text-neutral-900">
                {trainees.length > 0 
                  ? Math.round(trainees.reduce((sum, t) => sum + (t.trainingProgress || 0), 0) / trainees.length)
                  : 0}%
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Excel-like Table */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1400px]">
            <thead className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider sticky left-0 bg-gradient-to-r from-emerald-600 to-teal-600 z-10">
                  Employee ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Department</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Designation</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Joining Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Months Worked</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Daily Updates</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Attendance Hours</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Completed Projects</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Training Progress</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Last Update</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {filteredTrainees.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-neutral-500">
                    {searchTerm ? "No trainees found matching your search" : "No trainees found"}
                  </td>
                </tr>
              ) : (
                filteredTrainees.map((trainee, index) => (
                  <motion.tr
                    key={trainee._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-neutral-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-neutral-900 sticky left-0 bg-white z-10 border-r border-neutral-200">
                      {trainee.employeeId}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-900">{trainee.fullName}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{trainee.email}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{trainee.department}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{trainee.designation}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {new Date(trainee.joiningDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-900 font-medium">{trainee.monthsWorked}</td>
                    <td className="px-4 py-3 text-sm text-neutral-900 font-medium">{trainee.dailyUpdatesCount}</td>
                    <td className="px-4 py-3 text-sm text-neutral-900 font-medium">{trainee.attendanceHours}</td>
                    <td className="px-4 py-3 text-sm text-neutral-900 font-medium">{trainee.completedProjects}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-neutral-200 rounded-full h-2">
                          <div
                            className="bg-emerald-600 h-2 rounded-full transition-all"
                            style={{ width: `${trainee.trainingProgress || 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-neutral-900 w-12 text-right">
                          {trainee.trainingProgress || 0}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {trainee.lastUpdateDate 
                        ? new Date(trainee.lastUpdateDate).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setSelectedTrainee(trainee._id);
                          fetchTraineeDetails(trainee._id);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
                      >
                        <User className="w-4 h-4" />
                        View Details
                      </button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trainee Details Modal */}
      {selectedTrainee && traineeDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 flex items-center justify-between">
              <h3 className="text-xl font-bold">Trainee Details</h3>
              <button
                onClick={() => {
                  setSelectedTrainee(null);
                  setTraineeDetails(null);
                }}
                className="text-white hover:text-neutral-200"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-neutral-600">Name</p>
                  <p className="font-semibold">{traineeDetails.fullName}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-600">Email</p>
                  <p className="font-semibold">{traineeDetails.email}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-600">Skills</p>
                  <p className="font-semibold">{traineeDetails.skills?.join(", ") || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-600">Training Progress</p>
                  <p className="font-semibold">{traineeDetails.trainingProgress || 0}%</p>
                </div>
              </div>
              {traineeDetails.recentUpdates && traineeDetails.recentUpdates.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Recent Updates</h4>
                  <div className="space-y-2">
                    {traineeDetails.recentUpdates.map((update: any, idx: number) => (
                      <div key={idx} className="border border-neutral-200 rounded-lg p-3">
                        <p className="text-sm text-neutral-600">
                          {new Date(update.date).toLocaleDateString()}
                        </p>
                        <p className="text-sm">{update.workDetails || "No details"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}



