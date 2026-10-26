import React from "react";
import "./LoadingSpinner.css";

export default function LoadingSpinner({ size = "md", text = "" }) {
  const sizeClass = size === "sm" ? "loading-spinner-sm" : size === "lg" ? "loading-spinner-lg" : "";

  return (
    <div className="loading-spinner-container">
      <div className={`loading-spinner ${sizeClass}`} />
      {text && <span className="loading-spinner-text">{text}</span>}
    </div>
  );
}
