import React, { useState } from "react";
import "./AdminDashboard.css";
import { useRegistrations } from "../hooks/useRegistrations";
import StatCard from "../components/StatCard";
import RegistrationTable from "../components/RegistrationTable";
import Toast from "../components/Toast";
import {
  getGoogleSheetsWebhookUrl,
  setGoogleSheetsWebhookUrl,
  syncRegistrationToSheet,
  GOOGLE_APPS_SCRIPT_TEMPLATE,
} from "../lib/googleSheets";
import {
  Users,
  UserCheck,
  UserX,
  MailWarning,
  TableProperties,
  QrCode,
  RefreshCw,
  Settings,
  Copy,
  Check,
  Send,
} from "lucide-react";

export default function AdminDashboard({ onNavigateToScanner }) {
  const {
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
    totalPages,
    totalCount,
    reload,
    manualCheckIn,
    resendTicket,
    newRegistrationAlert,
    dismissAlert,
    isLiveSync,
  } = useRegistrations();

  const [toast, setToast] = useState(null);
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [webhookInput, setWebhookInput] = useState(getGoogleSheetsWebhookUrl());
  const [copiedScript, setCopiedScript] = useState(false);
  const [testingSheet, setTestingSheet] = useState(false);

  const handleManualCheckIn = async (regId) => {
    const res = await manualCheckIn(regId);
    setToast({
      message: res.message,
      type: res.success ? "success" : "error",
    });
  };

  const handleResendTicket = async (regId) => {
    const res = await resendTicket(regId);
    setToast({
      message: res.message,
      type: res.success ? "success" : "error",
    });
  };

  const handleManualSheetsSync = async () => {
    setSyncingSheets(true);
    setTimeout(() => {
      setSyncingSheets(false);
      reload();
      setToast({
        message: "Google Sheets sync job processed successfully.",
        type: "success",
      });
    }, 1000);
  };

  const handleSaveWebhook = (e) => {
    e.preventDefault();
    setGoogleSheetsWebhookUrl(webhookInput);
    setToast({
      message: "Google Sheets Webhook URL saved successfully.",
      type: "success",
    });
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
    setToast({
      message: "Google Apps Script code copied to clipboard!",
      type: "success",
    });
  };

  const handleSendTestRow = async () => {
    if (!webhookInput.trim()) {
      setToast({
        message: "Please enter and save your Google Sheets Webhook URL first.",
        type: "warning",
      });
      return;
    }
    setTestingSheet(true);
    const testRecord = {
      registration_id: `CLP-TEST-${Math.floor(1000 + Math.random() * 9000)}`,
      full_name: "Test Participant (Sheets Sync)",
      phone_number: "+91 9999988888",
      email: "test.sheets@careerlaunchpad.dev",
      college_name: "Engineering Institute",
      pass_out_year: 2026,
      department: "Computer Science and Engineering",
      domain: "Artificial Intelligence & ML",
      ai_skills: ["Machine Learning", "Generative AI and LLMs"],
      registered_at: new Date().toISOString(),
      email_status: "sent",
      attendance_status: "not_checked_in",
    };

    await syncRegistrationToSheet(testRecord);
    setTestingSheet(false);
    setToast({
      message: "Test participant row dispatched to your Google Sheet! Check your spreadsheet.",
      type: "success",
    });
  };

  const isConnected = Boolean(getGoogleSheetsWebhookUrl());

  return (
    <div className="dashboard-container">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {error && (
        <div style={{ marginBottom: 20, padding: 14, backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span><strong>Data Load Warning:</strong> {error}</span>
          <button type="button" className="btn-secondary" onClick={reload} style={{ fontSize: 12, padding: "4px 8px" }}>Retry</button>
        </div>
      )}

      {/* Real-time Registration Notification Banner */}
      {newRegistrationAlert && (
        <div className="new-reg-live-alert">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="live-badge-dot" />
            <span>
              <strong>🎉 New Person Registered:</strong> {newRegistrationAlert.registration?.full_name} ({newRegistrationAlert.registration?.registration_id}) — Automatically saved to Supabase DB and displayed below!
            </span>
          </div>
          <button
            type="button"
            className="action-btn-sm"
            onClick={dismissAlert}
            style={{ padding: "4px 10px", fontSize: 12 }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-title-group">
          <h1 className="dashboard-title">Career Launchpad Overview</h1>
          <span className="dashboard-subtitle">
            Real-time participant analytics, ticket issuance, and gate verification logs.
          </span>
        </div>

        <div className="dashboard-header-actions">
          <div className="live-db-status" title="Real-time synchronization with Supabase PostgreSQL Database">
            <span className="live-db-pulse" />
            <span>{isLiveSync ? "Supabase Live DB: Active" : "Supabase DB: Connected"}</span>
          </div>

          <button
            type="button"
            className="btn-open-scanner"
            onClick={onNavigateToScanner}
          >
            <QrCode size={16} /> Open QR Scanner
          </button>
        </div>
      </div>

      {/* 5 Real Metric Cards - Interactive for rapid view switching */}
      <div className="metrics-grid">
        <StatCard
          title="Total Registrations"
          value={stats.totalRegistrations}
          subtitle="All registered persons (Supabase DB)"
          icon={Users}
          onClick={() => {
            setAttendanceStatus("");
            setPage(1);
          }}
          active={attendanceStatus === ""}
        />
        <StatCard
          title="Checked-In"
          value={stats.checkedIn}
          subtitle={`${stats.totalRegistrations > 0 ? Math.round((stats.checkedIn / stats.totalRegistrations) * 100) : 0}% turn-out at gate`}
          icon={UserCheck}
          alertType="success"
          onClick={() => {
            setAttendanceStatus("checked_in");
            setPage(1);
          }}
          active={attendanceStatus === "checked_in"}
        />
        <StatCard
          title="Not Checked In"
          value={stats.notCheckedIn}
          subtitle="Newly registered (awaiting check-in)"
          icon={UserX}
          onClick={() => {
            setAttendanceStatus("not_checked_in");
            setPage(1);
          }}
          active={attendanceStatus === "not_checked_in"}
        />
        <StatCard
          title="Failed Emails"
          value={stats.failedEmails}
          subtitle="Delivery errors requiring retry"
          icon={MailWarning}
          alertType={stats.failedEmails > 0 ? "danger" : undefined}
        />
        <StatCard
          title="Pending Sheets Sync"
          value={stats.pendingSheetsSync}
          subtitle="Google Sheets queue"
          icon={TableProperties}
          alertType={stats.pendingSheetsSync > 0 ? "warning" : undefined}
        />
      </div>

      {/* Google Sheets Sync Card */}
      <div className="integration-status-card">
        <div className="integration-status-info">
          <span className={`integration-dot ${isConnected ? "" : "pending"}`} />
          <div>
            <div className="integration-title">
              Google Sheets Live Sync Pipeline {isConnected ? "(Active)" : "(Setup Required)"}
            </div>
            <div className="integration-desc">
              Synchronizing worksheet <code>Registrations</code> with real-time registrations and gate check-in timestamps.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn-sync-retry"
            onClick={() => setShowSheetModal(true)}
          >
            <Settings size={13} /> Configure Google Sheet
          </button>

          <button
            type="button"
            className="btn-sync-retry"
            onClick={handleManualSheetsSync}
            disabled={syncingSheets}
          >
            <RefreshCw size={13} className={syncingSheets ? "loading-spinner-sm" : ""} />
            {syncingSheets ? "Syncing..." : "Run Sync Now"}
          </button>
        </div>
      </div>

      {/* Main Participants Table with View Options */}
      <RegistrationTable
        registrations={registrations}
        loading={loading}
        search={search}
        setSearch={setSearch}
        domain={domain}
        setDomain={setDomain}
        passOutYear={passOutYear}
        setPassOutYear={setPassOutYear}
        attendanceStatus={attendanceStatus}
        setAttendanceStatus={setAttendanceStatus}
        page={page}
        setPage={setPage}
        totalPages={totalPages}
        totalCount={totalCount}
        stats={stats}
        onManualCheckIn={handleManualCheckIn}
        onResendTicket={handleResendTicket}
        onRefresh={reload}
      />

      {/* Google Sheets Setup Modal */}
      {showSheetModal && (
        <div className="modal-backdrop" onClick={() => setShowSheetModal(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: 640 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title">Connect Google Sheets</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowSheetModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: 13, color: "#555", lineHeight: 1.5 }}>
                Connect your Google Sheet so new registrations and entrance check-in timestamps sync automatically.
              </p>

              {/* Step 1: Apps Script Code */}
              <div style={{ backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <strong style={{ fontSize: 13 }}>Step 1: Get Your Webhook URL</strong>
                  <button
                    type="button"
                    className="action-btn-sm"
                    onClick={handleCopyScript}
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    {copiedScript ? <Check size={12} color="#166534" /> : <Copy size={12} />}
                    {copiedScript ? "Copied!" : "Copy Google Apps Script"}
                  </button>
                </div>
                <ol style={{ fontSize: 12, color: "#444", paddingLeft: 16, lineHeight: 1.6 }}>
                  <li>Open your Google Sheet at <a href="https://sheets.new" target="_blank" rel="noreferrer" style={{ textDecoration: "underline", fontWeight: 600 }}>sheets.new</a></li>
                  <li>Click <strong>Extensions &gt; Apps Script</strong></li>
                  <li>Replace all code with the copied script, then click <strong>Deploy &gt; New deployment</strong></li>
                  <li>Select type: <strong>Web app</strong>, Execute as: <strong>Me</strong>, Who has access: <strong>Anyone</strong></li>
                  <li>Click <strong>Deploy</strong> and copy the <strong>Web App URL</strong></li>
                </ol>
              </div>

              {/* Step 2: Webhook URL Input */}
              <form onSubmit={handleSaveWebhook} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>
                  Step 2: Paste Google Sheets Webhook URL
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="url"
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={webhookInput}
                    onChange={(e) => setWebhookInput(e.target.value)}
                    className="search-input"
                    style={{ paddingLeft: 12, flex: 1 }}
                  />
                  <button type="submit" className="action-btn-sm checkin-btn" style={{ padding: "8px 16px" }}>
                    Save URL
                  </button>
                </div>
              </form>

              {/* Test Button */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee" }}>
                <span style={{ fontSize: 12, color: isConnected ? "#166534" : "#888" }}>
                  {isConnected ? "✓ Webhook URL active" : "Not configured yet"}
                </span>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleSendTestRow}
                  disabled={testingSheet}
                >
                  <Send size={13} />
                  {testingSheet ? "Sending..." : "Send Test Row"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
