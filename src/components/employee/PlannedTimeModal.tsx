"use client";

import { useState, useEffect } from "react";
import { X, Calendar, Clock, Save } from "lucide-react";

interface PlannedTimeModalProps {
  projectId: string;
  projectName: string;
  currentPlannedDate?: string;
  currentPlannedTime?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PlannedTimeModal({
  projectId,
  projectName,
  currentPlannedDate,
  currentPlannedTime,
  onClose,
  onSuccess
}: PlannedTimeModalProps) {
  const [plannedDate, setPlannedDate] = useState<string>("");
  const [plannedTime, setPlannedTime] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    // Set initial values if they exist
    if (currentPlannedDate) {
      const date = new Date(currentPlannedDate);
      setPlannedDate(date.toISOString().split("T")[0]);
    } else {
      // Default to today
      setPlannedDate(new Date().toISOString().split("T")[0]);
    }
    
    if (currentPlannedTime) {
      setPlannedTime(currentPlannedTime);
    } else {
      // Default to current time
      const now = new Date();
      setPlannedTime(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    }
  }, [currentPlannedDate, currentPlannedTime]);

  const handleSave = async () => {
    if (!plannedDate || !plannedTime) {
      setError("Please select both date and time");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/projects/${projectId}/planned-time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plannedDate,
          plannedTime
        })
      });

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to save planned time");
      }
    } catch (error) {
      console.error("Error saving planned time:", error);
      setError("Failed to save planned time. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-4 rounded-t-xl flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Planned Time</h2>
            <p className="text-emerald-100 text-sm">{projectName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Date Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              Select Date
            </label>
            <input
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              min={new Date().toISOString().split("T")[0]}
            />
          </div>

          {/* Time Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              Select Time
            </label>
            <input
              type="time"
              value={plannedTime}
              onChange={(e) => setPlannedTime(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Preview */}
          {plannedDate && plannedTime && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Planned Time:</p>
              <p className="text-lg font-semibold text-emerald-900">
                {new Date(`${plannedDate}T${plannedTime}`).toLocaleString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true
                })}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !plannedDate || !plannedTime}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

