"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export function NotificationHandler() {
  const permissionAsked = useRef(false);

  useEffect(() => {
    // Request notification permission once
    if (!permissionAsked.current && "Notification" in window && Notification.permission === "default") {
      permissionAsked.current = true;
      Notification.requestPermission();
    }

    // Subscribe to session completion events
    const channel = supabase
      .channel("session-notifications")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ark_sessions",
        },
        (payload) => {
          const newStatus = payload.new?.status;
          const oldStatus = payload.old?.status;

          if (newStatus === "completed" && oldStatus !== "completed") {
            const topic = (payload.new?.topic as string) || "Discussion";
            const truncated = topic.length > 60 ? topic.slice(0, 60) + "..." : topic;

            // Browser notification
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("Ark — Discussion Complete", {
                body: truncated,
                icon: "/icon-192.png",
                tag: `session-${payload.new?.id}`,
              });
            }

            // PWA badge
            if ("setAppBadge" in navigator) {
              (navigator as unknown as { setAppBadge: (n: number) => void }).setAppBadge(1);
              // Clear badge after 30 seconds
              setTimeout(() => {
                if ("clearAppBadge" in navigator) {
                  (navigator as unknown as { clearAppBadge: () => void }).clearAppBadge();
                }
              }, 30000);
            }
          }

          if (newStatus === "error" && oldStatus !== "error") {
            const topic = (payload.new?.topic as string) || "Discussion";
            const truncated = topic.length > 60 ? topic.slice(0, 60) + "..." : topic;

            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("Ark — Session Error", {
                body: truncated,
                icon: "/icon-192.png",
                tag: `session-error-${payload.new?.id}`,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null; // This component renders nothing — it just handles notifications
}
