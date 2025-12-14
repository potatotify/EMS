"use client";

import {useState, useEffect, useRef, Suspense} from "react";
import Link from "next/link";
import {useSearchParams} from "next/navigation";
import {signIn, useSession} from "next-auth/react";
import {useRouter} from "next/navigation";
import {motion, AnimatePresence} from "framer-motion";
import {UserCircle, Briefcase, Trophy, ArrowLeft, AlertCircle, Check} from "lucide-react";

function SignupContent() {
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const errorParam = searchParams.get("error");

  const {data: session, status} = useSession();
  const router = useRouter();

  const [activeRole, setActiveRole] = useState<"employee" | "hackathon">(
    roleParam === "hackathon" ? "hackathon" : "employee"
  );
  const [isLoading, setIsLoading] = useState(false);

  const tabsRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({left: 0, width: 0});

  const roles = [
    {
      id: "employee",
      label: "Employee",
      icon: UserCircle,
      gradient: "from-emerald-500 to-teal-600",
      description: "Access projects, submit updates, and track progress"
    },
    {
      id: "hackathon",
      label: "Hackathon",
      icon: Trophy,
      gradient: "from-amber-500 to-orange-600",
      description: "Participate in hackathons and showcase your skills"
    }
  ];

  // Redirect if already logged in
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role) {
      const role = session.user.role;
      if (role === "admin") {
        router.push("/admin/dashboard");
      } else if (role === "employee") {
        router.push("/employee/dashboard");
      } else if (role === "client") {
        router.push("/client/dashboard");
      } else if (role === "hackathon") {
        router.push("/hackathon/dashboard");
      }
    }
  }, [status, session, router]);

  useEffect(() => {
    updateIndicator();
  }, [activeRole]);

  const updateIndicator = () => {
    if (tabsRef.current) {
      const activeButton = tabsRef.current.querySelector(
        `[data-role="${activeRole}"]`
      ) as HTMLElement;
      if (activeButton) {
        setIndicatorStyle({
          left: activeButton.offsetLeft,
          width: activeButton.offsetWidth
        });
      }
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      setIsLoading(true);

      await fetch("/api/auth/set-role", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({role: activeRole})
      });

      const callbackUrl = activeRole === "hackathon" ? "/hackathon/signup" : "/dashboard";
      await signIn("google", {
        callbackUrl
      });
    } catch (error) {
      console.error("Sign up error:", error);
      setIsLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (status === "authenticated") {
    return null;
  }

  const activeRoleData = roles.find(r => r.id === activeRole);

  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-emerald-50/30 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-200/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-200/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{opacity: 0, y: 20}}
        animate={{opacity: 1, y: 0}}
        transition={{duration: 0.5}}
        className="w-full max-w-lg relative z-10"
      >
        {/* Back Button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 mb-6 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to home</span>
        </Link>

        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-2xl border border-neutral-200/50 p-8 lg:p-10 relative overflow-hidden">
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{scale: 0}}
              animate={{scale: 1}}
              transition={{delay: 0.2, type: "spring"}}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-xl mx-auto mb-6 shadow-lg shadow-emerald-500/20"
            >
              WN
            </motion.div>
            <h1 className="text-3xl font-bold text-neutral-900 mb-2">
              Create Your Account
            </h1>
            <p className="text-neutral-600">
              Choose your role to get started
            </p>
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {errorParam === "not_registered" && (
              <motion.div
                initial={{opacity: 0, y: -10}}
                animate={{opacity: 1, y: 0}}
                exit={{opacity: 0}}
                className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-900">Account not found</p>
                  <p className="text-xs text-red-700 mt-1">Please sign up first before trying to sign in.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Role Tabs */}
          <div className="mb-8">
            <div
              className="relative bg-neutral-100 rounded-2xl p-1.5"
              ref={tabsRef}
            >
              <motion.div
                className="absolute top-1.5 bottom-1.5 bg-white rounded-xl shadow-md"
                initial={false}
                animate={indicatorStyle}
                transition={{type: "spring", stiffness: 300, damping: 30}}
              />
              <div className="relative grid grid-cols-3 gap-1">
                {roles.map((role) => {
                  const Icon = role.icon;
                  const isActive = activeRole === role.id;

                  return (
                    <button
                      key={role.id}
                      data-role={role.id}
                      onClick={() => setActiveRole(role.id as any)}
                      className={`relative z-10 flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl font-semibold text-xs transition-all duration-200 ${
                        isActive
                          ? "text-neutral-900"
                          : "text-neutral-600 hover:text-neutral-900"
                      }`}
                    >
                      <Icon className={`w-5 h-5 transition-transform ${isActive ? "scale-110" : ""}`} />
                      <span className="hidden sm:inline">{role.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Role Description */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeRole}
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: -10}}
              transition={{duration: 0.2}}
              className={`mb-8 p-4 rounded-xl bg-gradient-to-r ${activeRoleData?.gradient} bg-opacity-10 border border-current border-opacity-20`}
            >
              <p className="text-sm text-neutral-700 text-center font-medium">
                {activeRoleData?.description}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Google Sign Up Button */}
          <motion.button
            initial={{opacity: 0, y: 10}}
            animate={{opacity: 1, y: 0}}
            transition={{delay: 0.3}}
            onClick={handleGoogleSignUp}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-neutral-50 text-neutral-900 font-semibold py-3.5 px-6 rounded-xl border-2 border-neutral-200 hover:border-neutral-300 shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-700 rounded-full animate-spin" />
            ) : (
              <>
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
                <span>Continue with Google</span>
              </>
            )}
          </motion.button>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-neutral-300 to-transparent"></div>
            <span className="text-xs text-neutral-500 font-medium">or</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-neutral-300 to-transparent"></div>
          </div>

          {/* Sign In Link */}
          <p className="text-center text-sm text-neutral-600">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>

        {/* Terms */}
        <p className="text-center text-xs text-neutral-500 mt-6">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="underline hover:text-neutral-700">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-neutral-700">
            Privacy Policy
          </Link>
        </p>
      </motion.div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <SignupContent />
    </Suspense>
  );
}
