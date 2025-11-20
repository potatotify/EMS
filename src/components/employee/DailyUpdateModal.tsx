"use client";

import {useState} from "react";
import {Save} from "lucide-react";

interface Project {
  _id: string;
  projectName: string;
}

interface DailyUpdateModalProps {
  project: Project;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DailyUpdateModal({
  project,
  onClose,
  onSuccess
}: DailyUpdateModalProps) {
  const [formData, setFormData] = useState({
    progress: 0,
    hoursWorked: "",
    tasksCompleted: "",
    challenges: "",
    nextSteps: "",
    notes: ""
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/employee/submit-update", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          projectId: project._id,
          ...formData,
          tasksCompleted: formData.tasksCompleted
            .split("\n")
            .filter((t) => t.trim())
        })
      });

      if (response.ok) {
        onSuccess();
      } else {
        const data = await response.json();
        alert("Error: " + data.error);
      }
    } catch (error) {
      console.error("Error submitting update:", error);
      alert("Failed to submit update");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full my-8">
          <div className="bg-linear-to-r from-emerald-600 to-emerald-700 px-6 py-4 rounded-t-2xl">
            <h2 className="text-2xl font-bold text-white">
              Submit Daily Project Update
            </h2>
            <p className="text-emerald-100 text-sm mt-1">
              {project.projectName}
            </p>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Progress Slider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Progress: {formData.progress}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={formData.progress}
                onChange={(e) =>
                  setFormData({...formData, progress: parseInt(e.target.value)})
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Hours Worked */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hours Worked Today <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.5"
                required
                value={formData.hoursWorked}
                onChange={(e) =>
                  setFormData({...formData, hoursWorked: e.target.value})
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="e.g., 8"
              />
            </div>

            {/* Tasks Completed */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tasks Completed (one per line)
              </label>
              <textarea
                rows={4}
                value={formData.tasksCompleted}
                onChange={(e) =>
                  setFormData({...formData, tasksCompleted: e.target.value})
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="- Implemented user authentication&#10;- Fixed bug in payment module&#10;- Updated documentation"
              />
            </div>

            {/* Challenges */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Challenges Faced
              </label>
              <textarea
                rows={3}
                value={formData.challenges}
                onChange={(e) =>
                  setFormData({...formData, challenges: e.target.value})
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Describe any challenges or blockers"
              />
            </div>

            {/* Next Steps */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Next Steps
              </label>
              <textarea
                rows={3}
                value={formData.nextSteps}
                onChange={(e) =>
                  setFormData({...formData, nextSteps: e.target.value})
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="What will you work on next?"
              />
            </div>

            {/* Additional Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Notes
              </label>
              <textarea
                rows={2}
                value={formData.notes}
                onChange={(e) =>
                  setFormData({...formData, notes: e.target.value})
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Any other information"
              />
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {loading ? "Submitting..." : "Submit Update"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
