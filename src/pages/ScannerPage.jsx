import React, { useState } from "react";
import "./ScannerPage.css";
import QRScanner from "../components/QRScanner";
import { ArrowLeft } from "lucide-react";

export default function ScannerPage({ onBackToDashboard }) {
  const [sessionLogs, setSessionLogs] = useState([]);

  const handleScanComplete = (result) => {
    setSessionLogs((prev) => [
      {
        id: Date.now(),
        time: new Date().toLocaleTimeString(),
        status: result.status,
        name: result.full_name || "Unknown Token",
        registrationId: result.registration_id || "N/A",
      },
      ...prev.slice(0, 9),
    ]);
  };

  return (
    <div className="scanner-page-container">
      <div className="scanner-page-header">
        <div>
          <h1 className="scanner-page-title">Entrance Gate Verification</h1>
          <span className="scanner-page-subtitle">
            Scan attendee passes using webcam or mobile rear camera.
          </span>
        </div>

        <button
          type="button"
          className="btn-back-dashboard"
          onClick={onBackToDashboard}
        >
          <ArrowLeft size={14} style={{ display: "inline", marginRight: 6 }} />
          Back to Dashboard
        </button>
      </div>

      <QRScanner onScanComplete={handleScanComplete} />

      {sessionLogs.length > 0 && (
        <div className="recent-scans-card">
          <div className="recent-scans-header">
            <span>Current Session Scans ({sessionLogs.length})</span>
          </div>
          <div className="recent-scans-list">
            {sessionLogs.map((item) => (
              <div
                key={item.id}
                className={`recent-scan-item ${
                  item.status === "success"
                    ? "success"
                    : item.status === "already_checked_in"
                    ? "warning"
                    : "error"
                }`}
              >
                <div className="scan-item-info">
                  <span className="scan-item-name">{item.name}</span>
                  <span className="scan-item-id">Ref: {item.registrationId}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    className="scan-item-status"
                    style={{
                      color:
                        item.status === "success"
                          ? "#166534"
                          : item.status === "already_checked_in"
                          ? "#b45309"
                          : "#991b1b",
                    }}
                  >
                    {item.status === "success"
                      ? "APPROVED"
                      : item.status === "already_checked_in"
                      ? "ALREADY CHECKED IN"
                      : "INVALID"}
                  </div>
                  <div style={{ fontSize: 11, color: "#888" }}>{item.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
