"use client";

import {signOut} from "next-auth/react";
import {LogOut, Bell, Search} from "lucide-react";
import {useState, useEffect} from "react";
import {motion, AnimatePresence} from "framer-motion";

interface HeaderProps {
  title: string;
  userName: string;
  rightActions?: React.ReactNode;
}

export default function Header({title, userName, rightActions}: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSignOut = async () => {
    await signOut({callbackUrl: "/", redirect: true});
  };

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "glass-effect shadow-lg border-b border-white/20"
          : "bg-white/70 backdrop-blur-lg border-b border-emerald-100/50"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left Section */}
          <motion.div
            initial={{opacity: 0, x: -20}}
            animate={{opacity: 1, x: 0}}
            className="flex items-center gap-4"
          >
            <div className="flex items-center gap-3">
              <motion.div
                whileHover={{scale: 1.05, rotate: 5}}
                whileTap={{scale: 0.95}}
                className="h-11 w-11 rounded-xl gradient-emerald flex items-center justify-center text-white font-bold text-sm shadow-lg relative overflow-hidden group"
              >
                <span className="relative z-10">WN</span>
                <div className="absolute inset-0 bg-linear-to-br from-white/20 to-transparent" />
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300" />
              </motion.div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-transparent bg-clip-text bg-linear-to-r from-emerald-700 to-teal-600">
                  {title}
                </h1>
                <p className="text-xs text-slate-600 font-medium">
                  Welcome, <span className="font-semibold">{userName}</span>
                </p>
              </div>
            </div>
          </motion.div>

          {/* Right Section */}
          <motion.div
            initial={{opacity: 0, x: 20}}
            animate={{opacity: 1, x: 0}}
            className="flex items-center gap-3"
          >
            {rightActions && (
              <div className="hidden sm:flex items-center gap-2">
                {rightActions}
              </div>
            )}

            <div className="h-8 w-px bg-gradient-to-b from-transparent via-gray-300 to-transparent"></div>

            {/* User Avatar */}
            <div className="relative">
              <motion.button
                whileHover={{scale: 1.05}}
                whileTap={{scale: 0.95}}
                onClick={() => setShowDropdown(!showDropdown)}
                className="h-10 w-10 rounded-full gradient-emerald flex items-center justify-center text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200 ring-2 ring-white/50"
              >
                {userName.charAt(0).toUpperCase()}
              </motion.button>

              {/* Dropdown Menu */}
              <AnimatePresence>
                {showDropdown && (
                  <motion.div
                    initial={{opacity: 0, scale: 0.95, y: -10}}
                    animate={{opacity: 1, scale: 1, y: 0}}
                    exit={{opacity: 0, scale: 0.95, y: -10}}
                    transition={{duration: 0.2}}
                    className="absolute right-0 mt-2 w-48 glass-effect rounded-2xl shadow-xl border border-white/40 overflow-hidden"
                  >
                    <div className="p-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900">
                        {userName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        Logged in
                      </p>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-red-50 transition-colors flex items-center gap-2 font-medium"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Sign Out Button (Desktop) */}
            <motion.button
              whileHover={{scale: 1.05}}
              whileTap={{scale: 0.95}}
              onClick={handleSignOut}
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-gray-700 hover:text-white bg-gray-100/50 hover:bg-linear-to-r hover:from-red-500 hover:to-rose-500 transition-all duration-300 shadow-sm hover:shadow-md"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </motion.button>
          </motion.div>
        </div>
      </div>
    </header>
  );
}
