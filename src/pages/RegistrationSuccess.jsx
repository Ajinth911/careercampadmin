import React from "react";
import "./RegistrationSuccess.css";
import TicketPreview from "../components/TicketPreview";
import { Check } from "lucide-react";

export default function RegistrationSuccess({ registration, onRegisterAnother }) {
  if (!registration) {
    return (
      <div className="success-page-container">
        <div className="success-banner">
          <h1 className="success-title">No Active Registration Found</h1>
          <p className="success-desc">
            No registration data is present for this session. Please complete the registration form to obtain your digital pass.
          </p>
          <div className="success-actions" style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btn-new-registration"
              onClick={onRegisterAnother}
            >
              ← Go to Event Registration
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="success-page-container">
      <div className="success-banner">
        <div className="success-icon-badge">
          <Check size={26} />
        </div>
        <h1 className="success-title">Registration Confirmed!</h1>
        <p className="success-desc">
          Welcome to Career Launchpad, <strong>{registration.full_name}</strong>. Your registration has
          been successfully verified and recorded in the database.
        </p>

        <div className="success-email-notice">
          A confirmation with your digital pass has been queued to <strong>{registration.email}</strong>.
        </div>

        <div className="success-actions">
          <button
            type="button"
            className="btn-new-registration"
            onClick={onRegisterAnother}
          >
            ← Register Another Participant
          </button>
        </div>
      </div>

      {/* Live Ticket Pass & PNG Downloader */}
      <TicketPreview participant={registration} />
    </div>
  );
}
