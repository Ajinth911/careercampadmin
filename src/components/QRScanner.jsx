import React, { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import "./QRScanner.css";
import { verifyTicket } from "../lib/api";
import {
  getGoogleSheetsWebhookUrl,
  setGoogleSheetsWebhookUrl,
  syncAttendanceToSheet,
} from "../lib/googleSheets";
import {
  Camera,
  Volume2,
  VolumeX,
  Upload,
  TableProperties,
  Check,
} from "lucide-react";

// Web Audio API beep generator
function playAudioTone(type = "success") {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "success") {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } else {
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {
    // Ignore audio permission errors
  }
}

export default function QRScanner({ onScanComplete }) {
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [lastResult, setLastResult] = useState(null);
  const [manualCode, setManualCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Google Sheet Webhook state
  const [sheetUrl, setSheetUrl] = useState(getGoogleSheetsWebhookUrl());
  const [sheetSaved, setSheetSaved] = useState(false);

  const scannerRef = useRef(null);
  const isStartingRef = useRef(false);
  const lastScannedTokenRef = useRef("");
  const cooldownRef = useRef(false);
  const fileInputRef = useRef(null);

  // Initialize and list cameras
  useEffect(() => {
    let mounted = true;

    async function initCameras() {
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (mounted && cameras && cameras.length > 0) {
          setAvailableCameras(cameras);
          const backCam = cameras.find((c) =>
            /back|rear|environment/i.test(c.label)
          );
          setSelectedCameraId(backCam ? backCam.id : cameras[0].id);
        }
      } catch (err) {
        console.warn("Could not enumerate camera devices:", err);
      }
    }

    initCameras();
    return () => {
      mounted = false;
    };
  }, []);

  const processVerification = async (payload) => {
    setIsVerifying(true);
    try {
      if (sheetUrl && sheetUrl.trim() && sheetUrl.trim() !== getGoogleSheetsWebhookUrl()) {
        setGoogleSheetsWebhookUrl(sheetUrl.trim());
      }

      const result = await verifyTicket(payload);
      setLastResult(result);

      if (result && (result.status === "success" || result.status === "already_checked_in")) {
        syncAttendanceToSheet(result, result.checked_in_at || new Date().toISOString()).catch((err) => {
          console.error("Sheet sync from scanner error:", err);
        });
      }

      if (result.status === "success") {
        if (soundEnabled) playAudioTone("success");
      } else {
        if (soundEnabled) playAudioTone("error");
      }

      if (onScanComplete) {
        onScanComplete(result);
      }
    } catch (err) {
      setLastResult({
        status: "error",
        message: err.message || "Network or backend failure.",
      });
      if (soundEnabled) playAudioTone("error");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleQrScanSuccess = (decodedText) => {
    if (cooldownRef.current || isVerifying) return;
    if (decodedText === lastScannedTokenRef.current) return;

    cooldownRef.current = true;
    lastScannedTokenRef.current = decodedText;

    const trimmed = (decodedText || "").trim();
    const isRegId = trimmed.toUpperCase().startsWith("CLP-") || trimmed.toUpperCase().startsWith("GL-");
    processVerification(
      isRegId
        ? { registrationId: trimmed, token: trimmed }
        : { token: trimmed }
    );

    setTimeout(() => {
      cooldownRef.current = false;
      lastScannedTokenRef.current = "";
    }, 2500);
  };

  const startScanner = async (cameraIdToUse) => {
    if (isStartingRef.current) return;
    setCameraError(null);
    isStartingRef.current = true;

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("html5-qrcode-reader");
      }

      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }

      const cameraConfig = cameraIdToUse
        ? cameraIdToUse
        : { facingMode: "environment" };

      await scannerRef.current.start(
        cameraConfig,
        {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const qrEdge = Math.floor(minEdge * 0.7);
            return { width: qrEdge, height: qrEdge };
          },
        },
        handleQrScanSuccess,
        () => {}
      );

      setIsScanning(true);
    } catch (err) {
      console.warn("Primary camera start failed, trying fallback:", err);
      try {
        if (scannerRef.current && !scannerRef.current.isScanning) {
          await scannerRef.current.start(
            { facingMode: "user" },
            { fps: 10, qrbox: { width: 220, height: 220 } },
            handleQrScanSuccess,
            () => {}
          );
          setIsScanning(true);
        }
      } catch (fallbackErr) {
        console.error("Camera startup error:", fallbackErr);
        setCameraError(
          fallbackErr?.message?.includes("Permission") || fallbackErr?.name === "NotAllowedError"
            ? "Camera permission denied. Please allow camera permissions in browser settings or upload an image."
            : "Camera access unavailable. You can use manual ticket lookup or image upload below."
        );
        setIsScanning(false);
      }
    } finally {
      isStartingRef.current = false;
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        setIsScanning(false);
      } catch (err) {
        console.error("Failed to stop scanner:", err);
      }
    }
  };

  useEffect(() => {
    if (selectedCameraId) {
      startScanner(selectedCameraId);
    } else {
      startScanner();
    }

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            scannerRef.current = null;
          });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCameraId]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;

    const isRegId = manualCode.toUpperCase().startsWith("CLP-");
    processVerification(
      isRegId
        ? { registrationId: manualCode.trim() }
        : { token: manualCode.trim() }
    );
    setManualCode("");
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const scanner = new Html5Qrcode("html5-qrcode-reader-hidden");
      const decodedResult = await scanner.scanFile(file, true);
      if (decodedResult) {
        const trimmed = (decodedResult || "").trim();
        const isRegId = trimmed.toUpperCase().startsWith("CLP-") || trimmed.toUpperCase().startsWith("GL-");
        processVerification(
          isRegId
            ? { registrationId: trimmed, token: trimmed }
            : { token: trimmed }
        );
      }
    } catch {
      setLastResult({
        status: "not_found",
        message: "No readable QR code found in uploaded image.",
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSaveSheet = (e) => {
    e.preventDefault();
    setGoogleSheetsWebhookUrl(sheetUrl);
    setSheetSaved(true);
    setTimeout(() => setSheetSaved(false), 2500);
  };

  const isSheetConnected = Boolean(getGoogleSheetsWebhookUrl());

  return (
    <div className="qr-scanner-wrapper">
      {/* Google Sheet Sync Configuration Bar */}
      <div style={{ backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}>
            <TableProperties size={15} />
            <span>Google Sheet Sync URL:</span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: isSheetConnected ? "#166534" : "#92400e" }}>
            {isSheetConnected ? "● Live Sheet Sync Active" : "○ No Sheet URL Set"}
          </span>
        </div>

        <form onSubmit={handleSaveSheet} style={{ display: "flex", gap: 8 }}>
          <input
            type="url"
            placeholder="Paste Google Sheet Webhook URL (https://script.google.com/macros/s/.../exec)"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            className="search-input"
            style={{ paddingLeft: 10, fontSize: 12, flex: 1 }}
          />
          <button
            type="submit"
            className="action-btn-sm checkin-btn"
            style={{ padding: "6px 14px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
          >
            {sheetSaved ? <Check size={12} /> : null}
            {sheetSaved ? "Saved!" : "Save Sheet Link"}
          </button>
        </form>
      </div>

      <div className="scanner-viewfinder-card">
        <div className="scanner-header">
          <div className="scanner-title">Live QR Verification Camera</div>
          <div className="scanner-status-indicator">
            <span className={`scanner-dot ${isScanning ? "active" : ""}`} />
            <span>{isScanning ? "Camera Live" : "Camera Standby"}</span>
          </div>
        </div>

        {/* Viewfinder display */}
        <div className="scanner-viewport-box">
          <div id="html5-qrcode-reader" />
          <div id="html5-qrcode-reader-hidden" style={{ display: "none" }} />
          {isScanning && <div className="scanner-overlay-guide" />}
        </div>

        {cameraError && (
          <div style={{ marginTop: 16, padding: 12, backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: 13 }}>
            {cameraError}
          </div>
        )}

        <div className="scanner-controls">
          {availableCameras.length > 1 && (
            <select
              className="scanner-btn"
              value={selectedCameraId}
              onChange={(e) => setSelectedCameraId(e.target.value)}
              title="Select Camera"
            >
              {availableCameras.map((cam, idx) => (
                <option key={cam.id} value={cam.id}>
                  {cam.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          )}

          {isScanning ? (
            <button
              type="button"
              className="scanner-btn"
              onClick={stopScanner}
            >
              Pause Camera
            </button>
          ) : (
            <button
              type="button"
              className="scanner-btn active"
              onClick={() => startScanner(selectedCameraId)}
            >
              <Camera size={14} /> Resume Camera
            </button>
          )}

          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleImageUpload}
          />

          <button
            type="button"
            className="scanner-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Scan pass directly from PNG image"
          >
            <Upload size={14} /> Upload Pass Image
          </button>

          <button
            type="button"
            className="scanner-btn"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title="Toggle audio feedback"
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            Sound: {soundEnabled ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* Real-time Verification Result Banner */}
      {lastResult && (
        <div
          className={`scan-result-card ${
            lastResult.status === "success"
              ? "success"
              : lastResult.status === "already_checked_in"
              ? "already-checked"
              : lastResult.status === "not_found"
              ? "invalid"
              : "error"
          }`}
        >
          {lastResult.status === "success" && (
            <>
              <div className="result-badge badge-success">ENTRY APPROVED</div>
              <div className="result-details">
                <div className="result-name">{lastResult.full_name}</div>
                <div className="result-meta">
                  Ref ID: <strong>{lastResult.registration_id}</strong> • {lastResult.college_name} ({lastResult.domain})
                </div>
                <div className="result-time">
                  Checked in at: {new Date(lastResult.checked_in_at).toLocaleTimeString()}
                </div>
                {isSheetConnected && (
                  <div style={{ fontSize: 12, color: "#166534", marginTop: 4, fontWeight: 600 }}>
                    ✓ Full participant details and check-in synced to Google Sheet
                  </div>
                )}
              </div>
            </>
          )}

          {lastResult.status === "already_checked_in" && (
            <>
              <div className="result-badge badge-already">ALREADY CHECKED IN</div>
              <div className="result-details">
                <div className="result-name">{lastResult.full_name}</div>
                <div className="result-meta">
                  Ref ID: <strong>{lastResult.registration_id}</strong>
                </div>
                <div className="result-time">
                  Initial Check-in recorded at:{" "}
                  {lastResult.checked_in_at
                    ? new Date(lastResult.checked_in_at).toLocaleTimeString()
                    : "Earlier"}
                </div>
              </div>
            </>
          )}

          {lastResult.status === "not_found" && (
            <>
              <div className="result-badge badge-invalid">INVALID TICKET</div>
              <div className="result-details">
                <div className="result-meta">
                  {lastResult.message || "This QR code does not correspond to any valid registration."}
                </div>
              </div>
            </>
          )}

          {lastResult.status === "error" && (
            <>
              <div className="result-badge badge-error">VERIFICATION FAILED — RETRY</div>
              <div className="result-details">
                <div className="result-meta">{lastResult.message}</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Manual Ticket Lookup Fallback */}
      <div className="manual-lookup-card">
        <div className="manual-lookup-title">Manual Ticket Lookup Fallback</div>
        <form className="manual-lookup-form" onSubmit={handleManualSubmit}>
          <input
            type="text"
            className="manual-lookup-input"
            placeholder="Enter Registration ID (e.g. CLP-8821-K9X2A) or Token..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
          />
          <button
            type="submit"
            className="manual-lookup-btn"
            disabled={isVerifying || !manualCode.trim()}
          >
            {isVerifying ? "Verifying..." : "Validate"}
          </button>
        </form>
      </div>
    </div>
  );
}
