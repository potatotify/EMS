"use client";

import {useState, ReactNode} from "react";
import {ChevronDown} from "lucide-react";
import {motion, AnimatePresence} from "framer-motion";

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  headerColor?: string;
  icon?: ReactNode;
}

export default function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  headerColor = "from-emerald-600 to-emerald-700",
  icon
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-emerald-100 overflow-hidden mb-8">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-linear-to-r ${headerColor} px-6 py-4 flex items-center justify-between hover:opacity-90 transition-opacity`}
      >
        <div className="flex items-center gap-3">
          {icon}
          <h2 className="text-xl font-bold text-white">{title}</h2>
        </div>
        <motion.div
          animate={{rotate: isOpen ? 180 : 0}}
          transition={{duration: 0.3}}
        >
          <ChevronDown className="w-6 h-6 text-white" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{height: 0, opacity: 0}}
            animate={{height: "auto", opacity: 1}}
            exit={{height: 0, opacity: 0}}
            transition={{duration: 0.3}}
            className="overflow-hidden"
          >
            <div className="p-6">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
