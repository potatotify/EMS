"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  CheckCircle,
  MessageSquare,
  FolderKanban,
  TrendingUp,
  AlertCircle,
  Clock,
  X,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  count: number;
  link: string;
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
}

interface NotificationsPanelProps {
  onClose?: () => void;
}

export default function NotificationsPanel({ onClose }: NotificationsPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchNotifications();
    // Refresh every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    
    // Listen for manual refresh events
    const handleRefresh = () => {
      fetchNotifications();
    };
    window.addEventListener('refreshNotifications', handleRefresh);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('refreshNotifications', handleRefresh);
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await fetch("/api/notifications");
      const data = await response.json();
      if (response.ok) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = (link: string) => {
    router.push(link);
    if (onClose) onClose();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'approval':
        return <CheckCircle className="w-5 h-5" />;
      case 'message':
        return <MessageSquare className="w-5 h-5" />;
      case 'project':
        return <FolderKanban className="w-5 h-5" />;
      case 'update':
        return <TrendingUp className="w-5 h-5" />;
      case 'task':
        return <AlertCircle className="w-5 h-5" />;
      case 'reminder':
        return <Clock className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'medium':
        return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'low':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      default:
        return 'bg-neutral-100 text-neutral-700 border-neutral-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="flex items-center justify-between p-4 border-b border-neutral-200">
        <h3 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notifications
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
              {unreadCount}
            </span>
          )}
        </h3>
        {onClose && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onClose();
            }}
            className="p-1 rounded-lg hover:bg-neutral-100 transition-colors"
            aria-label="Close notifications"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-600 font-medium">All caught up!</p>
            <p className="text-neutral-500 text-sm mt-1">No new notifications</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            <AnimatePresence>
              {notifications.map((notification, index) => (
                <motion.button
                  key={notification.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleNotificationClick(notification.link)}
                  className="w-full p-4 hover:bg-neutral-50 transition-colors text-left group"
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 p-2 rounded-lg ${getPriorityColor(notification.priority)}`}>
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-neutral-900 text-sm">
                          {notification.title}
                        </p>
                        {notification.count > 1 && (
                          <span className="bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full px-2 py-0.5">
                            {notification.count}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-neutral-600 leading-relaxed">
                        {notification.message}
                      </p>
                      <p className="text-xs text-neutral-500 mt-1">
                        Click to view
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-emerald-600 transition-colors flex-shrink-0" />
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
