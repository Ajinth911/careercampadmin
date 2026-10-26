import QRCode from "qrcode";

/**
 * Generates an event ticket PNG as a data URL using HTML5 Canvas.
 * Produces a high-contrast, black-and-white minimalist pass.
 */
export async function generateTicketPNG(participant) {
  const width = 800;
  const height = 1100;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // Background - Crisp White
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Outer border - Black 2px
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#111111";
  ctx.strokeRect(24, 24, width - 48, height - 48);

  // Header band
  ctx.fillStyle = "#111111";
  ctx.fillRect(24, 24, width - 48, 120);

  // Header Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 34px 'Inter', sans-serif";
  ctx.letterSpacing = "2px";
  ctx.fillText("CAREER LAUNCHPAD", 60, 80);

  // Header Tagline
  ctx.fillStyle = "#cccccc";
  ctx.font = "16px 'Inter', sans-serif";
  ctx.fillText("YOUR NEXT OPPORTUNITY STARTS HERE", 60, 114);

  // Pass Type Badge in Header
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(width - 220, 52, 140, 36);
  ctx.fillStyle = "#111111";
  ctx.font = "bold 14px 'Inter', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("OFFICIAL PASS", width - 150, 75);
  ctx.textAlign = "left";

  // Registration ID Box
  ctx.fillStyle = "#f4f4f5";
  ctx.fillRect(60, 180, width - 120, 72);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#e5e7eb";
  ctx.strokeRect(60, 180, width - 120, 72);

  ctx.fillStyle = "#666666";
  ctx.font = "12px 'Inter', sans-serif";
  ctx.fillText("REGISTRATION REFERENCE ID", 80, 204);

  ctx.fillStyle = "#111111";
  ctx.font = "bold 26px 'SFMono-Regular', monospace";
  ctx.fillText(participant.registration_id || participant.registrationId || "CLP-PENDING", 80, 238);

  // Participant Details Grid
  const renderField = (label, value, x, y, maxWidth = 320) => {
    ctx.fillStyle = "#666666";
    ctx.font = "12px 'Inter', sans-serif";
    ctx.fillText(label.toUpperCase(), x, y);

    ctx.fillStyle = "#111111";
    ctx.font = "600 20px 'Inter', sans-serif";
    
    // Truncate if too long
    let displayValue = String(value || "N/A");
    if (ctx.measureText(displayValue).width > maxWidth) {
      while (ctx.measureText(displayValue + "...").width > maxWidth && displayValue.length > 0) {
        displayValue = displayValue.slice(0, -1);
      }
      displayValue += "...";
    }
    ctx.fillText(displayValue, x, y + 26);
  };

  renderField("Participant Name", participant.full_name || participant.fullName, 60, 280, 320);
  renderField("College / Institution", participant.college_name || participant.collegeName, 420, 280, 320);
  renderField("Department", participant.department || participant.domain, 60, 355, 320);
  renderField("Domain", participant.domain || participant.department, 420, 355, 320);
  renderField("Graduation Year", participant.pass_out_year || participant.passOutYear, 60, 430, 320);

  // Dashed tear line separator
  ctx.beginPath();
  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 2;
  ctx.moveTo(40, 500);
  ctx.lineTo(width - 40, 500);
  ctx.stroke();
  ctx.setLineDash([]);

  // Generate QR Code containing ONLY the opaque token
  const qrData = participant.ticket_token || participant.ticketToken || participant.registration_id || "CLP-TOKEN";
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, qrData, {
    width: 320,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
    errorCorrectionLevel: "H",
  });

  // Draw QR code centered
  const qrX = (width - 320) / 2;
  const qrY = 520;
  ctx.drawImage(qrCanvas, qrX, qrY, 320, 320);

  // Framing box for QR code
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#e5e7eb";
  ctx.strokeRect(qrX - 10, qrY - 10, 340, 340);

  // Entry Instruction text below QR
  ctx.fillStyle = "#111111";
  ctx.font = "bold 16px 'Inter', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("ENTRY VERIFICATION PASS", width / 2, 900);

  ctx.fillStyle = "#555555";
  ctx.font = "14px 'Inter', sans-serif";
  ctx.fillText("Present this QR code at the entrance verification desk.", width / 2, 930);
  ctx.fillText("Valid for one-time admission. Keep your registration ID handy.", width / 2, 952);

  // Footer
  ctx.fillStyle = "#f9fafb";
  ctx.fillRect(26, height - 76, width - 52, 50);
  ctx.fillStyle = "#888888";
  ctx.font = "11px 'Inter', sans-serif";
  ctx.fillText("SECURE CRYPTOGRAPHIC TOKEN VERIFICATION • CAREER LAUNCHPAD", width / 2, height - 46);

  return canvas.toDataURL("image/png");
}

/**
 * Triggers a download of the ticket PNG in the browser.
 */
export async function downloadTicket(participant) {
  const dataUrl = await generateTicketPNG(participant);
  const link = document.createElement("a");
  const regId = participant.registration_id || participant.registrationId || "ticket";
  link.download = `Career-Launchpad-Pass-${regId}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
