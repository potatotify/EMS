"use client";

import {useState, useEffect, Suspense} from "react";
import Link from "next/link";
import {signIn, useSession} from "next-auth/react";
import {useRouter} from "next/navigation";
import {motion} from "framer-motion";
import {Trophy, ArrowLeft, AlertCircle} from "lucide-react";

function HackathonLoginContent() {
  const {data: session, status} = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  // Check if user is already an employee
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      checkEmployeeStatus();
    }
  }, [status, session]);

  const checkEmployeeStatus = async () => {
    setIsChecking(true);
    try {
      const response = await fetch("/api/hackathon/check-employee");
      const data = await response.json();
      
      if (data.isEmployee) {
        router.push("/hackathon/dashboard");
      } else {
        if (data.hasProfile) {
          router.push("/hackathon/dashboard");
        } else {
          router.push("/hackathon/onboarding");
        }
      }
    } catch (error) {
      console.error("Error checking employee status:", error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      await signIn("google", {
        callbackUrl: "/hackathon/login"
      });
    } catch (error) {
      console.error("Sign in error:", error);
      setIsLoading(false);
    }
  };

  if (status === "loading" || isChecking) {
    return (
      <div className="min-h-screen bg-[#F2FBF5] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (status === "authenticated") {
    return null;
  }

  return (
    <main className="min-h-screen bg-linear-to-br from-slate-50 via-emerald-50/30 to-teal-50/40 text-emerald-900 antialiased flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 -z-10 opacity-30">
        <div
          className="absolute top-20 right-10 w-72 h-72 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl animate-float"
          style={{animationDelay: "0s"}}
        />
        <div
          className="absolute top-40 left-10 w-72 h-72 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl animate-float"
          style={{animationDelay: "2s"}}
        />
      </div>

      {/* Card */}
      <motion.div
        initial={{opacity: 0, y: 30, scale: 0.95}}
        animate={{opacity: 1, y: 0, scale: 1}}
        transition={{duration: 0.6}}
        className="w-full max-w-md relative z-10"
      >
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-900 mb-8 transition-all duration-200 group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to home</span>
        </Link>

        <div className="glass-effect rounded-3xl shadow-2xl border border-white/40 p-8 relative overflow-hidden">
          <div className="relative z-10">
            <div className="text-center mb-8">
              <motion.div
                initial={{scale: 0, rotate: -180}}
                animate={{scale: 1, rotate: 0}}
                transition={{delay: 0.2, type: "spring"}}
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white mx-auto mb-5 shadow-xl"
              >
                <Trophy className="w-8 h-8" />
              </motion.div>
              <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-linear-to-r from-yellow-600 to-orange-600 mb-2">
                Hackathon Login
              </h1>
              <p className="text-sm text-slate-600 font-medium">
                Sign in to participate in hackathons
              </p>
            </div>

            <motion.button
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
              transition={{delay: 0.3}}
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-800 font-semibold py-4 px-6 rounded-2xl border-2 border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              <span>{isLoading ? "Signing in..." : "Continue with Google"}</span>
            </motion.button>

            <p className="text-center text-sm text-slate-600 mt-6">
              Don't have an account?{" "}
              <Link
                href="/hackathon/signup"
                className="text-emerald-600 font-semibold hover:text-emerald-700 transition-colors"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </main>
  );
}

export default function HackathonLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F2FBF5] flex items-center justify-center">Loading...</div>}>
      <HackathonLoginContent />
    </Suspense>
  );
}

