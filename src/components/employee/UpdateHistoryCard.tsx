'use client';

import { Calendar, Clock } from 'lucide-react';

interface DailyUpdate {
  _id: string;
  date: string;
  progress: number;
  hoursWorked: number;
  tasksCompleted: string[];
  challenges: string;
  nextSteps: string;
}

interface UpdateHistoryCardProps {
  update: DailyUpdate;
}

export default function UpdateHistoryCard({ update }: UpdateHistoryCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:border-emerald-300 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="w-4 h-4" />
          {new Date(update.date).toLocaleDateString('en-IN', { 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric' 
          })}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            {update.hoursWorked}h
          </div>
          <div className="text-sm font-semibold text-emerald-700">
            {update.progress}%
          </div>
        </div>
      </div>

      {update.tasksCompleted.length > 0 && (
        <div className="mb-3">
          <p className="text-sm font-medium text-gray-700 mb-2">Tasks Completed:</p>
          <ul className="space-y-1">
            {update.tasksCompleted.map((task, idx) => (
              <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-emerald-600 mt-1">•</span>
                <span>{task}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {update.challenges && (
        <div className="mb-3">
          <p className="text-sm font-medium text-gray-700 mb-1">Challenges:</p>
          <p className="text-sm text-gray-600">{update.challenges}</p>
        </div>
      )}

      {update.nextSteps && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Next Steps:</p>
          <p className="text-sm text-gray-600">{update.nextSteps}</p>
        </div>
      )}
    </div>
  );
}
