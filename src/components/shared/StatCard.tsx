"use client";

import {LucideIcon} from "lucide-react";
import {motion} from "framer-motion";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  iconBgColor: string;
  iconColor: string;
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  iconBgColor,
  iconColor
}: StatCardProps) {
  return (
    <motion.div
      initial={{opacity: 0, y: 20}}
      animate={{opacity: 1, y: 0}}
      whileHover={{y: -6, scale: 1.02}}
      transition={{duration: 0.4, ease: [0.4, 0, 0.2, 1]}}
      className="group relative rounded-2xl overflow-hidden border border-white/80 glass-effect-premium p-6 sm:p-8 shadow-xl hover:shadow-2xl transition-all duration-500 cursor-pointer backdrop-blur-xl"
    >
      {/* Premium animated gradient background */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
        style={{
          background:
            "linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(20, 184, 166, 0.1), rgba(99, 102, 241, 0.05))"
        }}
      />

      {/* Premium shimmer effect on hover */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      {/* Subtle glow effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5" />

      <div className="relative flex items-center justify-between z-10">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-bold text-neutral-500 mb-3 tracking-wider uppercase letter-spacing-wider">
            {title}
          </p>
          <motion.p
            initial={{scale: 0.8, opacity: 0}}
            animate={{scale: 1, opacity: 1}}
            transition={{delay: 0.15, type: "spring", stiffness: 200, damping: 15}}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 leading-tight tracking-tight"
          >
            {value}
          </motion.p>
        </div>
        <motion.div
          whileHover={{rotate: [0, -10, 10, -10, 0], scale: 1.15}}
          transition={{duration: 0.6, ease: "easeInOut"}}
          className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl ${iconBgColor} flex items-center justify-center shadow-xl hover:shadow-2xl relative overflow-hidden group/icon transition-all duration-300`}
        >
          {/* Icon gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-white/20 to-transparent opacity-0 group-hover/icon:opacity-100 transition-opacity duration-300" />
          {/* Icon glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 to-teal-400/20 opacity-0 group-hover/icon:opacity-100 blur-xl transition-opacity duration-300" />
          <Icon className={`w-7 h-7 sm:w-8 sm:h-8 ${iconColor} relative z-10 drop-shadow-sm`} />
        </motion.div>
      </div>

      {/* Premium bottom accent line with gradient */}
      <motion.div
        initial={{scaleX: 0}}
        animate={{scaleX: 1}}
        transition={{delay: 0.3, duration: 0.8, ease: [0.4, 0, 0.2, 1]}}
        className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 origin-left shadow-lg shadow-emerald-500/50"
      />
      
      {/* Corner accent */}
      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-emerald-400/10 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </motion.div>
  );
}
