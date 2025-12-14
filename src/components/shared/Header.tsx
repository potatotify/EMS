"use client";

import {signOut} from "next-auth/react";
import {LogOut, Search, Menu, X} from "lucide-react";
import {useState, useEffect} from "react";
import {motion, AnimatePresence} from "framer-motion";

interface OverviewStat {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}

interface HeaderProps {
  title: string;
  userName: string;
  rightActions?: React.ReactNode;
  overviewStats?: OverviewStat[];
}

export default function Header({title, userName, rightActions, overviewStats}: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (showDropdown) {
      const handleClickOutside = (e: MouseEvent) => {
        if (!(e.target as Element).closest('.user-menu')) {
          setShowDropdown(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  // Notifications removed as requested

  const handleSignOut = async () => {
    await signOut({callbackUrl: "/", redirect: true});
  };

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-500 ${
        isScrolled
          ? "bg-white/90 backdrop-blur-2xl shadow-lg border-b border-neutral-200/60 shadow-neutral-900/5"
          : "bg-white/95 backdrop-blur-xl border-b border-neutral-100/80"
      }`}
    >
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Left Section - Logo & Title */}
          <motion.div
            initial={{opacity: 0, x: -20}}
            animate={{opacity: 1, x: 0}}
            className="flex items-center gap-4 min-w-0 flex-1"
          >
            <div className="flex items-center gap-3 min-w-0">
              <motion.div
                whileHover={{scale: 1.08, rotate: [0, -5, 5, -5, 0]}}
                whileTap={{scale: 0.95}}
                className="h-10 w-10 lg:h-12 lg:w-12 rounded-xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 flex items-center justify-center text-white font-bold text-sm lg:text-base shadow-xl shadow-emerald-500/30 relative overflow-hidden group shrink-0 ring-2 ring-white/50"
              >
                <span className="relative z-10 drop-shadow-sm">WN</span>
                <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-white/10 to-transparent" />
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/20 transition-all duration-500" />
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/0 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </motion.div>
              <div className="min-w-0 hidden sm:block">
                <h1 className="text-base lg:text-lg font-bold text-neutral-900 truncate">
                  {title}
                </h1>
                <p className="text-xs text-neutral-600 font-medium truncate">
                  Welcome, <span className="font-semibold text-neutral-900">{userName}</span>
                </p>
              </div>
            </div>
          </motion.div>

          {/* Overview Stats - Desktop Only */}
          {overviewStats && overviewStats.length > 0 && (
            <div className="hidden xl:flex items-center gap-3 flex-1 justify-center max-w-4xl mx-8">
              {overviewStats.map((stat, index) => (
                <motion.div
                  key={index}
                  initial={{opacity: 0, y: -10}}
                  animate={{opacity: 1, y: 0}}
                  transition={{delay: index * 0.05}}
                  className={`flex items-center gap-2.5 px-4 py-2 rounded-xl bg-gradient-to-r ${stat.color} text-white shadow-md hover:shadow-lg transition-all duration-200 group`}
                >
                  <div className="group-hover:scale-110 transition-transform duration-200">
                    {stat.icon}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium opacity-90 leading-tight">{stat.label}</span>
                    <span className="text-sm font-bold leading-tight">{stat.value}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Right Section */}
          <motion.div
            initial={{opacity: 0, x: 20}}
            animate={{opacity: 1, x: 0}}
            className="flex items-center gap-3 shrink-0"
          >
            {rightActions && (
              <div className="hidden sm:flex items-center gap-2">
                {rightActions}
              </div>
            )}

            <div className="hidden lg:block h-8 w-px bg-gradient-to-b from-transparent via-neutral-300 to-transparent"></div>

            {/* User Avatar & Dropdown */}
            <div className="relative user-menu">
                <motion.button
                whileHover={{scale: 1.08}}
                whileTap={{scale: 0.95}}
                onClick={() => setShowDropdown(!showDropdown)}
                className="h-10 w-10 lg:h-11 lg:w-11 rounded-xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300 ring-2 ring-white/60 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 relative overflow-hidden group/avatar"
                aria-label="User menu"
              >
                <span className="relative z-10 drop-shadow-sm">{userName.charAt(0).toUpperCase()}</span>
                <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-white/10 to-transparent" />
                <div className="absolute inset-0 bg-white/0 group-hover/avatar:bg-white/20 transition-all duration-500" />
              </motion.button>

              {/* Dropdown Menu */}
              <AnimatePresence>
                {showDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowDropdown(false)}
                    />
                    <motion.div
                      initial={{opacity: 0, scale: 0.95, y: -10}}
                      animate={{opacity: 1, scale: 1, y: 0}}
                      exit={{opacity: 0, scale: 0.95, y: -10}}
                      transition={{duration: 0.2, ease: [0.4, 0, 0.2, 1]}}
                      className="absolute right-0 mt-2 w-56 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-neutral-200/60 overflow-hidden z-50 ring-1 ring-neutral-900/5"
                    >
                      <div className="p-4 border-b border-neutral-100">
                        <p className="text-sm font-semibold text-neutral-900 truncate">
                          {userName}
                        </p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          Active session
                        </p>
                      </div>
                      <button
                        onClick={handleSignOut}
                        className="w-full px-4 py-3 text-left text-sm text-neutral-700 hover:bg-red-50 hover:text-red-600 transition-colors flex items-center gap-3 font-medium group"
                      >
                        <LogOut className="h-4 w-4 group-hover:scale-110 transition-transform" />
                        Sign Out
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="lg:hidden p-2 rounded-lg text-neutral-600 hover:bg-neutral-100 transition-colors"
              aria-label="Menu"
            >
              {showMobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </motion.div>
        </div>

        {/* Mobile Overview Stats */}
        {overviewStats && overviewStats.length > 0 && (
          <AnimatePresence>
            {showMobileMenu && (
              <motion.div
                initial={{opacity: 0, height: 0}}
                animate={{opacity: 1, height: "auto"}}
                exit={{opacity: 0, height: 0}}
                className="xl:hidden border-t border-neutral-100 py-4"
              >
                <div className="grid grid-cols-2 gap-3">
                  {overviewStats.map((stat, index) => (
                    <motion.div
                      key={index}
                      initial={{opacity: 0, y: 10}}
                      animate={{opacity: 1, y: 0}}
                      transition={{delay: index * 0.05}}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-r ${stat.color} text-white shadow-md`}
                    >
                      {stat.icon}
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium opacity-90 leading-tight truncate">{stat.label}</span>
                        <span className="text-sm font-bold leading-tight">{stat.value}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </header>
  );
}
