'use client';

import { useEffect, useState } from 'react';
import { Mail, Loader, User, Shield } from 'lucide-react';

interface Message {
  _id: string;
  senderId: string;
  receiverId: string;
  senderRole: 'admin' | 'employee';
  receiverRole: 'admin' | 'employee';
  message: string;
  createdAt: string;
}

export default function EmployeeMessagesPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/employee/messages');
      const data = await res.json();
      if (res.ok) {
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Error fetching messages', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const handleSend = async () => {
    if (!reply.trim()) return;
    setSending(true);
    setStatus(null);
    try {
      const res = await fetch('/api/employee/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: reply }),
      });
      const data = await res.json();
      if (res.ok) {
        setReply('');
        setStatus('Reply sent to admin');
        await fetchMessages();
      } else {
        setStatus(data.error || 'Failed to send reply');
      }
    } catch (err) {
      console.error('Error sending reply', err);
      setStatus('Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-emerald-100 overflow-hidden mb-8 mt-8">
      <div className="bg-linear-to-r from-emerald-600 to-emerald-700 px-6 py-4 flex items-center gap-3">
        <Mail className="w-5 h-5 text-white" />
        <h2 className="text-lg font-bold text-white">Messages from Admin</h2>
      </div>
      <div className="p-6 space-y-4">
        <div className="max-h-64 overflow-y-auto border border-emerald-50 rounded-xl p-3 bg-emerald-50/40">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-gray-500 text-sm">
              <Loader className="w-4 h-4 mr-2 animate-spin" /> Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <p className="text-sm text-gray-500">No messages yet. Admin messages will appear here.</p>
          ) : (
            <div className="space-y-3 text-sm">
              {messages.map((msg) => {
                const isAdmin = msg.senderRole === 'admin';
                return (
                  <div
                    key={msg._id}
                    className={`flex ${isAdmin ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-xl px-3 py-2 shadow-sm border text-sm ${
                        isAdmin
                          ? 'bg-white border-emerald-100 text-gray-900'
                          : 'bg-emerald-600 border-emerald-700 text-white'
                      }`}
                    >
                      <div className="flex items-center gap-1 mb-1 text-[11px] opacity-80">
                        {isAdmin ? (
                          <>
                            <Shield className="w-3 h-3" />
                            <span>Admin</span>
                          </>
                        ) : (
                          <>
                            <User className="w-3 h-3" />
                            <span>You</span>
                          </>
                        )}
                        <span className="mx-1">·</span>
                        <span>
                          {new Date(msg.createdAt).toLocaleString(undefined, {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 pt-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Reply to Admin</h3>
          <textarea
            rows={3}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Write a reply to your admin..."
          />
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            {status && <span className="text-emerald-700">{status}</span>}
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !reply.trim()}
              className="inline-flex items-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending && <Loader className="w-3 h-3 mr-1 animate-spin" />}
              Send Reply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
