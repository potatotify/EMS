"use client";

// This component wraps the AllTasksPage content to be used in the dashboard
// It imports and renders the page component in embedded mode (without header)

import dynamic from 'next/dynamic';

// Dynamically import the AllTasksPage component
const AllTasksPage = dynamic(() => import('@/app/employee/all-tasks/page'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )
});

export default function AllTasks() {
  return (
    <div className="w-full">
      <AllTasksPage embedded={true} />
    </div>
  );
}
