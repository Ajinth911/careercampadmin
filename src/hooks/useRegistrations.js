import { useState, useEffect, useCallback } from "react";
import { fetchRegistrations, fetchDashboardStats, resendTicketEmail, verifyTicket } from "../lib/api";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

export function useRegistrations() {
  const [registrations, setRegistrations] = useState([]);
  const [stats, setStats] = useState({
    totalRegistrations: 0,
    checkedIn: 0,
    notCheckedIn: 0,
    failedEmails: 0,
    pendingSheetsSync: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newRegistrationAlert, setNewRegistrationAlert] = useState(null);
  const [isLiveSync, setIsLiveSync] = useState(Boolean(isSupabaseConfigured && supabase));

  // Filter and pagination state
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("");
  const [passOutYear, setPassOutYear] = useState("");
  const [attendanceStatus, setAttendanceStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const loadData = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setLoading(true);
    }
    setError(null);
    try {
      const [tableResult, statsResult] = await Promise.all([
        fetchRegistrations({
          search,
          domain,
          passOutYear,
          attendanceStatus,
          page,
          pageSize,
        }),
        fetchDashboardStats(),
      ]);

      setRegistrations(tableResult.records);
      setTotalPages(tableResult.totalPages);
      setTotalCount(tableResult.total);
      setStats(statsResult);
    } catch (err) {
      setError(err.message || "Failed to load registrations.");
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  }, [search, domain, passOutYear, attendanceStatus, page, pageSize]);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // 1. Supabase Realtime Channel: Listen to live INSERT/UPDATE/DELETE on registrations table
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const channel = supabase
      .channel("public:registrations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "registrations" },
        (payload) => {
          if (payload.eventType === "INSERT" && payload.new) {
            setNewRegistrationAlert({
              type: "NEW_REGISTRATION",
              registration: payload.new,
              timestamp: Date.now(),
            });
          }
          // Silently update table data without flickering full-screen loading spinner
          loadData(false);
        }
      )
      .subscribe((status) => {
        setIsLiveSync(status === "SUBSCRIBED" || status === "JOINED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  // 2. Cross-tab and window event real-time synchronization
  useEffect(() => {
    const handleCustomReg = (e) => {
      if (e.detail) {
        setNewRegistrationAlert({
          type: "NEW_REGISTRATION",
          registration: e.detail,
          timestamp: Date.now(),
        });
      }
      loadData(false);
    };

    window.addEventListener("clp:new-registration", handleCustomReg);

    let bc = null;
    try {
      bc = new BroadcastChannel("clp_registrations_channel");
      bc.onmessage = (event) => {
        if (event.data?.type === "NEW_REGISTRATION" && event.data.registration) {
          setNewRegistrationAlert({
            type: "NEW_REGISTRATION",
            registration: event.data.registration,
            timestamp: Date.now(),
          });
          loadData(false);
        }
      };
    } catch (e) {
      console.warn("BroadcastChannel error:", e);
    }

    const handleFocus = () => {
      loadData(false);
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("clp:new-registration", handleCustomReg);
      window.removeEventListener("focus", handleFocus);
      if (bc) bc.close();
    };
  }, [loadData]);

  // 3. Gentle background heartbeat (every 30s) running silently without spinner flicker
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        loadData(false);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [loadData]);

  const handleManualCheckIn = async (registrationId) => {
    try {
      const result = await verifyTicket({ registrationId });
      if (result.status === "success") {
        await loadData();
        return { success: true, message: `Check-in approved for ${result.full_name} (${result.registration_id})` };
      } else if (result.status === "already_checked_in") {
        return { success: false, message: `Participant already checked in at ${new Date(result.checked_in_at).toLocaleTimeString()}` };
      } else {
        return { success: false, message: result.message || "Check-in failed" };
      }
    } catch (err) {
      return { success: false, message: err.message || "Check-in error" };
    }
  };

  const handleResendTicket = async (registrationId) => {
    try {
      const result = await resendTicketEmail(registrationId);
      await loadData();
      return { success: true, message: result.message || "Ticket resent successfully." };
    } catch (err) {
      return { success: false, message: err.message || "Failed to resend ticket." };
    }
  };

  return {
    registrations,
    stats,
    loading,
    error,
    search,
    setSearch,
    domain,
    setDomain,
    passOutYear,
    setPassOutYear,
    attendanceStatus,
    setAttendanceStatus,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    totalCount,
    reload: loadData,
    manualCheckIn: handleManualCheckIn,
    resendTicket: handleResendTicket,
    newRegistrationAlert,
    dismissAlert: () => setNewRegistrationAlert(null),
    isLiveSync,
  };
}
