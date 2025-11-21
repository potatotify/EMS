"use client";

import {useState, useEffect} from "react";
import {useSession} from "next-auth/react";
import {useRouter, useParams} from "next/navigation";
import {motion} from "framer-motion";
import {
  Trophy,
  Calendar,
  Users,
  Award,
  Clock,
  CheckCircle,
  Github,
  Video,
  Globe,
  Save,
  ArrowLeft
} from "lucide-react";
import Header from "@/components/shared/Header";

interface Hackathon {
  _id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  maxParticipants?: number;
  prizePool?: number;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  rules: string[];
  tags: string[];
  participantsCount?: number;
  isRegistered?: boolean;
  participantStatus?: 'registered' | 'submitted' | 'disqualified' | 'winner' | 'runner_up';
  submission?: {
    projectName: string;
    description: string;
    githubLink?: string;
    demoLink?: string;
    videoLink?: string;
    submittedAt: string;
  };
}

export default function HackathonDetailPage() {
  const {data: session} = useSession();
  const router = useRouter();
  const params = useParams();
  const hackathonId = params?.hackathonId as string;

  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [submissionData, setSubmissionData] = useState({
    projectName: '',
    description: '',
    githubLink: '',
    demoLink: '',
    videoLink: ''
  });

  useEffect(() => {
    if (hackathonId) {
      fetchHackathon();
    }
  }, [hackathonId]);

  const fetchHackathon = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/hackathons/${hackathonId}`);
      const data = await response.json();
      if (response.ok) {
        setHackathon(data.hackathon);
        if (data.hackathon.submission) {
          setSubmissionData({
            projectName: data.hackathon.submission.projectName || '',
            description: data.hackathon.submission.description || '',
            githubLink: data.hackathon.submission.githubLink || '',
            demoLink: data.hackathon.submission.demoLink || '',
            videoLink: data.hackathon.submission.videoLink || ''
          });
        }
      }
    } catch (error) {
      console.error("Error fetching hackathon:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    try {
      const response = await fetch("/api/hackathons/register", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({hackathonId})
      });

      if (response.ok) {
        alert("Successfully registered for hackathon!");
        fetchHackathon();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to register");
      }
    } catch (error) {
      console.error("Error registering:", error);
      alert("Failed to register for hackathon");
    }
  };

  const handleSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/hackathons/${hackathonId}/submit`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(submissionData)
      });

      if (response.ok) {
        alert("Project submitted successfully!");
        setShowSubmissionForm(false);
        fetchHackathon();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to submit project");
      }
    } catch (error) {
      console.error("Error submitting project:", error);
      alert("Failed to submit project");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F2FBF5] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!hackathon) {
    return (
      <div className="min-h-screen bg-[#F2FBF5] flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-900 mb-2">Hackathon not found</p>
          <button
            onClick={() => router.push('/hackathon/dashboard')}
            className="text-emerald-600 hover:text-emerald-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const canRegister = new Date(hackathon.registrationDeadline) > new Date() && 
                      hackathon.status !== 'completed' && 
                      hackathon.status !== 'cancelled' &&
                      !hackathon.isRegistered;

  const canSubmit = hackathon.isRegistered && 
                    hackathon.status === 'active' && 
                    hackathon.participantStatus === 'registered';

  return (
    <div className="min-h-screen bg-[#F2FBF5]">
      <Header title="Hackathon Details" userName={session?.user?.name || ""} />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => router.push('/hackathon/dashboard')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        {/* Hackathon Header */}
        <motion.div
          initial={{opacity: 0, y: 20}}
          animate={{opacity: 1, y: 0}}
          className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl p-8 text-white shadow-lg mb-6"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-2">{hackathon.name}</h1>
              <p className="text-yellow-100 text-lg">{hackathon.description}</p>
            </div>
            <div className="w-16 h-16 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
              <Trophy className="w-8 h-8" />
            </div>
          </div>
        </motion.div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="text-xs text-gray-500">Start Date</p>
                <p className="font-semibold text-gray-900">
                  {new Date(hackathon.startDate).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-xs text-gray-500">Participants</p>
                <p className="font-semibold text-gray-900">
                  {hackathon.participantsCount || 0}
                  {hackathon.maxParticipants && ` / ${hackathon.maxParticipants}`}
                </p>
              </div>
            </div>
          </div>
          {hackathon.prizePool && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center gap-3">
                <Award className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="text-xs text-gray-500">Prize Pool</p>
                  <p className="font-semibold text-yellow-600">
                    ₹{hackathon.prizePool.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Registration/Submission Section */}
        {hackathon.isRegistered ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">You're Registered!</h3>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-lg text-sm font-medium">
                {hackathon.participantStatus?.replace('_', ' ').toUpperCase() || 'REGISTERED'}
              </span>
            </div>

            {hackathon.submission ? (
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Your Submission</h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div>
                      <p className="text-sm text-gray-600">Project Name</p>
                      <p className="font-medium text-gray-900">{hackathon.submission.projectName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Description</p>
                      <p className="text-gray-900">{hackathon.submission.description}</p>
                    </div>
                    {hackathon.submission.githubLink && (
                      <a
                        href={hackathon.submission.githubLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700"
                      >
                        <Github className="w-4 h-4" />
                        GitHub Repository
                      </a>
                    )}
                    {hackathon.submission.demoLink && (
                      <a
                        href={hackathon.submission.demoLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700"
                      >
                        <Globe className="w-4 h-4" />
                        Demo Link
                      </a>
                    )}
                    {hackathon.submission.videoLink && (
                      <a
                        href={hackathon.submission.videoLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700"
                      >
                        <Video className="w-4 h-4" />
                        Video Link
                      </a>
                    )}
                    <p className="text-xs text-gray-500">
                      Submitted on {new Date(hackathon.submission.submittedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ) : canSubmit ? (
              <div>
                {showSubmissionForm ? (
                  <form onSubmit={handleSubmitProject} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Project Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={submissionData.projectName}
                        onChange={(e) => setSubmissionData({...submissionData, projectName: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        required
                        rows={4}
                        value={submissionData.description}
                        onChange={(e) => setSubmissionData({...submissionData, description: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          GitHub Link
                        </label>
                        <input
                          type="url"
                          value={submissionData.githubLink}
                          onChange={(e) => setSubmissionData({...submissionData, githubLink: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Demo Link
                        </label>
                        <input
                          type="url"
                          value={submissionData.demoLink}
                          onChange={(e) => setSubmissionData({...submissionData, demoLink: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Video Link
                        </label>
                        <input
                          type="url"
                          value={submissionData.videoLink}
                          onChange={(e) => setSubmissionData({...submissionData, videoLink: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        className="px-6 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg font-semibold hover:from-yellow-600 hover:to-orange-600 transition-colors flex items-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        Submit Project
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSubmissionForm(false)}
                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setShowSubmissionForm(true)}
                    className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg font-semibold hover:from-yellow-600 hover:to-orange-600 transition-colors"
                  >
                    Submit Your Project
                  </button>
                )}
              </div>
            ) : (
              <p className="text-gray-600">
                {hackathon.status === 'upcoming' 
                  ? 'Hackathon hasn\'t started yet. Check back when it begins!'
                  : 'Submissions are closed for this hackathon.'}
              </p>
            )}
          </div>
        ) : canRegister ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6 text-center">
            <p className="text-gray-700 mb-4">Ready to participate in this hackathon?</p>
            <button
              onClick={handleRegister}
              className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg font-semibold hover:from-yellow-600 hover:to-orange-600 transition-colors"
            >
              Register Now
            </button>
          </div>
        ) : null}

        {/* Rules */}
        {hackathon.rules && hackathon.rules.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rules</h3>
            <ul className="space-y-2">
              {hackathon.rules.map((rule, idx) => (
                <li key={idx} className="flex items-start gap-2 text-gray-700">
                  <span className="text-emerald-600 mt-1">•</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tags */}
        {hackathon.tags && hackathon.tags.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {hackathon.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

