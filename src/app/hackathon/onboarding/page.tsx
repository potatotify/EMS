'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { UserCircle, Phone, MapPin, Briefcase, Calendar, Save, Github, Globe } from 'lucide-react';

export default function HackathonOnboarding() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    fullName: session?.user?.name || '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    dateOfBirth: '',
    skills: '',
    githubProfile: '',
    portfolioLink: '',
  });
  
  const [loading, setLoading] = useState(false);
  const [isEmployee, setIsEmployee] = useState(false);
  const [employeeId, setEmployeeId] = useState('');

  useEffect(() => {
    checkEmployeeStatus();
  }, []);

  const checkEmployeeStatus = async () => {
    try {
      const response = await fetch('/api/hackathon/check-employee');
      const data = await response.json();
      
      if (data.isEmployee) {
        setIsEmployee(true);
        setEmployeeId(data.employeeId);
        // Pre-fill form with employee data if available
        const empResponse = await fetch('/api/employee/profile');
        if (empResponse.ok) {
          const empData = await empResponse.json();
          if (empData.profile) {
            setFormData(prev => ({
              ...prev,
              fullName: empData.profile.fullName || prev.fullName,
              phone: empData.profile.phone || prev.phone,
              address: empData.profile.address || prev.address,
              city: empData.profile.city || prev.city,
              state: empData.profile.state || prev.state,
              pincode: empData.profile.pincode || prev.pincode,
              dateOfBirth: empData.profile.dateOfBirth ? new Date(empData.profile.dateOfBirth).toISOString().split('T')[0] : prev.dateOfBirth,
              skills: Array.isArray(empData.profile.skills) ? empData.profile.skills.join(', ') : (empData.profile.skills || prev.skills),
            }));
          }
        }
      }
    } catch (error) {
      console.error('Error checking employee status:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/hackathon/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          isEmployee,
          employeeId: isEmployee ? employeeId : undefined
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await fetch('/api/auth/session?update=1');
        await update();
        await new Promise(resolve => setTimeout(resolve, 500));
        
        router.push('/hackathon/dashboard');
        router.refresh();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error completing profile:', error);
      alert('Failed to complete profile');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#F2FBF5] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/hackathon/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F2FBF5] py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl border border-emerald-100 overflow-hidden">
          {/* Header */}
          <div className="bg-linear-to-r from-yellow-500 to-orange-500 px-8 py-6">
            <h1 className="text-3xl font-bold text-white mb-2">Complete Your Hackathon Profile</h1>
            <p className="text-yellow-100">
              {isEmployee 
                ? `Welcome back, Employee! Complete your profile to participate in hackathons.`
                : 'Help us get to know you better to participate in hackathons'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            {/* Personal Information */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <UserCircle className="w-5 h-5 text-yellow-600" />
                Personal Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-yellow-600" />
                Address
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Street Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pincode <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.pincode}
                      onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Skills & Links */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-yellow-600" />
                Skills & Portfolio
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Skills <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.skills}
                    onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    placeholder="e.g., React, Node.js, MongoDB, Python"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Add your main skills, separated by commas
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Github className="w-4 h-4" />
                      GitHub Profile (Optional)
                    </label>
                    <input
                      type="url"
                      value={formData.githubProfile}
                      onChange={(e) => setFormData({ ...formData, githubProfile: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                      placeholder="https://github.com/username"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      Portfolio Link (Optional)
                    </label>
                    <input
                      type="url"
                      value={formData.portfolioLink}
                      onChange={(e) => setFormData({ ...formData, portfolioLink: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                      placeholder="https://yourportfolio.com"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-6 border-t">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {loading ? 'Saving...' : 'Complete Profile'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

