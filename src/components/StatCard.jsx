import React from "react";
import "./StatCard.css";

export default function StatCard({ title, value, subtitle, icon: Icon, alertType, onClick, active }) {
  const alertClass = alertType ? `alert-${alertType}` : "";
  const clickableClass = onClick ? "stat-card-clickable" : "";
  const activeClass = active ? "stat-card-active" : "";

  return (
    <div
      className={`stat-card ${alertClass} ${clickableClass} ${activeClass}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
    >
      <div className="stat-card-header">
        <span className="stat-card-title">{title}</span>
        {Icon && <Icon size={18} className="stat-card-icon" />}
      </div>
      <div className="stat-card-value">{value}</div>
      {subtitle && <div className="stat-card-subtitle">{subtitle}</div>}
      {onClick && <span className="stat-card-click-hint">Click to filter</span>}
    </div>
  );
}
