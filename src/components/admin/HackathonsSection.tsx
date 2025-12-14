"use client";

import {useState, useEffect} from "react";
import {motion} from "framer-motion";
import {
  Trophy,
  Plus,
  Calendar,
  Users,
  Award,
  Edit2,
  Trash2,
  X,
  Save,
  Tag,
  Eye,
  Github,
  Globe,
  Video,
  ExternalLink,
  CheckCircle
} from "lucide-react";

interface Hackathon {
  _id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  maxParticipants?: number;
  prizePool?: number;
  prizePoints?: number;
  prizeCurrency?: number;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  rules: string[];
  tags: string[];
  participantsCount?: number;
  winnerId?: string;
  winnerDeclaredAt?: string;
}

interface Submission {
  _id: string;
  userId: string;
  userName: string;
  userEmail: string;
  isEmployee: boolean;
  employeeId?: string | null;
  submission: {
    projectName: string;
    description: string;
    githubLink?: string;
    demoLink?: string;
    videoLink?: string;
    submittedAt: string;
  } | null;
  status: string;
  score?: number | null;
  rank?: number | null;
  submittedAt?: string | null;
  profile?: {
    fullName: string;
    skills: string[];
    githubProfile?: string | null;
    portfolioLink?: string | null;
  } | null;
}

export default function HackathonsSection() {
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingHackathon, setEditingHackathon] = useState<Hackathon | null>(null);
  const [viewingSubmissions, setViewingSubmissions] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [declaringWinner, setDeclaringWinner] = useState<string | null>(null);
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    registrationDeadline: '',
    maxParticipants: '',
    prizePool: '',
    prizePoints: '',
    prizeCurrency: '',
    rules: '',
    tags: '',
    status: 'upcoming' as 'upcoming' | 'active' | 'completed' | 'cancelled'
  });

  useEffect(() => {
    fetchHackathons();
  }, []);

  const fetchHackathons = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/hackathons");
      const data = await response.json();
      if (response.ok) {
        setHackathons(data.hackathons || []);
      }
    } catch (error) {
      console.error("Error fetching hackathons:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setFormData({
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      registrationDeadline: '',
      maxParticipants: '',
      prizePool: '',
      prizePoints: '',
      prizeCurrency: '',
      rules: '',
      tags: '',
      status: 'upcoming'
    });
    setEditingHackathon(null);
    setShowCreateModal(true);
  };

  const handleEdit = (hackathon: Hackathon) => {
    setFormData({
      name: hackathon.name,
      description: hackathon.description,
      startDate: new Date(hackathon.startDate).toISOString().split('T')[0],
      endDate: new Date(hackathon.endDate).toISOString().split('T')[0],
      registrationDeadline: new Date(hackathon.registrationDeadline).toISOString().split('T')[0],
      maxParticipants: hackathon.maxParticipants?.toString() || '',
      prizePool: hackathon.prizePool?.toString() || '',
      prizePoints: hackathon.prizePoints?.toString() || '',
      prizeCurrency: hackathon.prizeCurrency?.toString() || '',
      rules: hackathon.rules.join('\n'),
      tags: hackathon.tags.join(', '),
      status: hackathon.status
    });
    setEditingHackathon(hackathon);
    setShowCreateModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const rules = formData.rules.split('\n').filter(r => r.trim());
      const tags = formData.tags.split(',').map(t => t.trim()).filter(t => t);

      const payload = {
        ...formData,
        maxParticipants: formData.maxParticipants ? parseInt(formData.maxParticipants) : undefined,
        prizePool: formData.prizePool ? parseFloat(formData.prizePool) : undefined,
        prizePoints: formData.prizePoints ? parseInt(formData.prizePoints) : undefined,
        prizeCurrency: formData.prizeCurrency ? parseFloat(formData.prizeCurrency) : undefined,
        rules,
        tags
      };

      const url = editingHackathon
        ? `/api/admin/hackathons/${editingHackathon._id}`
        : '/api/admin/hackathons';
      const method = editingHackathon ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setShowCreateModal(false);
        setEditingHackathon(null);
        fetchHackathons();
        alert(editingHackathon ? 'Hackathon updated successfully!' : 'Hackathon created successfully!');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to save hackathon');
      }
    } catch (error) {
      console.error('Error saving hackathon:', error);
      alert('Failed to save hackathon');
    }
  };

  const handleDelete = async (hackathonId: string) => {
    if (!confirm('Are you sure you want to delete this hackathon?')) return;

    try {
      const response = await fetch(`/api/admin/hackathons/${hackathonId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchHackathons();
        alert('Hackathon deleted successfully!');
      } else {
        alert('Failed to delete hackathon');
      }
    } catch (error) {
      console.error('Error deleting hackathon:', error);
      alert('Failed to delete hackathon');
    }
  };

  const handleViewSubmissions = async (hackathonId: string) => {
    setViewingSubmissions(hackathonId);
    setLoadingSubmissions(true);
    try {
      const response = await fetch(`/api/admin/hackathons/${hackathonId}/submissions`);
      const data = await response.json();
      if (response.ok) {
        setSubmissions(data.submissions || []);
      } else {
        alert('Failed to fetch submissions');
      }
    } catch (error) {
      console.error('Error fetching submissions:', error);
      alert('Failed to fetch submissions');
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleDeclareWinner = async (hackathonId: string) => {
    setDeclaringWinner(hackathonId);
    setSelectedWinner(null);
    // Fetch submissions if not already loaded
    if (viewingSubmissions !== hackathonId) {
      await handleViewSubmissions(hackathonId);
    }
  };

  const handleConfirmWinner = async () => {
    if (!declaringWinner || !selectedWinner) {
      alert('Please select a winner');
      return;
    }

    try {
      const response = await fetch(`/api/admin/hackathons/${declaringWinner}/declare-winner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winnerId: selectedWinner })
      });

      const data = await response.json();
      if (response.ok) {
        alert('Winner declared successfully!');
        setDeclaringWinner(null);
        setSelectedWinner(null);
        fetchHackathons();
        // Refresh submissions if viewing
        if (viewingSubmissions === declaringWinner) {
          handleViewSubmissions(declaringWinner);
        }
      } else {
        alert(data.error || 'Failed to declare winner');
      }
    } catch (error) {
      console.error('Error declaring winner:', error);
      alert('Failed to declare winner');
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      upcoming: "bg-blue-100 text-blue-800",
      active: "bg-green-100 text-green-800",
      completed: "bg-gray-100 text-gray-800",
      cancelled: "bg-red-100 text-red-800"
    };
    return (
      <span
        className={`px-2.5 py-1 rounded-md text-xs font-medium ${
          colors[status as keyof typeof colors] || colors.upcoming
        }`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading hackathons...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Hackathons Management</h2>
          <p className="text-gray-600 mt-1">Create and manage hackathons</p>
        </div>
        <motion.button
          whileHover={{scale: 1.05}}
          whileTap={{scale: 0.95}}
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
        >
          <Plus className="w-5 h-5" />
          Create Hackathon
        </motion.button>
      </div>

      {/* Hackathons Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Dates</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Participants</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Prize Pool</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {hackathons.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    No hackathons found. Create your first hackathon!
                  </td>
                </tr>
              ) : (
                hackathons.map((hackathon) => (
                  <tr key={hackathon._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-semibold text-gray-900">{hackathon.name}</div>
                        <div className="text-sm text-gray-500 line-clamp-1">{hackathon.description}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div>{new Date(hackathon.startDate).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-400">to {new Date(hackathon.endDate).toLocaleDateString()}</div>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(hackathon.status)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {hackathon.participantsCount || 0}
                      {hackathon.maxParticipants && ` / ${hackathon.maxParticipants}`}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-yellow-600">
                      {hackathon.prizePool ? `₹${hackathon.prizePool.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewSubmissions(hackathon._id)}
                          className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                          title="View Submissions"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {!hackathon.winnerId && (hackathon.status === 'active' || hackathon.status === 'completed') && (
                          <button
                            onClick={() => handleDeclareWinner(hackathon._id)}
                            className="p-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                            title="Declare Winner"
                          >
                            <Trophy className="w-4 h-4" />
                          </button>
                        )}
                        {hackathon.winnerId && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            Winner
                          </span>
                        )}
                        <button
                          onClick={() => handleEdit(hackathon)}
                          className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(hackathon._id)}
                          className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{opacity: 0, scale: 0.95}}
            animate={{opacity: 1, scale: 1}}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">
                {editingHackathon ? 'Edit Hackathon' : 'Create Hackathon'}
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingHackathon(null);
                }}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hackathon Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Registration Deadline <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.registrationDeadline}
                    onChange={(e) => setFormData({...formData, registrationDeadline: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Participants (Optional)
                  </label>
                  <input
                    type="number"
                    value={formData.maxParticipants}
                    onChange={(e) => setFormData({...formData, maxParticipants: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prize Points (Optional)
                  </label>
                  <input
                    type="number"
                    value={formData.prizePoints}
                    onChange={(e) => setFormData({...formData, prizePoints: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prize Currency (₹) (Optional)
                  </label>
                  <input
                    type="number"
                    value={formData.prizeCurrency}
                    onChange={(e) => setFormData({...formData, prizeCurrency: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prize Pool (₹) (Legacy - Optional)
                  </label>
                  <input
                    type="number"
                    value={formData.prizePool}
                    onChange={(e) => setFormData({...formData, prizePool: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rules (One per line)
                </label>
                <textarea
                  rows={4}
                  value={formData.rules}
                  onChange={(e) => setFormData({...formData, rules: e.target.value})}
                  placeholder="Rule 1&#10;Rule 2&#10;Rule 3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags (Comma separated)
                </label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({...formData, tags: e.target.value})}
                  placeholder="React, Node.js, Full Stack"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingHackathon(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg font-medium hover:from-yellow-600 hover:to-orange-600 transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {editingHackathon ? 'Update' : 'Create'} Hackathon
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Submissions Modal */}
      {viewingSubmissions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{opacity: 0, scale: 0.95}}
            animate={{opacity: 1, scale: 1}}
            className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">
                Hackathon Submissions
              </h3>
              <button
                onClick={() => {
                  setViewingSubmissions(null);
                  setSubmissions([]);
                }}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingSubmissions ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-gray-500">Loading submissions...</div>
                </div>
              ) : submissions.length === 0 ? (
                <div className="text-center py-12">
                  <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-900 mb-2">No submissions yet</p>
                  <p className="text-gray-500">Submissions will appear here once participants submit their projects</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {submissions.map((submission) => (
                    <div
                      key={submission._id}
                      className="bg-gray-50 rounded-xl p-6 border border-gray-200 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-lg font-bold text-gray-900">
                              {submission.submission?.projectName || 'Untitled Project'}
                            </h4>
                            {submission.isEmployee && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                Employee {submission.employeeId && `(${submission.employeeId})`}
                              </span>
                            )}
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              submission.status === 'winner' 
                                ? 'bg-yellow-100 text-yellow-800'
                                : submission.status === 'runner_up'
                                ? 'bg-gray-100 text-gray-800'
                                : submission.status === 'submitted'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {submission.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <p><span className="font-medium">Participant:</span> {submission.userName}</p>
                            <p><span className="font-medium">Email:</span> {submission.userEmail}</p>
                            {submission.profile && (
                              <p><span className="font-medium">Full Name:</span> {submission.profile.fullName}</p>
                            )}
                            {submission.submittedAt && (
                              <p><span className="font-medium">Submitted:</span> {new Date(submission.submittedAt).toLocaleString()}</p>
                            )}
                            {submission.score !== null && submission.score !== undefined && (
                              <p><span className="font-medium">Score:</span> {submission.score}</p>
                            )}
                            {submission.rank && (
                              <p><span className="font-medium">Rank:</span> #{submission.rank}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {submission.submission && (
                        <div className="mt-4 space-y-3">
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-1">Description</p>
                            <p className="text-gray-600 text-sm">{submission.submission.description}</p>
                          </div>

                          <div className="flex flex-wrap gap-3">
                            {submission.submission.githubLink && (
                              <a
                                href={submission.submission.githubLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors text-sm"
                              >
                                <Github className="w-4 h-4" />
                                GitHub
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            {submission.submission.demoLink && (
                              <a
                                href={submission.submission.demoLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm"
                              >
                                <Globe className="w-4 h-4" />
                                Demo
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            {submission.submission.videoLink && (
                              <a
                                href={submission.submission.videoLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                              >
                                <Video className="w-4 h-4" />
                                Video
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>

                          {submission.profile && submission.profile.skills && submission.profile.skills.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-2">Skills</p>
                              <div className="flex flex-wrap gap-2">
                                {submission.profile.skills.map((skill, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                                  >
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Declare Winner Modal */}
      {declaringWinner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{opacity: 0, scale: 0.95}}
            animate={{opacity: 1, scale: 1}}
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Trophy className="w-6 h-6 text-white" />
                <h3 className="text-xl font-bold text-white">
                  Declare Hackathon Winner
                </h3>
              </div>
              <button
                onClick={() => {
                  setDeclaringWinner(null);
                  setSelectedWinner(null);
                }}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingSubmissions ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-gray-500">Loading submissions...</div>
                </div>
              ) : submissions.length === 0 ? (
                <div className="text-center py-12">
                  <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-900 mb-2">No submissions yet</p>
                  <p className="text-gray-500">Submissions are required before declaring a winner</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 mb-4">
                    Select the winning submission. The hackathon will be marked as completed and the prize pool will be awarded to the winner.
                  </p>
                  {submissions.map((submission) => (
                    <div
                      key={submission._id}
                      onClick={() => setSelectedWinner(submission.userId)}
                      className={`bg-gray-50 rounded-xl p-4 border-2 cursor-pointer transition-all ${
                        selectedWinner === submission.userId
                          ? 'border-yellow-500 bg-yellow-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-lg font-bold text-gray-900">
                              {submission.submission?.projectName || 'Untitled Project'}
                            </h4>
                            {submission.isEmployee && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                Employee {submission.employeeId && `(${submission.employeeId})`}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <p><span className="font-medium">Participant:</span> {submission.userName}</p>
                            <p><span className="font-medium">Email:</span> {submission.userEmail}</p>
                            {submission.submittedAt && (
                              <p><span className="font-medium">Submitted:</span> {new Date(submission.submittedAt).toLocaleString()}</p>
                            )}
                          </div>
                          {submission.submission && (
                            <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                              {submission.submission.description}
                            </p>
                          )}
                        </div>
                        {selectedWinner === submission.userId && (
                          <CheckCircle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setDeclaringWinner(null);
                  setSelectedWinner(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmWinner}
                disabled={!selectedWinner || loadingSubmissions}
                className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg font-medium hover:from-yellow-600 hover:to-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Trophy className="w-4 h-4" />
                Declare Winner
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

