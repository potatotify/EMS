"use client";

import {useState, useEffect} from "react";
import {useSession} from "next-auth/react";
import {useRouter} from "next/navigation";
import {motion} from "framer-motion";
import {
  Trophy,
  Calendar,
  Users,
  Award,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  ExternalLink,
  Github,
  Video,
  Globe
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
  tags: string[];
  participantsCount?: number;
  isRegistered?: boolean;
  participantStatus?: 'registered' | 'submitted' | 'disqualified' | 'winner' | 'runner_up';
}

export default function HackathonDashboard() {
  const {data: session, status} = useSession();
  const router = useRouter();
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEmployee, setIsEmployee] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'registered' | 'upcoming' | 'active' | 'completed'>('all');

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/hackathon/login");
      return;
    }
    if (status === "authenticated") {
      checkEmployeeStatus();
      fetchHackathons();
    }
  }, [status, router]);

  const checkEmployeeStatus = async () => {
    try {
      const response = await fetch("/api/hackathon/check-employee");
      const data = await response.json();
      setIsEmployee(data.isEmployee);
    } catch (error) {
      console.error("Error checking employee status:", error);
    }
  };

  const fetchHackathons = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/hackathons");
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

  const handleRegister = async (hackathonId: string) => {
    try {
      const response = await fetch("/api/hackathons/register", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({hackathonId})
      });

      if (response.ok) {
        alert("Successfully registered for hackathon!");
        fetchHackathons();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to register");
      }
    } catch (error) {
      console.error("Error registering:", error);
      alert("Failed to register for hackathon");
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

  const filteredHackathons = hackathons.filter((h) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'registered') return h.isRegistered;
    return h.status === activeTab;
  });

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-[#F2FBF5] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2FBF5]">
      <Header title="Hackathon Dashboard" userName={session?.user?.name || ""} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <motion.div
          initial={{opacity: 0, y: 20}}
          animate={{opacity: 1, y: 0}}
          className="mb-8"
        >
          <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Trophy className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-1">
                  {isEmployee ? "Welcome back, Employee!" : "Hackathon Dashboard"}
                </h1>
                <p className="text-yellow-100">
                  {isEmployee 
                    ? "Participate in hackathons and showcase your skills!"
                    : "Discover and participate in exciting hackathons"}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {[
            {id: 'all', label: 'All Hackathons'},
            {id: 'registered', label: 'My Registrations'},
            {id: 'upcoming', label: 'Upcoming'},
            {id: 'active', label: 'Active'},
            {id: 'completed', label: 'Completed'}
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Hackathons Grid */}
        {filteredHackathons.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">No hackathons found</p>
            <p className="text-gray-500">Check back later for new hackathons</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredHackathons.map((hackathon) => (
              <motion.div
                key={hackathon._id}
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {hackathon.name}
                      </h3>
                      {getStatusBadge(hackathon.status)}
                    </div>
                    {hackathon.isRegistered && (
                      <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
                    )}
                  </div>

                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                    {hackathon.description}
                  </p>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {new Date(hackathon.startDate).toLocaleDateString()} - {new Date(hackathon.endDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="w-4 h-4" />
                      <span>
                        {hackathon.participantsCount || 0} participants
                        {hackathon.maxParticipants && ` / ${hackathon.maxParticipants} max`}
                      </span>
                    </div>
                    {hackathon.prizePool && (
                      <div className="flex items-center gap-2 text-sm text-yellow-600 font-semibold">
                        <Award className="w-4 h-4" />
                        <span>Prize Pool: ₹{hackathon.prizePool.toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {hackathon.tags && hackathon.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {hackathon.tags.slice(0, 3).map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {hackathon.isRegistered ? (
                      <button
                        onClick={() => router.push(`/hackathon/${hackathon._id}`)}
                        className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        View Details
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    ) : (
                      <>
                        {new Date(hackathon.registrationDeadline) > new Date() && hackathon.status !== 'completed' && (
                          <button
                            onClick={() => handleRegister(hackathon._id)}
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white rounded-lg font-medium transition-colors"
                          >
                            Register Now
                          </button>
                        )}
                        <button
                          onClick={() => router.push(`/hackathon/${hackathon._id}`)}
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                        >
                          View
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

