"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export function useUnreadMessages(pollInterval = 60000) {
  const { data: session } = useSession();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!session) return;

    const fetchCount = () => {
      fetch("/api/messages/unread-count")
        .then((r) => r.json())
        .then((data) => setCount(data.count))
        .catch(() => {});
    };

    fetchCount();
    const interval = setInterval(fetchCount, pollInterval);
    return () => clearInterval(interval);
  }, [session, pollInterval]);

  return count;
}
