"use client";

import {useState} from "react";
import {X, CheckCircle} from "lucide-react";
import {motion} from "framer-motion";

interface AttendanceModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AttendanceModal({
  onClose,
  onSuccess
}: AttendanceModalProps) {
  const [workDetails, setWorkDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workDetails.trim()) {
      setMessage("Please enter what work you did today.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/employee/attendance", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({workDetails})
      });

      const data = await response.json();
      if (response.ok) {
        setMessage("Attendance marked successfully!");
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setMessage(data.error || "Failed to mark attendance.");
      }
    } catch (error) {
      setMessage("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
      <motion.div
        initial={{opacity: 0, scale: 0.95, y: 20}}
        animate={{opacity: 1, scale: 1, y: 0}}
        exit={{opacity: 0, scale: 0.95, y: 20}}
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
      >
        <div className="bg-linear-to-r from-emerald-600 to-emerald-700 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">
            Mark Today's Attendance
          </h3>
          <motion.button
            whileHover={{scale: 1.1, rotate: 90}}
            whileTap={{scale: 0.9}}
            onClick={onClose}
            className="p-2 rounded-xl text-white hover:bg-white/20 transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </motion.button>
        </div>
        <div className="p-6">
          {message && (
            <motion.div
              initial={{opacity: 0, y: -10}}
              animate={{opacity: 1, y: 0}}
              className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
                message.includes("success")
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {message.includes("success") && (
                <CheckCircle className="w-4 h-4" />
              )}
              {message}
            </motion.div>
          )}
          <form onSubmit={handleSubmit}>
            <textarea
              value={workDetails}
              onChange={(e) => setWorkDetails(e.target.value)}
              rows={5}
              placeholder="Describe what work you did today..."
              className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              disabled={loading}
            />
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Marking..." : "Mark Attendance"}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
