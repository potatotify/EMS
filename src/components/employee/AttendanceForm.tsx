'use client';

import { useState } from 'react';

export default function AttendanceForm() {
  const [workDetails, setWorkDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workDetails.trim()) {
      setMessage('Please enter what work you did today.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/employee/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workDetails }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage('Attendance marked successfully!');
        setWorkDetails('');
      } else {
        setMessage(data.error || 'Failed to mark attendance.');
      }
    } catch (error) {
      setMessage('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg p-6 mb-6 shadow border border-emerald-200 w-full">
      <h3 className="text-lg font-semibold mb-4 text-emerald-900">Mark Today's Attendance</h3>
      {message && (
        <p className={`mb-4 text-sm ${message.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}
      <form onSubmit={handleSubmit}>
        <textarea
          value={workDetails}
          onChange={(e) => setWorkDetails(e.target.value)}
          rows={4}
          placeholder="Describe what work you did today..."
          className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Marking...' : 'Mark Attendance'}
        </button>
      </form>
    </div>
  );
}
