'use client';

import { useEffect, useState } from 'react';
import { Loader, Mail } from 'lucide-react';

interface Employee {
  _id: string;
  name: string;
  email: string;
  skills?: string[];
}

export default function AdminMessagesPanel() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const fetchEmployees = async () => {
      setLoadingEmployees(true);
      try {
        const res = await fetch('/api/employees/approved');
        const data = await res.json();
        if (res.ok) {
          setEmployees(data.employees || []);
        }
      } catch (err) {
        console.error('Error fetching employees for messaging', err);
      } finally {
        setLoadingEmployees(false);
      }
    };

    fetchEmployees();
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredEmployees.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredEmployees.map((e) => e._id));
    }
  };

  const handleSend = async () => {
    if (!message.trim() || selectedIds.length === 0) return;
    setSending(true);
    setStatus(null);
    try {
      const res = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeIds: selectedIds, message }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(`Message sent to ${data.count} employee(s).`);
        setMessage('');
      } else {
        setStatus(data.error || 'Failed to send message');
      }
    } catch (err) {
      console.error('Error sending admin message', err);
      setStatus('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const q = filter.toLowerCase().trim();
    if (!q) return true;
    const skillsText = (emp.skills || []).join(', ').toLowerCase();
    return (
      emp.name.toLowerCase().includes(q) ||
      emp.email.toLowerCase().includes(q) ||
      skillsText.includes(q)
    );
  });

  return (
    <div className="rounded-2xl overflow-hidden border border-emerald-100/50 bg-white/80 backdrop-blur-md shadow-lg mt-8">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center gap-3">
        <Mail className="w-5 h-5 text-white" />
        <h2 className="text-lg font-bold text-white">Message Employees</h2>
      </div>
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Employee selection */}
          <div className="lg:col-span-1 border border-emerald-100 rounded-xl p-4 bg-white/70">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Employees</h3>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs text-emerald-700 hover:underline"
              >
                {selectedIds.length === filteredEmployees.length
                  ? 'Clear selection'
                  : 'Select all'}
              </button>
            </div>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search by name, email or skill"
              className="w-full mb-3 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-emerald-500 focus:border-emerald-500"
            />
            <div className="max-h-64 overflow-y-auto space-y-1">
              {loadingEmployees ? (
                <div className="flex items-center justify-center py-6 text-gray-500 text-sm">
                  <Loader className="w-4 h-4 mr-2 animate-spin" /> Loading...
                </div>
              ) : filteredEmployees.length === 0 ? (
                <p className="text-sm text-gray-500">No employees found.</p>
              ) : (
                filteredEmployees.map((emp) => (
                  <label
                    key={emp._id}
                    className="flex items-start gap-2 p-2 rounded-lg hover:bg-emerald-50 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(emp._id)}
                      onChange={() => toggleSelect(emp._id)}
                      className="mt-1 h-4 w-4 text-emerald-600 border-gray-300 rounded"
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{emp.name}</p>
                      <p className="text-xs text-gray-500 truncate">{emp.email}</p>
                      {emp.skills && emp.skills.length > 0 && (
                        <p className="text-[11px] text-emerald-700 truncate">
                          Skills: {emp.skills.join(', ')}
                        </p>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Message composer */}
          <div className="lg:col-span-2 border border-emerald-100 rounded-xl p-4 bg-white/70 flex flex-col">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Compose Message</h3>
            <textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-emerald-500 focus:border-emerald-500 flex-1 mb-3"
              placeholder="Write a message to the selected employees..."
            />
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
              <span>
                {selectedIds.length} employee(s) selected
              </span>
              {status && <span className="text-emerald-700">{status}</span>}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !message.trim() || selectedIds.length === 0}
                className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending && <Loader className="w-4 h-4 mr-2 animate-spin" />}
                Send Message
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
