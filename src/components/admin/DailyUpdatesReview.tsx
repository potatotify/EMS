"use client";

import {useState, useEffect} from "react";
import {useSession} from "next-auth/react";
import {CheckCircle, XCircle, Clock} from "lucide-react";

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

  // Daily Updates
  attendedMorningSession: boolean;
  cameOnTime: boolean;
  workedOnProject: boolean;
  askedForNewProject: boolean;
  gotCodeCorrected: boolean;
  updatedClient: boolean;
  workedOnTrainingTask: boolean;
  updatedSeniorTeam: boolean;
  updatedDailyProgress: boolean;
  plannedNextDayTask: boolean;
  completedAllTasks: boolean;
  workedOnMultipleProjects: boolean;
  tasksForTheDay: string;

  // Project Management
  informedUnableToComplete: boolean;
  ensuredProjectReassigned: boolean;
  ensuredProjectOnTime: boolean;
  informedBeforeBunking: boolean;
  informedBeforeLate: boolean;
  informedLeavingMeeting: boolean;
  freelancerNeeded: boolean;
  ensuredFreelancerHired: boolean;
  addedToWhatsAppGroup: boolean;
  slackGroupCreated: boolean;
  projectAssignedToSomeoneElse: boolean;
  supervisor: string;
  projectInPriority: boolean;
  followedUpWithClient: boolean;
  completedAllProjectTasks: boolean;
  setTaskDeadlines: boolean;
  recordedLoomVideos: boolean;
  organizedLoomVideos: boolean;
  metDeadlines: boolean;
  screenShared: boolean;

  hoursWorked: number;
  additionalNotes: string;
}

export default function DailyUpdatesReview() {
  const {data: session} = useSession();
  const [updates, setUpdates] = useState<DailyUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUpdate, setSelectedUpdate] = useState<DailyUpdate | null>(
    null
  );
  const [adminScore, setAdminScore] = useState(0);
  const [adminNotes, setAdminNotes] = useState("");
  const [adminApproved, setAdminApproved] = useState(false);
  const [editableData, setEditableData] = useState<any>(null);
  const [filterDate, setFilterDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [filterEmployee, setFilterEmployee] = useState("");

  useEffect(() => {
    fetchUpdates();
  }, [filterDate, filterEmployee]);

  const fetchUpdates = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterDate) params.append("date", filterDate);
      if (filterEmployee) params.append("employeeId", filterEmployee);

      const url = `/api/daily-updates?${params.toString()}`;
      console.log("Fetching updates from:", url);

      const response = await fetch(url);
      const data = await response.json();

      console.log("Response status:", response.status);
      console.log("Response data:", data);

      if (!response.ok) {
        console.error("API Error:", data);
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

  const calculateAutoScore = (data: any) => {
    // Count all checked checkboxes
    const checkboxFields = [
      "attendedMorningSession",
      "cameOnTime",
      "workedOnProject",
      "askedForNewProject",
      "gotCodeCorrected",
      "updatedClient",
      "workedOnTrainingTask",
      "updatedSeniorTeam",
      "updatedDailyProgress",
      "plannedNextDayTask",
      "completedAllTasks",
      "workedOnMultipleProjects",
      "informedUnableToComplete",
      "ensuredProjectReassigned",
      "ensuredProjectOnTime",
      "informedBeforeBunking",
      "informedBeforeLate",
      "informedLeavingMeeting",
      "freelancerNeeded",
      "ensuredFreelancerHired",
      "addedToWhatsAppGroup",
      "slackGroupCreated",
      "projectAssignedToSomeoneElse",
      "projectInPriority",
      "followedUpWithClient",
      "completedAllProjectTasks",
      "setTaskDeadlines",
      "recordedLoomVideos",
      "organizedLoomVideos",
      "metDeadlines",
      "screenShared"
    ];

    let checkedCount = 0;
    checkboxFields.forEach((field) => {
      if (data[field]) checkedCount++;
    });

    // Calculate percentage: (checked / total) * 100
    const score = Math.round((checkedCount / checkboxFields.length) * 100);
    return score;
  };

  const handleSelectUpdate = (update: DailyUpdate) => {
    setSelectedUpdate(update);
    const autoScore = calculateAutoScore(update);
    setAdminScore(autoScore);
    setAdminNotes(update.adminNotes || "");
    setAdminApproved(update.adminApproved || false);
    setEditableData({...update});
  };

  const handleCheckboxChange = (field: string, value: boolean) => {
    setEditableData((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveReview = async () => {
    if (!selectedUpdate || !editableData) return;

    try {
      const response = await fetch(`/api/daily-updates/${selectedUpdate._id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          status: "reviewed",
          adminScore,
          adminNotes,
          adminApproved,
          // Include all editable checkbox fields
          attendedMorningSession: editableData.attendedMorningSession,
          cameOnTime: editableData.cameOnTime,
          workedOnProject: editableData.workedOnProject,
          askedForNewProject: editableData.askedForNewProject,
          gotCodeCorrected: editableData.gotCodeCorrected,
          updatedClient: editableData.updatedClient,
          workedOnTrainingTask: editableData.workedOnTrainingTask,
          updatedSeniorTeam: editableData.updatedSeniorTeam,
          updatedDailyProgress: editableData.updatedDailyProgress,
          plannedNextDayTask: editableData.plannedNextDayTask,
          completedAllTasks: editableData.completedAllTasks,
          workedOnMultipleProjects: editableData.workedOnMultipleProjects,
          informedUnableToComplete: editableData.informedUnableToComplete,
          ensuredProjectReassigned: editableData.ensuredProjectReassigned,
          ensuredProjectOnTime: editableData.ensuredProjectOnTime,
          informedBeforeBunking: editableData.informedBeforeBunking,
          informedBeforeLate: editableData.informedBeforeLate,
          informedLeavingMeeting: editableData.informedLeavingMeeting,
          freelancerNeeded: editableData.freelancerNeeded,
          ensuredFreelancerHired: editableData.ensuredFreelancerHired,
          addedToWhatsAppGroup: editableData.addedToWhatsAppGroup,
          slackGroupCreated: editableData.slackGroupCreated,
          projectAssignedToSomeoneElse:
            editableData.projectAssignedToSomeoneElse,
          projectInPriority: editableData.projectInPriority,
          followedUpWithClient: editableData.followedUpWithClient,
          completedAllProjectTasks: editableData.completedAllProjectTasks,
          setTaskDeadlines: editableData.setTaskDeadlines,
          recordedLoomVideos: editableData.recordedLoomVideos,
          organizedLoomVideos: editableData.organizedLoomVideos,
          metDeadlines: editableData.metDeadlines,
          screenShared: editableData.screenShared
        })
      });

      if (response.ok) {
        alert("Review saved successfully!");
        setSelectedUpdate(null);
        setEditableData(null);
        fetchUpdates();
      } else {
        alert("Failed to save review");
      }
    } catch (error) {
      console.error("Error saving review:", error);
      alert("Error saving review");
    }
  };

  const calculateScore = (update: DailyUpdate): number => {
    let score = 0;
    const fields = [
      "attendedMorningSession",
      "cameOnTime",
      "workedOnProject",
      "askedForNewProject",
      "gotCodeCorrected",
      "updatedClient",
      "workedOnTrainingTask",
      "updatedSeniorTeam",
      "updatedDailyProgress",
      "plannedNextDayTask",
      "completedAllTasks",
      "workedOnMultipleProjects"
    ];

    fields.forEach((field) => {
      if (update[field as keyof DailyUpdate]) score += 1;
    });

    return score;
  };

  return (
    <>
      {/* Filters */}
      <div className="bg-white/90 p-6 border-b border-gray-200 rounded-t-xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date
            </label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Employee ID (Optional)
            </label>
            <input
              type="text"
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              placeholder="Filter by employee ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchUpdates}
              className="w-full px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors font-medium"
            >
              Refresh Updates
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Updates List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow h-[600px] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Updates ({updates.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-200 overflow-y-auto flex-1">
              {loading ? (
                <div className="px-6 py-4 text-center text-gray-500">
                  Loading...
                </div>
              ) : updates.length === 0 ? (
                <div className="px-6 py-4 text-center text-gray-500">
                  No updates found
                </div>
              ) : (
                updates.map((update) => (
                  <button
                    key={update._id}
                    onClick={() => handleSelectUpdate(update)}
                    className={`w-full text-left px-6 py-4 hover:bg-gray-50 transition-colors ${
                      selectedUpdate?._id === update._id ? "bg-emerald-50" : ""
                    }`}
                  >
                    <div className="font-medium text-gray-900">
                      {update.employeeId.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(update.date).toLocaleDateString()}
                    </div>
                    <div className="text-xs mt-1">
                      <span
                        className={`inline-block px-2 py-1 rounded ${
                          update.status === "approved"
                            ? "bg-green-100 text-green-800"
                            : update.status === "reviewed"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {update.status}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Review Panel */}
        <div className="lg:col-span-2">
          {selectedUpdate ? (
            <div className="bg-white rounded-lg shadow h-[600px] flex flex-col">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  Review: {selectedUpdate.employeeId.name}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(selectedUpdate.date).toLocaleDateString()}
                </p>
              </div>

              <div className="px-6 py-4 space-y-6 overflow-y-auto flex-1">
                {/* Daily Updates Summary */}
                <div className="border-b pb-4">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    Daily Updates
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      {
                        key: "attendedMorningSession",
                        label: "Attended morning session"
                      },
                      {key: "cameOnTime", label: "Came on time"},
                      {key: "workedOnProject", label: "Worked on project"},
                      {
                        key: "askedForNewProject",
                        label: "Asked for new project"
                      },
                      {key: "gotCodeCorrected", label: "Got code corrected"},
                      {key: "updatedClient", label: "Updated client"},
                      {
                        key: "workedOnTrainingTask",
                        label: "Worked on training"
                      },
                      {key: "updatedSeniorTeam", label: "Updated senior team"},
                      {
                        key: "updatedDailyProgress",
                        label: "Updated daily progress"
                      },
                      {key: "plannedNextDayTask", label: "Planned next day"},
                      {key: "completedAllTasks", label: "Completed all tasks"},
                      {
                        key: "workedOnMultipleProjects",
                        label: "Multiple projects"
                      }
                    ].map(({key, label}) => (
                      <div
                        key={key}
                        className="flex items-center p-2 rounded bg-gray-50 hover:bg-gray-100 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={editableData?.[key] || false}
                          onChange={(e) =>
                            handleCheckboxChange(key, e.target.checked)
                          }
                          className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500 mr-2"
                        />
                        <span
                          className={
                            editableData?.[key]
                              ? "text-gray-900 font-medium"
                              : "text-gray-600"
                          }
                        >
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tasks for the Day */}
                {selectedUpdate.tasksForTheDay && (
                  <div className="border-b pb-4">
                    <h4 className="font-medium text-gray-900 mb-2">
                      Tasks for the Day
                    </h4>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                      {selectedUpdate.tasksForTheDay}
                    </p>
                  </div>
                )}

                {/* Project Management */}
                <div className="border-b pb-4">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                    Project Management
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      {
                        key: "informedUnableToComplete",
                        label: "Informed unable to complete"
                      },
                      {
                        key: "ensuredProjectReassigned",
                        label: "Project reassigned"
                      },
                      {key: "ensuredProjectOnTime", label: "Project on time"},
                      {
                        key: "informedBeforeBunking",
                        label: "Informed before bunking"
                      },
                      {
                        key: "informedBeforeLate",
                        label: "Informed before late"
                      },
                      {
                        key: "informedLeavingMeeting",
                        label: "Informed leaving meeting"
                      },
                      {key: "freelancerNeeded", label: "Freelancer needed"},
                      {
                        key: "ensuredFreelancerHired",
                        label: "Freelancer hired"
                      },
                      {
                        key: "addedToWhatsAppGroup",
                        label: "Added to WhatsApp group"
                      },
                      {key: "slackGroupCreated", label: "Slack group created"},
                      {
                        key: "projectAssignedToSomeoneElse",
                        label: "Assigned to someone else"
                      },
                      {key: "projectInPriority", label: "Project in priority"},
                      {
                        key: "followedUpWithClient",
                        label: "Followed up with client"
                      },
                      {
                        key: "completedAllProjectTasks",
                        label: "All project tasks done"
                      },
                      {key: "setTaskDeadlines", label: "Set task deadlines"},
                      {
                        key: "recordedLoomVideos",
                        label: "Recorded Loom videos"
                      },
                      {
                        key: "organizedLoomVideos",
                        label: "Organized Loom videos"
                      },
                      {key: "metDeadlines", label: "Met deadlines"},
                      {key: "screenShared", label: "Screensharing at all times"}
                    ].map(({key, label}) => (
                      <div
                        key={key}
                        className="flex items-center p-2 rounded bg-gray-50 hover:bg-gray-100 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={editableData?.[key] || false}
                          onChange={(e) =>
                            handleCheckboxChange(key, e.target.checked)
                          }
                          className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500 mr-2"
                        />
                        <span
                          className={
                            editableData?.[key]
                              ? "text-gray-900 font-medium"
                              : "text-gray-600"
                          }
                        >
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Supervisor */}
                {selectedUpdate.supervisor && (
                  <div className="border-b pb-4">
                    <h4 className="font-medium text-gray-900 mb-2">
                      Supervisor
                    </h4>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                      {selectedUpdate.supervisor}
                    </p>
                  </div>
                )}

                {/* Hours Worked */}
                <div className="border-b pb-4">
                  <h4 className="font-medium text-gray-900 mb-2">
                    Hours Worked
                  </h4>
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-purple-600" />
                    <span className="text-lg font-semibold text-gray-900">
                      {selectedUpdate.hoursWorked} hours
                    </span>
                  </div>
                </div>

                {/* Additional Notes */}
                {selectedUpdate.additionalNotes && (
                  <div className="border-b pb-4">
                    <h4 className="font-medium text-gray-900 mb-2">
                      Additional Notes
                    </h4>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                      {selectedUpdate.additionalNotes}
                    </p>
                  </div>
                )}

                {/* Admin Review */}
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="font-medium text-gray-900 mb-3">
                    Admin Review
                  </h4>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Score (0-100)
                    </label>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={adminScore}
                          onChange={(e) =>
                            setAdminScore(Number(e.target.value))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                        />
                      </div>
                      <button
                        onClick={() => {
                          const autoScore = calculateAutoScore(editableData);
                          setAdminScore(autoScore);
                        }}
                        className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        Auto Calculate
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Auto-calculated based on checkbox completion
                    </p>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      rows={3}
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  <div className="mb-4 flex items-center">
                    <input
                      type="checkbox"
                      id="approved"
                      checked={adminApproved}
                      onChange={(e) => setAdminApproved(e.target.checked)}
                      className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                    />
                    <label
                      htmlFor="approved"
                      className="ml-2 block text-sm text-gray-700"
                    >
                      Approve this update
                    </label>
                  </div>

                  <button
                    onClick={adminApproved ? handleSaveReview : () => {}}
                    disabled={!adminApproved}
                    className={`w-full px-4 py-2 rounded-md transition-colors
                    ${
                      adminApproved
                        ? "bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                        : "bg-gray-400 text-gray-200 cursor-not-allowed"
                    }`}
                  >
                    Save Review
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow h-[600px] flex items-center justify-center text-gray-500">
              Select an update to review
            </div>
          )}
        </div>
      </div>
    </>
  );
}
