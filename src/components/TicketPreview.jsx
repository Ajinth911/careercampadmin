import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import "./TicketPreview.css";
import { downloadTicket } from "../lib/ticketGenerator";
import { Download } from "lucide-react";

export default function TicketPreview({ participant }) {
  const canvasRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!participant || !canvasRef.current) return;

    // Render QR code into the preview canvas
    const qrData =
      participant.ticket_token ||
      participant.ticketToken ||
      participant.registration_id ||
      "CLP-VALID-TOKEN";

    QRCode.toCanvas(canvasRef.current, qrData, {
      width: 200,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
      errorCorrectionLevel: "H",
    }).catch((err) => {
      console.error("QR Canvas error:", err);
    });
  }, [participant]);

  if (!participant) return null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadTicket(participant);
    } catch (e) {
      console.error("Download error:", e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="ticket-preview-wrapper">
      <div className="ticket-card">
        <div className="ticket-header">
          <div>
            <div className="ticket-brand-name">CAREER LAUNCHPAD</div>
            <div className="ticket-tagline">Your next opportunity starts here.</div>
          </div>
          <div className="ticket-badge">ADMISSION PASS</div>
        </div>

        <div className="ticket-body">
          <div className="ticket-ref-box">
            <div className="ticket-ref-label">Registration ID</div>
            <div className="ticket-ref-id">{participant.registration_id || participant.registrationId}</div>
          </div>

          <div className="ticket-meta-grid">
            <div>
              <div className="ticket-field-label">Participant</div>
              <div className="ticket-field-value">{participant.full_name || participant.fullName}</div>
            </div>
            <div>
              <div className="ticket-field-label">College</div>
              <div className="ticket-field-value">{participant.college_name || participant.collegeName}</div>
            </div>
            <div>
              <div className="ticket-field-label">Department</div>
              <div className="ticket-field-value">{participant.department || participant.domain}</div>
            </div>
            <div>
              <div className="ticket-field-label">Domain</div>
              <div className="ticket-field-value">{participant.domain || participant.department}</div>
            </div>
            <div>
              <div className="ticket-field-label">Graduation Year</div>
              <div className="ticket-field-value">{participant.pass_out_year || participant.passOutYear}</div>
            </div>
          </div>

          <hr className="ticket-divider" />

          <div className="ticket-qr-section">
            <div className="ticket-qr-container">
              <canvas ref={canvasRef} />
            </div>
            <div className="ticket-instructions">
              <strong>OFFICIAL ENTRY PASS</strong>
              Present this QR code at the entrance verification desk.
            </div>
          </div>
        </div>
      </div>

      <div className="ticket-actions">
        <button
          type="button"
          className="btn-download-ticket"
          onClick={handleDownload}
          disabled={downloading}
        >
          <Download size={16} />
          {downloading ? "Generating PNG..." : "Download High-Res PNG Ticket"}
        </button>
      </div>
    </div>
  );
}
