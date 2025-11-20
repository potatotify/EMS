"use client";

import {useSession} from "next-auth/react";
import {useRouter} from "next/navigation";
import {useEffect, useState} from "react";
import {Mail} from "lucide-react";

import Header from "@/components/shared/Header";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmployeeMessagesPanel from "@/components/employee/EmployeeMessagesPanel";

export default function EmployeeMessagesPage() {
  const {data: session, status} = useSession();
  const router = useRouter();
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (status === "authenticated") {
      const profileCompleted = (session?.user as any)?.profileCompleted;
      if (!profileCompleted) {
        router.push("/employee/onboarding");
      } else {
        fetchUnreadMessages();
      }
    }
  }, [status, session, router]);

  const fetchUnreadMessages = async () => {
    try {
      const res = await fetch("/api/employee/messages/unread-count");
      const data = await res.json();
      if (res.ok) {
        setUnreadMessages(data.unread || 0);
      }
    } catch (err) {
      console.error("Error fetching unread message count", err);
    }
  };

  if (status === "loading") {
    return <LoadingSpinner />;
  }

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  const isApproved = (session?.user as any)?.isApproved;
  if (!isApproved) {
    router.push("/employee/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F2FBF5]">
      <Header
        title="Messages"
        userName={session?.user?.name || ""}
        rightActions={
          <button
            type="button"
            onClick={() => router.push("/employee/dashboard")}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 border border-emerald-100"
          >
            <span>Back to Dashboard</span>
          </button>
        }
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {unreadMessages > 0 && (
          <div className="mb-4 flex items-center justify-end">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {unreadMessages} new
            </span>
          </div>
        )}

        <EmployeeMessagesPanel />
      </main>
    </div>
  );
}
