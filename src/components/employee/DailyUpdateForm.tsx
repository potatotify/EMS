"use client";

import {useState, useEffect} from "react";
import {useSession} from "next-auth/react";

interface DailyUpdateFormData {
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

export default function DailyUpdateForm() {
  const {data: session} = useSession();
  const [formData, setFormData] = useState<DailyUpdateFormData>({
    workedOnProject: false,
    updatedDailyProgress: false,
    recordedLoomVideos: false,
    updatedClient: false,
    completedAllTasks: false,
    tasksForTheDay: "",
    hoursWorked: 0,
    additionalNotes: ""
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [hasSubmittedToday, setHasSubmittedToday] = useState(false);

  useEffect(() => {
    // Check if user has already submitted for today
    const checkSubmission = async () => {
      try {
        const response = await fetch("/api/daily-updates");
        const updates = await response.json();
        const today = new Date().toISOString().split("T")[0];

        const todaysUpdate = updates.find((update: any) => {
          const updateDate = new Date(update.date).toISOString().split("T")[0];
          return updateDate === today;
        });

        if (todaysUpdate) {
          // Map only the essential fields
          setFormData({
            workedOnProject: todaysUpdate.workedOnProject || false,
            updatedDailyProgress: todaysUpdate.updatedDailyProgress || false,
            recordedLoomVideos: todaysUpdate.recordedLoomVideos || false,
            updatedClient: todaysUpdate.updatedClient || false,
            completedAllTasks: todaysUpdate.completedAllTasks || false,
            tasksForTheDay: todaysUpdate.tasksForTheDay || "",
            hoursWorked: todaysUpdate.hoursWorked || 0,
            additionalNotes: todaysUpdate.additionalNotes || ""
          });
          setHasSubmittedToday(true);
        }
      } catch (error) {
        console.error("Error checking for existing submission:", error);
      }
    };

    checkSubmission();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const {name, value, type} = e.target as HTMLInputElement;

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const {name, value} = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // Submit only essential fields, set all others to false/default
      const submitData = {
        ...formData,
        // Set all other fields to false/default for backward compatibility
        attendedMorningSession: false,
        cameOnTime: false,
        askedForNewProject: false,
        gotCodeCorrected: false,
        workedOnTrainingTask: false,
        updatedSeniorTeam: false,
        plannedNextDayTask: false,
        workedOnMultipleProjects: false,
        informedUnableToComplete: false,
        ensuredProjectReassigned: false,
        ensuredProjectOnTime: false,
        informedBeforeBunking: false,
        informedBeforeLate: false,
        informedLeavingMeeting: false,
        freelancerNeeded: false,
        ensuredFreelancerHired: false,
        addedToWhatsAppGroup: false,
        slackGroupCreated: false,
        projectAssignedToSomeoneElse: false,
        supervisor: "",
        projectInPriority: false,
        followedUpWithClient: false,
        completedAllProjectTasks: false,
        setTaskDeadlines: false,
        organizedLoomVideos: false,
        metDeadlines: false,
        screenShared: false
      };

      const response = await fetch("/api/daily-updates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(submitData)
      });

      if (!response.ok) {
        throw new Error("Failed to submit daily update");
      }

      setMessage({
        type: "success",
        text: "Daily update submitted successfully!"
      });
      setHasSubmittedToday(true);
    } catch (error) {
      console.error("Error submitting daily update:", error);
      setMessage({
        type: "error",
        text: "Failed to submit daily update. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  const renderCheckbox = (name: keyof DailyUpdateFormData, label: string) => (
    <div className="flex items-start py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors">
      <input
        type="checkbox"
        id={name}
        name={name}
        checked={!!formData[name] as boolean}
        onChange={handleChange}
        className="h-5 w-5 mt-0.5 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded shrink-0"
        disabled={hasSubmittedToday}
      />
      <label
        htmlFor={name}
        className="ml-3 block text-sm text-gray-700 leading-relaxed"
      >
        {label}
      </label>
    </div>
  );

  return (
    <>
      <div className="flex justify-start mb-4">
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
          {hasSubmittedToday ? "Submitted" : "Pending"}
        </span>
      </div>
      {message && (
        <div
          className={`mb-6 p-4 rounded ${
            message.type === "success"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}
      {hasSubmittedToday ? (
        <div className="border border-emerald-100 bg-emerald-50 rounded-lg p-4 flex items-center justify-between ">
          <div>
            <p className="text-sm font-medium text-emerald-900">
              Daily update submitted
            </p>
            <p className="text-xs text-emerald-700 mt-1">
              You have already submitted your update for today.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Daily Updates</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                {renderCheckbox(
                  "workedOnProject",
                  "Worked on my project"
                )}
                {renderCheckbox(
                  "updatedDailyProgress",
                  "Updated Daily Progress (GForm)"
                )}
                {renderCheckbox(
                  "recordedLoomVideos",
                  "Recorded Loom Videos"
                )}
                {renderCheckbox("updatedClient", "Updated client")}
                {renderCheckbox(
                  "completedAllTasks",
                  "Completed all tasks for the day"
                )}
              </div>

              <div>
                <label
                  htmlFor="tasksForTheDay"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Tasks for the day
                </label>
                <textarea
                  id="tasksForTheDay"
                  name="tasksForTheDay"
                  rows={3}
                  value={formData.tasksForTheDay}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                  disabled={hasSubmittedToday}
                  placeholder="Describe your tasks for today..."
                />
              </div>

              <div>
                <label
                  htmlFor="hoursWorked"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Hours worked today
                </label>
                <input
                  type="number"
                  id="hoursWorked"
                  name="hoursWorked"
                  min="0"
                  max="24"
                  step="0.5"
                  value={formData.hoursWorked}
                  onChange={handleNumberChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                  disabled={hasSubmittedToday}
                  placeholder="e.g., 8"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="additionalNotes"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Additional Notes (Optional)
                </label>
                <textarea
                  id="additionalNotes"
                  name="additionalNotes"
                  rows={3}
                  value={formData.additionalNotes}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm resize-none"
                  disabled={hasSubmittedToday}
                  placeholder="Any additional notes or comments..."
                />
              </div>
            </div>
          </div>

          {!hasSubmittedToday && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Submitting..." : "Submit Daily Update"}
              </button>
            </div>
          )}
        </form>
      )}
    </>
  );
}
