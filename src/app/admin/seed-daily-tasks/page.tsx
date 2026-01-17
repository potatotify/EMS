"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Database, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import Header from "@/components/shared/Header";
import LoadingSpinner from "@/components/shared/LoadingSpinner";

export default function SeedDailyTasksPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSeed = async () => {
    if (!confirm("This will create daily tasks and subtasks for all projects. Continue?")) {
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/admin/seed-daily-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || "Failed to seed daily tasks");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") {
    return <LoadingSpinner />;
  }

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  if (session?.user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Seed Daily Tasks" userName={session?.user?.name || ""} />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-800 mb-2">Access Denied</h2>
            <p className="text-red-600">You must be an admin to access this page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Seed Daily Tasks" userName={session?.user?.name || ""} />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-6">
            <Database className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Seed Daily Tasks</h1>
          </div>

          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h2 className="font-semibold text-blue-900 mb-2">What this does:</h2>
            <ul className="list-disc list-inside space-y-1 text-blue-800 text-sm">
              <li>Creates a "Daily tasks" section in every project</li>
              <li>Adds 9 daily recurring tasks assigned to lead assignees</li>
              <li>Creates subtasks for each task assigned to all employees in the project</li>
              <li>Sets bonus points: 5, penalty points: 100</li>
              <li>Sets deadline time: 10:00 AM</li>
              <li>Skips projects without lead assignees</li>
              <li>Prevents duplicate tasks/subtasks</li>
            </ul>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Tasks that will be created:</h3>
            <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm">
              <li>Make the daily tasks for this project before</li>
              <li>Meeting for this project</li>
              <li>Time table made for this project for the next day</li>
              <li>Loom recording for this project</li>
              <li>Tasks mentioned on WhatsApp or in zoom meeting added to EMS</li>
              <li>Responded to the client on WhatsApp on the same day if any message was sent</li>
              <li>Client meeting attended at the exact time</li>
              <li>Attended more than 3 hours</li>
              <li>Uploaded Project to Github</li>
            </ol>
          </div>

          <button
            onClick={handleSeed}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Seeding Database...
              </>
            ) : (
              <>
                <Database className="w-5 h-5" />
                Seed Daily Tasks
              </>
            )}
          </button>

          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="w-5 h-5" />
                <span className="font-semibold">Error:</span>
              </div>
              <p className="text-red-700 mt-2">{error}</p>
            </div>
          )}

          {result && (
            <div className="mt-6 space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800 mb-2">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-semibold">Seeding Completed!</span>
                </div>
                <p className="text-green-700">{result.message}</p>
                {result.summary && (
                  <div className="mt-3 text-sm text-green-700">
                    <p>• Projects processed: {result.summary.totalProjects}</p>
                    <p>• Tasks created: {result.summary.totalTasksCreated}</p>
                    <p>• Subtasks created: {result.summary.totalSubtasksCreated}</p>
                  </div>
                )}
              </div>

              {result.results && result.results.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Project Details:</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {result.results.map((project: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border ${
                          project.status === "success"
                            ? "bg-green-50 border-green-200"
                            : project.status === "skipped"
                            ? "bg-yellow-50 border-yellow-200"
                            : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">{project.projectName}</p>
                            {project.status === "success" && (
                              <p className="text-sm text-gray-600">
                                {project.tasksCreated} tasks, {project.subtasksCreated} subtasks
                              </p>
                            )}
                            {project.status === "skipped" && (
                              <p className="text-sm text-yellow-700">{project.reason}</p>
                            )}
                          </div>
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              project.status === "success"
                                ? "bg-green-200 text-green-800"
                                : project.status === "skipped"
                                ? "bg-yellow-200 text-yellow-800"
                                : "bg-gray-200 text-gray-800"
                            }`}
                          >
                            {project.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
