"use client";

import {useState, useEffect, Suspense} from "react";
import Link from "next/link";
import {signIn, useSession} from "next-auth/react";
import {useRouter} from "next/navigation";
import {motion} from "framer-motion";
import {Trophy, ArrowLeft, AlertCircle, CheckCircle} from "lucide-react";

function HackathonSignupContent() {
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
        // User is an employee, redirect to hackathon dashboard
        router.push("/hackathon/dashboard");
      } else {
        // User is not an employee, check if they have hackathon profile
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

  const handleGoogleSignUp = async () => {
    try {
      setIsLoading(true);

      // Store hackathon role in cookie before OAuth redirect
      await fetch("/api/auth/set-role", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({role: "hackathon"})
      });

      // Now proceed with Google OAuth
      await signIn("google", {
        callbackUrl: "/hackathon/signup"
      });
    } catch (error) {
      console.error("Sign up error:", error);
      setIsLoading(false);
    }
  };

  // Show loading while checking session
  if (status === "loading" || isChecking) {
    return (
      <div className="min-h-screen bg-[#F2FBF5] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Don't render signup form if already authenticated and checked
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
        <div
          className="absolute -bottom-20 right-1/3 w-72 h-72 bg-cyan-200 rounded-full mix-blend-multiply filter blur-3xl animate-float"
          style={{animationDelay: "4s"}}
        />
      </div>

      {/* Gradient Overlay */}
      <div className="fixed inset-0 -z-20 bg-[radial-gradient(ellipse_at_top_left,var(--tw-gradient-stops))] from-teal-100/20 via-transparent to-emerald-100/20" />

      {/* Card */}
      <motion.div
        initial={{opacity: 0, y: 30, scale: 0.95}}
        animate={{opacity: 1, y: 0, scale: 1}}
        transition={{duration: 0.6, ease: [0.4, 0, 0.2, 1]}}
        className="w-full max-w-md relative z-10"
      >
        {/* Back button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-900 mb-8 transition-all duration-200 group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to home</span>
        </Link>

        <div className="glass-effect rounded-3xl shadow-2xl border border-white/40 p-8 relative overflow-hidden">
          {/* Decorative gradient blur */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-linear-to-br from-teal-400/20 to-emerald-400/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-linear-to-br from-emerald-400/20 to-cyan-400/20 rounded-full blur-3xl" />

          <div className="relative z-10">
            {/* Header */}
            <div className="text-center mb-8">
              <motion.div
                initial={{scale: 0, rotate: -180}}
                animate={{scale: 1, rotate: 0}}
                transition={{delay: 0.2, type: "spring", stiffness: 200}}
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold text-xl mx-auto mb-5 shadow-xl relative"
              >
                <Trophy className="w-8 h-8" />
              </motion.div>
              <motion.h1
                initial={{opacity: 0, y: 10}}
                animate={{opacity: 1, y: 0}}
                transition={{delay: 0.3}}
                className="text-3xl font-bold text-transparent bg-clip-text bg-linear-to-r from-yellow-600 to-orange-600 mb-2"
              >
                Join Hackathons
              </motion.h1>
              <motion.p
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                transition={{delay: 0.4}}
                className="text-sm text-slate-600 font-medium"
              >
                Showcase your skills and win amazing prizes
              </motion.p>
            </div>

            {/* Info Box */}
            <motion.div
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
              transition={{delay: 0.5}}
              className="mb-6 p-4 rounded-2xl bg-linear-to-r from-yellow-50/80 to-orange-50/80 border border-yellow-200/50 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-linear-to-br from-yellow-100/10 to-transparent" />
              <div className="relative z-10 space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-900/80 font-medium">
                    Existing employees can participate directly
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-900/80 font-medium">
                    New participants need to complete profile
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Google Sign Up Button */}
            <motion.button
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
              transition={{delay: 0.6}}
              onClick={handleGoogleSignUp}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-800 font-semibold py-4 px-6 rounded-2xl border-2 border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 relative z-10" viewBox="0 0 24 24">
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
              <span className="relative z-10">
                {isLoading ? "Signing up..." : "Continue with Google"}
              </span>
            </motion.button>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-linear-to-r from-transparent via-emerald-300 to-transparent"></div>
              <span className="text-xs text-slate-500 font-medium">or</span>
              <div className="flex-1 h-px bg-linear-to-r from-transparent via-emerald-300 to-transparent"></div>
            </div>

            {/* Already have account */}
            <motion.p
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              transition={{delay: 0.7}}
              className="text-center text-sm text-slate-600"
            >
              Already have an account?{" "}
              <Link
                href="/hackathon/login"
                className="text-emerald-600 font-semibold hover:text-emerald-700 transition-colors relative group"
              >
                Sign in
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-emerald-600 transition-all group-hover:w-full" />
              </Link>
            </motion.p>
          </div>
        </div>

        {/* Terms */}
        <motion.p
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          transition={{delay: 0.9}}
          className="text-center text-xs text-slate-500 mt-6"
        >
          By continuing, you agree to our{" "}
          <Link
            href="/terms"
            className="underline hover:text-emerald-700 transition-colors"
          >
            Terms
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="underline hover:text-emerald-700 transition-colors"
          >
            Privacy Policy
          </Link>
        </motion.p>
      </motion.div>
    </main>
  );
}

export default function HackathonSignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F2FBF5] flex items-center justify-center">
          Loading...
        </div>
      }
    >
      <HackathonSignupContent />
    </Suspense>
  );
}

