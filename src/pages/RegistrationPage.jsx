import React, { useState } from "react";
import "./RegistrationPage.css";
import {
  DEPARTMENT_OPTIONS,
  DOMAIN_OPTIONS,
  AI_SKILL_OPTIONS,
  PASSOUT_YEAR_OPTIONS,
  validateRegistrationForm,
} from "../lib/validators";
import { registerParticipant } from "../lib/api";
import LoadingSpinner from "../components/LoadingSpinner";

export default function RegistrationPage({ onSuccessRegistration }) {
  const [formData, setFormData] = useState({
    fullName: "",
    phoneNumber: "",
    email: "",
    collegeName: "",
    department: "",
    domain: "",
    passOutYear: "",
    aiSkills: [],
    consent: false,
  });

  // State for dropdown "Others" typing bars
  const [departmentSelect, setDepartmentSelect] = useState("");
  const [customDepartment, setCustomDepartment] = useState("");

  const [domainSelect, setDomainSelect] = useState("");
  const [customDomain, setCustomDomain] = useState("");

  const [passOutYearSelect, setPassOutYearSelect] = useState("");
  const [customPassOutYear, setCustomPassOutYear] = useState("");

  const [customAiSkill, setCustomAiSkill] = useState("");

  const [errors, setErrors] = useState({});
  const [duplicateError, setDuplicateError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    if (duplicateError) {
      setDuplicateError("");
    }
  };

  const handleDepartmentSelectChange = (e) => {
    const val = e.target.value;
    setDepartmentSelect(val);
    if (val === "Others") {
      setFormData((prev) => ({ ...prev, department: customDepartment }));
    } else {
      setFormData((prev) => ({ ...prev, department: val }));
    }
    if (errors.department) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.department;
        return next;
      });
    }
  };

  const handleCustomDepartmentChange = (e) => {
    const val = e.target.value;
    setCustomDepartment(val);
    setFormData((prev) => ({ ...prev, department: val }));
    if (errors.department) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.department;
        return next;
      });
    }
  };

  const handleDomainSelectChange = (e) => {
    const val = e.target.value;
    setDomainSelect(val);
    if (val === "Others") {
      setFormData((prev) => ({ ...prev, domain: customDomain }));
    } else {
      setFormData((prev) => ({ ...prev, domain: val }));
    }
    if (errors.domain) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.domain;
        return next;
      });
    }
  };

  const handleCustomDomainChange = (e) => {
    const val = e.target.value;
    setCustomDomain(val);
    setFormData((prev) => ({ ...prev, domain: val }));
    if (errors.domain) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.domain;
        return next;
      });
    }
  };

  const handlePassOutYearSelectChange = (e) => {
    const val = e.target.value;
    setPassOutYearSelect(val);
    if (val === "Others") {
      setFormData((prev) => ({ ...prev, passOutYear: customPassOutYear }));
    } else {
      setFormData((prev) => ({ ...prev, passOutYear: val }));
    }
    if (errors.passOutYear) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.passOutYear;
        return next;
      });
    }
  };

  const handleCustomPassOutYearChange = (e) => {
    const val = e.target.value;
    setCustomPassOutYear(val);
    setFormData((prev) => ({ ...prev, passOutYear: val }));
    if (errors.passOutYear) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.passOutYear;
        return next;
      });
    }
  };

  const handleSkillToggle = (skill) => {
    setFormData((prev) => {
      let current = [...prev.aiSkills];
      if (skill === "No AI Skills Yet") {
        return {
          ...prev,
          aiSkills: current.includes(skill) ? [] : [skill],
        };
      } else {
        current = current.filter((s) => s !== "No AI Skills Yet");
        if (current.includes(skill)) {
          current = current.filter((s) => s !== skill);
        } else {
          current.push(skill);
        }
        return { ...prev, aiSkills: current };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Resolve final pass out year
    const finalYear = passOutYearSelect === "Others" ? customPassOutYear.trim() : (passOutYearSelect || formData.passOutYear);
    
    // Resolve final department
    const finalDept = departmentSelect === "Others" ? customDepartment.trim() : (departmentSelect || formData.department);

    // Resolve final domain (scroll down selection or typed other)
    const finalDomain = domainSelect === "Others" ? customDomain.trim() : (domainSelect || formData.domain);

    // Resolve AI skills with custom Other text if typed
    let finalSkills = [...formData.aiSkills];
    if (finalSkills.includes("Other") && customAiSkill.trim()) {
      finalSkills = finalSkills.map((s) => (s === "Other" ? `Other: ${customAiSkill.trim()}` : s));
    }

    const submissionPayload = {
      ...formData,
      passOutYear: finalYear,
      department: finalDept,
      domain: finalDomain,
      aiSkills: finalSkills,
    };

    // Validate
    const { isValid, errors: validationErrors } = validateRegistrationForm(submissionPayload);
    if (!isValid) {
      setErrors(validationErrors);
      const firstErrorKey = Object.keys(validationErrors)[0];
      const el = document.getElementById(`field-${firstErrorKey}`);
      if (el) el.focus();
      return;
    }

    setIsSubmitting(true);
    setDuplicateError("");

    try {
      const createdRegistration = await registerParticipant(submissionPayload);
      onSuccessRegistration(createdRegistration);
    } catch (err) {
      console.error("Submission failed:", err);
      if (err.code === "DUPLICATE_REGISTRATION" || err.message?.includes("already registered")) {
        setDuplicateError(err.message);
      } else {
        setDuplicateError(err.message || "Failed to submit registration. Please verify your details.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="registration-page-container">
      <div className="registration-hero">
        <span className="registration-tag">Official Registration</span>
        <h1 className="registration-title">Career Launchpad 2026</h1>
        <p className="registration-subtitle">
          Your next opportunity starts here. Register now to receive your verified digital QR admission pass.
        </p>
      </div>

      <div className="registration-card">
        {duplicateError && (
          <div className="form-duplicate-alert" role="alert">
            <strong>Notice:</strong> {duplicateError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            {/* Full Name */}
            <div className="form-group">
              <label htmlFor="field-fullName" className="form-label form-label-required">
                Full Name
              </label>
              <input
                id="field-fullName"
                name="fullName"
                type="text"
                placeholder="e.g. Senthil Nathan"
                value={formData.fullName}
                onChange={handleChange}
                className={`form-input ${errors.fullName ? "has-error" : ""}`}
                disabled={isSubmitting}
                autoComplete="name"
              />
              {errors.fullName && <span className="form-error-msg">{errors.fullName}</span>}
            </div>

            {/* Email Address */}
            <div className="form-group">
              <label htmlFor="field-email" className="form-label form-label-required">
                Email Address
              </label>
              <input
                id="field-email"
                name="email"
                type="email"
                placeholder="e.g. participant@university.edu"
                value={formData.email}
                onChange={handleChange}
                className={`form-input ${errors.email ? "has-error" : ""}`}
                disabled={isSubmitting}
                autoComplete="email"
              />
              {errors.email && <span className="form-error-msg">{errors.email}</span>}
            </div>

            {/* Phone Number */}
            <div className="form-group">
              <label htmlFor="field-phoneNumber" className="form-label form-label-required">
                Phone Number
              </label>
              <input
                id="field-phoneNumber"
                name="phoneNumber"
                type="tel"
                placeholder="e.g. +91 9876543210"
                value={formData.phoneNumber}
                onChange={handleChange}
                className={`form-input ${errors.phoneNumber ? "has-error" : ""}`}
                disabled={isSubmitting}
                autoComplete="tel"
              />
              {errors.phoneNumber && <span className="form-error-msg">{errors.phoneNumber}</span>}
            </div>

            {/* College Name */}
            <div className="form-group">
              <label htmlFor="field-collegeName" className="form-label form-label-required">
                College Name
              </label>
              <input
                id="field-collegeName"
                name="collegeName"
                type="text"
                placeholder="e.g. Government College of Technology"
                value={formData.collegeName}
                onChange={handleChange}
                className={`form-input ${errors.collegeName ? "has-error" : ""}`}
                disabled={isSubmitting}
              />
              {errors.collegeName && <span className="form-error-msg">{errors.collegeName}</span>}
            </div>

            {/* Department (Dropdown with Others option revealing typing bar) */}
            <div className="form-group">
              <label htmlFor="field-department" className="form-label form-label-required">
                Department
              </label>
              <select
                id="field-department"
                name="department"
                value={departmentSelect}
                onChange={handleDepartmentSelectChange}
                className={`form-select ${errors.department ? "has-error" : ""}`}
                disabled={isSubmitting}
              >
                <option value="">Select Department...</option>
                {DEPARTMENT_OPTIONS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              {/* Typing bar if Others selected */}
              {departmentSelect === "Others" && (
                <div className="other-typing-wrapper">
                  <input
                    type="text"
                    className="form-sub-input"
                    placeholder="Type your department (e.g. Biotechnology, Chemical)..."
                    value={customDepartment}
                    onChange={handleCustomDepartmentChange}
                    disabled={isSubmitting}
                    autoFocus
                  />
                </div>
              )}
              {errors.department && <span className="form-error-msg">{errors.department}</span>}
            </div>

            {/* Domain (Scroll Down / Dropdown + Others Typing Bar) */}
            <div className="form-group">
              <label htmlFor="field-domain" className="form-label form-label-required">
                Domain
              </label>
              <select
                id="field-domain"
                name="domain"
                value={domainSelect}
                onChange={handleDomainSelectChange}
                className={`form-select ${errors.domain ? "has-error" : ""}`}
                disabled={isSubmitting}
              >
                <option value="">Select Domain...</option>
                {DOMAIN_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              {/* Typing bar if Others selected */}
              {domainSelect === "Others" && (
                <div className="other-typing-wrapper">
                  <input
                    type="text"
                    className="form-sub-input"
                    placeholder="Type your domain of specialization (e.g. Game Development, AR/VR, Embedded)..."
                    value={customDomain}
                    onChange={handleCustomDomainChange}
                    disabled={isSubmitting}
                    autoFocus
                  />
                </div>
              )}
              {errors.domain && <span className="form-error-msg">{errors.domain}</span>}
            </div>

            {/* Year of Pass Out (Dropdown + Others Typing Bar) */}
            <div className="form-group">
              <label htmlFor="field-passOutYear" className="form-label form-label-required">
                Year of Pass Out
              </label>
              <select
                id="field-passOutYear"
                name="passOutYear"
                value={passOutYearSelect}
                onChange={handlePassOutYearSelectChange}
                className={`form-select ${errors.passOutYear ? "has-error" : ""}`}
                disabled={isSubmitting}
              >
                <option value="">Select Year...</option>
                {PASSOUT_YEAR_OPTIONS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>

              {/* Typing bar if Others selected */}
              {passOutYearSelect === "Others" && (
                <div className="other-typing-wrapper">
                  <input
                    type="text"
                    className="form-sub-input"
                    placeholder="Type your graduation year (e.g. 2022, 2029)..."
                    value={customPassOutYear}
                    onChange={handleCustomPassOutYearChange}
                    disabled={isSubmitting}
                    autoFocus
                  />
                </div>
              )}
              {errors.passOutYear && <span className="form-error-msg">{errors.passOutYear}</span>}
            </div>

            {/* AI Skill Set */}
            <div className="form-group-full">
              <label className="form-label">AI Skill Set (Select all that apply)</label>
              <div className="skills-checkbox-grid">
                {AI_SKILL_OPTIONS.map((skill) => (
                  <label key={skill} className="checkbox-label">
                    <input
                      type="checkbox"
                      className="checkbox-input"
                      checked={formData.aiSkills.includes(skill)}
                      onChange={() => handleSkillToggle(skill)}
                      disabled={isSubmitting}
                    />
                    <span>{skill}</span>
                  </label>
                ))}
              </div>

              {/* Typing bar if 'Other' is checked in AI Skills */}
              {formData.aiSkills.includes("Other") && (
                <div className="other-typing-wrapper" style={{ marginTop: 8 }}>
                  <input
                    type="text"
                    className="form-sub-input"
                    placeholder="Type your other AI skill sets (e.g. Reinforcement Learning, MLOps, Audio AI)..."
                    value={customAiSkill}
                    onChange={(e) => setCustomAiSkill(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              )}
            </div>

            {/* Required Consent Checkbox */}
            <div className="form-group-full">
              <div className="consent-box">
                <input
                  id="field-consent"
                  name="consent"
                  type="checkbox"
                  className="checkbox-input"
                  checked={formData.consent}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
                <label htmlFor="field-consent" className="consent-text">
                  I hereby confirm my registration for Career Launchpad and consent to the collection
                  and processing of my details for event attendance management and digital ticketing.
                </label>
              </div>
              {errors.consent && (
                <span className="form-error-msg" style={{ marginTop: 6, display: "block" }}>
                  {errors.consent}
                </span>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="btn-submit-registration"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Processing Registration & Issuing Pass...</span>
              </>
            ) : (
              <span>Complete Registration & Issue Ticket</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
