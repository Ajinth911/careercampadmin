import React, { useState } from "react";
import "./RegistrationTable.css";
import { DEPARTMENT_OPTIONS, PASSOUT_YEAR_OPTIONS } from "../lib/validators";
import { exportRegistrationsToCSV } from "../lib/api";
import {
  Search,
  Download,
  RefreshCw,
  Eye,
  Send,
  Users,
  UserCheck,
  UserX,
  Copy,
  Check,
  Database,
  Sparkles,
  FileText,
} from "lucide-react";
import LoadingSpinner from "./LoadingSpinner";

export default function RegistrationTable({
  registrations,
  loading,
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
  stats,
  onManualCheckIn,
  onResendTicket,
  onRefresh,
}) {
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const handleExportCSV = () => {
    exportRegistrationsToCSV(registrations);
  };

  const handleCheckInClick = async (regId) => {
    setActionLoading(true);
    await onManualCheckIn(regId);
    setActionLoading(false);
  };

  const handleResendClick = async (regId) => {
    setActionLoading(true);
    await onResendTicket(regId);
    setActionLoading(false);
  };

  const handleCopyRegId = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const allCount = stats?.totalRegistrations ?? totalCount;
  const notCheckedCount = stats?.notCheckedIn ?? 0;
  const checkedInCount = stats?.checkedIn ?? 0;

  return (
    <div className="registration-table-container">
      {/* View Options Selector: All Registered vs Newly Registered vs Checked In */}
      <div className="table-view-options">
        <div className="view-options-header">
          <div className="view-options-title">
            <Users size={16} />
            <span>Dashboard View Options:</span>
          </div>
          <span className="view-options-subtitle">
            Toggle between all registered persons and entrance check-in records
          </span>
        </div>

        <div className="view-options-tabs">
          <button
            type="button"
            className={`view-option-btn ${attendanceStatus === "" ? "active" : ""}`}
            onClick={() => {
              setAttendanceStatus("");
              setPage(1);
            }}
          >
            <Users size={15} />
            <span>All Registered Persons</span>
            <span className="view-option-badge">{allCount}</span>
          </button>

          <button
            type="button"
            className={`view-option-btn ${attendanceStatus === "not_checked_in" ? "active" : ""}`}
            onClick={() => {
              setAttendanceStatus("not_checked_in");
              setPage(1);
            }}
          >
            <UserX size={15} />
            <span>Newly Registered (Awaiting Check-in)</span>
            <span className="view-option-badge badge-pending">{notCheckedCount}</span>
          </button>

          <button
            type="button"
            className={`view-option-btn ${attendanceStatus === "checked_in" ? "active" : ""}`}
            onClick={() => {
              setAttendanceStatus("checked_in");
              setPage(1);
            }}
          >
            <UserCheck size={15} />
            <span>Checked-In Participants</span>
            <span className="view-option-badge badge-success">{checkedInCount}</span>
          </button>
        </div>
      </div>

      {/* Table Toolbar */}
      <div className="table-toolbar">
        <div className="table-filters">
          <div className="search-input-wrapper">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search name, email, phone, ID, college..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <select
            className="filter-select"
            value={domain}
            onChange={(e) => {
              setDomain(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Departments</option>
            {DEPARTMENT_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={passOutYear}
            onChange={(e) => {
              setPassOutYear(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Pass-Out Years</option>
            {PASSOUT_YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={attendanceStatus}
            onChange={(e) => {
              setAttendanceStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Status: All Persons ({allCount})</option>
            <option value="not_checked_in">Newly Registered ({notCheckedCount})</option>
            <option value="checked_in">Checked In ({checkedInCount})</option>
          </select>
        </div>

        <div className="table-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onRefresh}
            title="Refresh database records"
          >
            <RefreshCw size={14} /> Refresh
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={handleExportCSV}
            title="Export filtered records to CSV"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-responsive">
        {loading ? (
          <LoadingSpinner text="Loading registered persons from Supabase..." />
        ) : registrations.length === 0 ? (
          <div className="empty-table-state">
            <FileText size={36} color="#9ca3af" />
            <p style={{ marginTop: 12, fontWeight: 600 }}>No participants found in this view.</p>
            <p style={{ fontSize: 13, color: "#6b7280" }}>
              {attendanceStatus === "not_checked_in"
                ? "All registered participants have already checked in!"
                : "No registered persons match your current search and filter criteria."}
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Registration ID</th>
                <th>Registered Person</th>
                <th>Contact</th>
                <th>College</th>
                <th>Department</th>
                <th>Year</th>
                <th>Registered At</th>
                <th>Entrance Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((row) => (
                <tr key={row.registration_id}>
                  <td className="mono-cell">
                    <button
                      type="button"
                      className="reg-id-link"
                      onClick={() => setSelectedParticipant(row)}
                      title="Click to view full registration details"
                    >
                      {row.registration_id}
                    </button>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{row.full_name}</div>
                    <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                      {row.domain || row.department}
                    </div>
                  </td>
                  <td>
                    <div>{row.email}</div>
                    <div style={{ color: "var(--color-text-muted)", fontSize: 11 }}>
                      {row.phone_number}
                    </div>
                  </td>
                  <td>{row.college_name}</td>
                  <td>{row.department || row.domain}</td>
                  <td>{row.pass_out_year}</td>
                  <td style={{ fontSize: 12, color: "#4b5563" }}>
                    {row.registered_at ? (
                      <>
                        <div>{new Date(row.registered_at).toLocaleDateString()}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>
                          {new Date(row.registered_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </>
                    ) : (
                      "N/A"
                    )}
                  </td>
                  <td>
                    {row.attendance_status === "checked_in" ? (
                      <span className="badge badge-checked-in">
                        Checked In
                      </span>
                    ) : (
                      <span className="badge badge-not-checked">
                        Registered (Pending)
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="action-btn-sm details-btn"
                        onClick={() => setSelectedParticipant(row)}
                        title="View Complete Registration Details"
                      >
                        <Eye size={12} /> Details
                      </button>

                      {row.attendance_status !== "checked_in" && (
                        <button
                          type="button"
                          className="action-btn-sm checkin-btn"
                          onClick={() => handleCheckInClick(row.registration_id)}
                          disabled={actionLoading}
                          title="Manual Gate Check-In"
                        >
                          Check In
                        </button>
                      )}

                      <button
                        type="button"
                        className="action-btn-sm"
                        onClick={() => handleResendClick(row.registration_id)}
                        disabled={actionLoading}
                        title="Resend Ticket Pass Email"
                      >
                        <Send size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="table-pagination">
        <div>
          Showing {registrations.length} of {totalCount} participants (Page {page} of {totalPages})
        </div>
        <div className="pagination-controls">
          <button
            type="button"
            className="page-btn"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <button
            type="button"
            className="page-btn"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>

      {/* Complete Registered Person Details Modal */}
      {selectedParticipant && (
        <div className="modal-backdrop" onClick={() => setSelectedParticipant(null)}>
          <div className="modal-content modal-participant-details" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Registered Person Details</h3>
                <span className="modal-subtitle">
                  Verified record stored in Supabase PostgreSQL Database
                </span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedParticipant(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Database status banner */}
              <div className="db-verified-badge">
                <Database size={15} color="#166534" />
                <span>
                  <strong>Stored in Supabase Database:</strong> Record synchronized with public.registrations
                </span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Registration ID</span>
                <span className="detail-val mono-cell" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {selectedParticipant.registration_id}
                  <button
                    type="button"
                    className="action-btn-sm"
                    onClick={() => handleCopyRegId(selectedParticipant.registration_id)}
                    title="Copy Registration ID"
                    style={{ padding: "2px 6px" }}
                  >
                    {copiedId ? <Check size={11} color="#166534" /> : <Copy size={11} />}
                  </button>
                </span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Full Name</span>
                <span className="detail-val">{selectedParticipant.full_name}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Email Address</span>
                <span className="detail-val">{selectedParticipant.email}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Phone Number</span>
                <span className="detail-val">{selectedParticipant.phone_number}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">College / Institution</span>
                <span className="detail-val">{selectedParticipant.college_name}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Department</span>
                <span className="detail-val">{selectedParticipant.department || selectedParticipant.domain}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Domain</span>
                <span className="detail-val">{selectedParticipant.domain || selectedParticipant.department}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Pass-Out Year</span>
                <span className="detail-val">{selectedParticipant.pass_out_year}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Registration Date & Time</span>
                <span className="detail-val">
                  {selectedParticipant.registered_at
                    ? new Date(selectedParticipant.registered_at).toLocaleString()
                    : "Recorded"}
                </span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Email Ticket Status</span>
                <span className="detail-val">
                  <span className={`badge badge-email-${selectedParticipant.email_status}`}>
                    {selectedParticipant.email_status || "pending"}
                  </span>
                </span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Entrance Attendance Status</span>
                <span className="detail-val">
                  {selectedParticipant.attendance_status === "checked_in" ? (
                    <span style={{ color: "#166534", fontWeight: 700 }}>
                      ✓ Checked in at {selectedParticipant.checked_in_at ? new Date(selectedParticipant.checked_in_at).toLocaleString() : "Verified"}
                    </span>
                  ) : (
                    <span style={{ color: "#92400e", fontWeight: 600 }}>
                      ⏳ Registered — Awaiting Entrance Check-in
                    </span>
                  )}
                </span>
              </div>

              <div style={{ marginTop: 6 }}>
                <span className="detail-label" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Sparkles size={13} color="#4f46e5" /> Identified AI Skills:
                </span>
                <div className="skills-pill-container">
                  {selectedParticipant.ai_skills?.length > 0 ? (
                    selectedParticipant.ai_skills.map((skill) => (
                      <span key={skill} className="skill-pill">
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: 13, color: "#888" }}>None selected</span>
                  )}
                </div>
              </div>

              {/* Action buttons in modal */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16, paddingTop: 12, borderTop: "1px solid #e5e7eb" }}>
                {selectedParticipant.attendance_status !== "checked_in" && (
                  <button
                    type="button"
                    className="action-btn-sm checkin-btn"
                    onClick={() => {
                      handleCheckInClick(selectedParticipant.registration_id);
                      setSelectedParticipant(null);
                    }}
                    style={{ padding: "6px 14px" }}
                  >
                    Check In This Participant
                  </button>
                )}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setSelectedParticipant(null)}
                  style={{ padding: "6px 14px" }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
