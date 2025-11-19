import {motion} from "framer-motion";

export default function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-emerald-50/30 to-teal-50/40 flex items-center justify-center relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute inset-0 -z-10 opacity-30">
        <div
          className="absolute top-1/4 left-1/4 w-72 h-72 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl animate-float"
          style={{animationDelay: "0s"}}
        />
        <div
          className="absolute top-1/3 right-1/4 w-72 h-72 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl animate-float"
          style={{animationDelay: "2s"}}
        />
        <div
          className="absolute bottom-1/4 left-1/2 w-72 h-72 bg-cyan-200 rounded-full mix-blend-multiply filter blur-3xl animate-float"
          style={{animationDelay: "4s"}}
        />
      </div>

      <div className="relative">
        {/* Logo with pulse animation */}
        <motion.div
          initial={{scale: 0, opacity: 0}}
          animate={{scale: 1, opacity: 1}}
          transition={{duration: 0.5}}
          className="w-20 h-20 rounded-2xl gradient-emerald flex items-center justify-center text-white font-bold text-2xl mx-auto mb-6 shadow-2xl relative overflow-hidden"
        >
          <motion.div
            animate={{scale: [1, 1.2, 1]}}
            transition={{duration: 2, repeat: Infinity, ease: "easeInOut"}}
            className="absolute inset-0 bg-white/20 rounded-2xl"
          />
          <span className="relative z-10">WN</span>
        </motion.div>

        {/* Spinning loader */}
        <div className="relative w-16 h-16 mx-auto">
          <motion.div
            animate={{rotate: 360}}
            transition={{duration: 1, repeat: Infinity, ease: "linear"}}
            className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full"
          />
          <motion.div
            animate={{rotate: -360}}
            transition={{duration: 1.5, repeat: Infinity, ease: "linear"}}
            className="absolute inset-0 w-16 h-16 border-4 border-transparent border-b-teal-500 rounded-full"
          />
        </div>

        {/* Loading text */}
        <motion.p
          initial={{opacity: 0, y: 10}}
          animate={{opacity: 1, y: 0}}
          transition={{delay: 0.3}}
          className="text-center mt-6 text-sm font-semibold text-slate-600"
        >
          <motion.span
            animate={{opacity: [1, 0.5, 1]}}
            transition={{duration: 1.5, repeat: Infinity}}
          >
            Loading...
          </motion.span>
        </motion.p>
      </div>
    </div>
  );
}
