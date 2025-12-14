"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface ChecklistItem {
  label: string;
  checked: boolean;
  type: 'global' | 'role' | 'custom';
}

interface DailyUpdateFormData {
  checklist: ChecklistItem[];
  tasksForTheDay: string;
  hoursWorked: number;
  additionalNotes: string;
}

export default function DailyUpdateForm() {
  const { data: session } = useSession();
  const [formData, setFormData] = useState<DailyUpdateFormData>({
    checklist: [],
    tasksForTheDay: "",
    hoursWorked: 0,
    additionalNotes: ""
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [hasSubmittedToday, setHasSubmittedToday] = useState(false);
  const [checklistInfo, setChecklistInfo] = useState<{ type?: string; name?: string } | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        // 1. Fetch checklist configuration
        const configResponse = await fetch("/api/employee/checklist-config");
        const configData = await configResponse.json();
        const configuredChecklist = configData.checklist || [];
        setChecklistInfo({
          type: configData.configType,
          name: configData.configName
        });

        // 2. Check for existing submission
        const response = await fetch("/api/daily-updates");
        const updates = await response.json();
        const today = new Date().toISOString().split("T")[0];

        const todaysUpdate = updates.find((update: any) => {
          const updateDate = new Date(update.date).toISOString().split("T")[0];
          return updateDate === today;
        });

        if (todaysUpdate) {
          // If submitted, use the submitted checklist
          // If submitted checklist is missing (legacy), map legacy fields
          let checklist = todaysUpdate.checklist;
          if (!checklist || checklist.length === 0) {
            // Legacy mapping if needed, or just show configured checklist as unchecked?
            // Better to show configured checklist but try to map values if possible.
            // For simplicity, if legacy, we might just show the legacy fields? 
            // But we want to move forward.
            // Let's just use the configured checklist and try to map legacy values if they match labels.
            // Actually, if it's legacy, we can't easily map back to dynamic labels unless we hardcode.
            // Let's assume for now we just show the configured checklist.
            checklist = configuredChecklist.map((item: any) => ({
              ...item,
              checked: false // Cannot infer from legacy easily without mapping
            }));
          }

          setFormData({
            checklist: checklist,
            tasksForTheDay: todaysUpdate.tasksForTheDay || "",
            hoursWorked: todaysUpdate.hoursWorked || 0,
            additionalNotes: todaysUpdate.additionalNotes || ""
          });
          setHasSubmittedToday(true);
        } else {
          // Not submitted, use configured checklist
          setFormData(prev => ({
            ...prev,
            checklist: configuredChecklist.map((item: any) => ({
              ...item,
              checked: false
            }))
          }));
        }
      } catch (error) {
        console.error("Error initializing form:", error);
      } finally {
        setLoading(false);
      }
    };

    if (session) {
      init();
    }
  }, [session]);

  const handleChecklistChange = (index: number, checked: boolean) => {
    const newChecklist = [...formData.checklist];
    newChecklist[index].checked = checked;
    setFormData(prev => ({ ...prev, checklist: newChecklist }));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const submitData = {
        checklist: formData.checklist,
        tasksForTheDay: formData.tasksForTheDay,
        hoursWorked: formData.hoursWorked,
        additionalNotes: formData.additionalNotes,
        // Legacy fields set to false/default
        workedOnProject: false,
        updatedDailyProgress: false,
        recordedLoomVideos: false,
        updatedClient: false,
        completedAllTasks: false
      };

      console.log("Submitting daily update:", submitData);
      
      const response = await fetch("/api/daily-updates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(submitData)
      });

      let responseData;
      try {
        responseData = await response.json();
        console.log("Response status:", response.status);
        console.log("Response data:", responseData);
      } catch (parseError) {
        console.error("Error parsing response:", parseError);
        throw new Error("Invalid response from server");
      }

      if (!response.ok) {
        const errorMessage = responseData?.error || responseData?.details || "Failed to submit daily update";
        const validationErrors = responseData?.validationErrors;
        let fullErrorMessage = errorMessage;
        
        if (validationErrors && Object.keys(validationErrors).length > 0) {
          fullErrorMessage += "\n" + Object.entries(validationErrors).map(([key, val]) => `${key}: ${val}`).join("\n");
        }
        
        console.error("Error response:", responseData);
        throw new Error(fullErrorMessage);
      }

      setMessage({
        type: "success",
        text: "Daily update submitted successfully!"
      });
      setHasSubmittedToday(true);
      
      // Refresh notifications to clear the daily update reminder
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('refreshNotifications'));
      }
      
      // Refresh the form data
      const configResponse = await fetch("/api/employee/checklist-config");
      const configData = await configResponse.json();
      if (configResponse.ok) {
        const configuredChecklist = configData.checklist || [];
        setFormData(prev => ({
          ...prev,
          checklist: configuredChecklist.map((item: any) => ({
            ...item,
            checked: responseData.dailyUpdate?.checklist?.find((c: any) => c.label === item.label)?.checked || false
          }))
        }));
      }
    } catch (error) {
      console.error("Error submitting daily update:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to submit daily update. Please try again.";
      setMessage({
        type: "error",
        text: errorMessage
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading form...</div>;
  }

  return (
    <>
      <div className="flex justify-start mb-4">
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
          {hasSubmittedToday ? "Submitted" : "Pending"}
        </span>
      </div>
      {message && (
        <div
          className={`mb-6 p-4 rounded ${message.type === "success"
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Daily Updates</h3>
              {checklistInfo && (
                <div className="flex items-center gap-2">
                  {checklistInfo.type && (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      checklistInfo.type === 'global' ? 'bg-emerald-100 text-emerald-700' :
                      checklistInfo.type === 'skill' ? 'bg-blue-100 text-blue-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>
                      {checklistInfo.type}
                    </span>
                  )}
                  {checklistInfo.name && (
                    <span className="text-sm text-gray-600">{checklistInfo.name}</span>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                {formData.checklist.length === 0 && (
                  <p className="text-sm text-gray-500 italic">No checks configured.</p>
                )}
                {formData.checklist.map((item, index) => (
                  <div key={index} className="flex items-start py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      id={`check-${index}`}
                      checked={item.checked}
                      onChange={(e) => handleChecklistChange(index, e.target.checked)}
                      className="h-5 w-5 mt-0.5 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded shrink-0"
                      disabled={hasSubmittedToday}
                    />
                    <label
                      htmlFor={`check-${index}`}
                      className="ml-3 block text-sm text-gray-700 leading-relaxed"
                    >
                      {item.label}
                      {item.type !== 'global' && (
                        <span className="ml-2 text-xs text-gray-400">({item.type})</span>
                      )}
                    </label>
                  </div>
                ))}
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
                disabled={submitting}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting..." : "Submit Daily Update"}
              </button>
            </div>
          )}
        </form>
      )}
    </>
  );
}
