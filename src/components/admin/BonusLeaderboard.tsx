'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Award } from 'lucide-react';

interface EmployeeScore {
  employeeId: string;
  employeeName: string;
  email: string;
  totalScore: number;
  updatesCount: number;
  averageScore: number;
  rank: number;
  bonusAmount?: number;
}

export default function BonusLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<EmployeeScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  useEffect(() => {
    fetchLeaderboard();
  }, [period]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/leaderboard?period=${period}`);
      const data = await response.json();
      setLeaderboard(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  };

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '🏅';
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'bg-yellow-50 border-l-4 border-yellow-400';
    if (rank === 2) return 'bg-gray-50 border-l-4 border-gray-400';
    if (rank === 3) return 'bg-orange-50 border-l-4 border-orange-400';
    return 'bg-white border-l-4 border-emerald-200';
  };

  const calculateBonus = (averageScore: number, rank: number): number => {
    // Base bonus calculation: higher scores get higher bonuses
    let bonus = 0;
    
    if (averageScore >= 90) bonus = 5000;
    else if (averageScore >= 80) bonus = 4000;
    else if (averageScore >= 70) bonus = 3000;
    else if (averageScore >= 60) bonus = 2000;
    else if (averageScore >= 50) bonus = 1000;
    
    // Rank multiplier
    if (rank === 1) bonus *= 1.5;
    else if (rank === 2) bonus *= 1.25;
    else if (rank === 3) bonus *= 1.1;
    
    return Math.round(bonus);
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-bold text-gray-900">Bonus Leaderboard</h2>
            <div className="flex gap-2">
              {(['daily', 'weekly', 'monthly'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    period === p
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="px-6 py-12 text-center text-gray-500">Loading leaderboard...</div>
          ) : leaderboard.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-500 mb-2">No approved daily updates found for this period</p>
              <p className="text-sm text-gray-400">
                Admins need to approve employee daily updates for them to appear in the leaderboard.
                Go to "Daily Updates Review" to approve submissions.
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Updates
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Average Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bonus Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leaderboard.map((employee) => {
                  const bonus = calculateBonus(employee.averageScore, employee.rank);
                  return (
                    <tr
                      key={employee.employeeId}
                      className={`${getRankColor(employee.rank)} transition-colors hover:bg-opacity-75`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{getMedalEmoji(employee.rank)}</span>
                          <span className="text-lg font-bold text-gray-900">#{employee.rank}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{employee.employeeName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{employee.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="inline-flex items-center px-2 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                          {employee.updatesCount}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                employee.averageScore >= 90 ? 'bg-green-600' :
                                employee.averageScore >= 80 ? 'bg-emerald-600' :
                                employee.averageScore >= 70 ? 'bg-yellow-600' :
                                'bg-orange-600'
                              }`}
                              style={{ width: `${employee.averageScore}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-gray-900 w-12">
                            {employee.averageScore.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800">
                          {employee.totalScore}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Award className="w-5 h-5 text-yellow-600" />
                          <span className="text-sm font-bold text-gray-900">
                            ₹{bonus.toLocaleString()}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
