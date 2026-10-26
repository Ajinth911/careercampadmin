
import { supabase, isSupabaseConfigured } from "./supabase.js";
import { normalizeEmail, normalizePhone, validateRegistrationForm } from "./validators.js";
import { syncRegistrationToSheet, syncAttendanceToSheet } from "./googleSheets.js";

const memoryStore = {};
function getStore() {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  if (typeof globalThis !== "undefined" && globalThis.localStorage) return globalThis.localStorage;
  return {
    getItem: (k) => memoryStore[k] || null,
    setItem: (k, v) => { memoryStore[k] = String(v); },
    removeItem: (k) => { delete memoryStore[k]; },
    clear: () => { for (const k in memoryStore) delete memoryStore[k]; },
  };
}

// Safe check for test environment (e.g. Vitest mock unit tests)
const isRunningInTest =
  typeof process !== "undefined" &&
  (Boolean(process.env?.VITEST) || process.env?.NODE_ENV === "test");

const LOCAL_STORAGE_KEY_REGS = "clp_registrations";
const LOCAL_STORAGE_KEY_EMAILS = "clp_email_jobs";
const LOCAL_STORAGE_KEY_INTEGRATIONS = "clp_integration_jobs";
const LOCAL_STORAGE_KEY_AUDIT = "clp_audit_logs";

// Web Crypto SHA-256 helper
async function sha256Hex(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// Initial seed data for local development if empty
function initializeLocalStorage() {
  if (!getStore().getItem(LOCAL_STORAGE_KEY_REGS)) {
    const seed = [
      {
        id: "d9e8f7a6-b5c4-4321-9876-543210fedcba",
        registration_id: "CLP-8821-K9X2A",
        full_name: "Aravind Kumar",
        email: "aravind.kumar@example.com",
        normalized_email: "aravind.kumar@example.com",
        phone_number: "+91 9876543210",
        normalized_phone: "919876543210",
        college_name: "PSG College of Technology",
        pass_out_year: 2025,
        domain: "Artificial Intelligence and Data Science",
        ai_skills: ["Machine Learning", "Generative AI and LLMs"],
        ticket_token_hash: "a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0",
        email_status: "sent",
        attendance_status: "not_checked_in",
        registered_at: new Date(Date.now() - 3600000 * 5).toISOString(),
        checked_in_at: null,
      },
      {
        id: "c8d7e6f5-a4b3-4210-8765-432109fedcba",
        registration_id: "CLP-7714-M4P9Q",
        full_name: "Sneha Raman",
        email: "sneha.raman@example.com",
        normalized_email: "sneha.raman@example.com",
        phone_number: "+91 9845012345",
        normalized_phone: "919845012345",
        college_name: "Anna University",
        pass_out_year: 2024,
        domain: "Computer Science Engineering",
        ai_skills: ["Deep Learning", "Computer Vision"],
        ticket_token_hash: "b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef01",
        email_status: "sent",
        attendance_status: "checked_in",
        registered_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        checked_in_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
    ];
    getStore().setItem(LOCAL_STORAGE_KEY_REGS, JSON.stringify(seed));
  }

  if (!getStore().getItem(LOCAL_STORAGE_KEY_EMAILS)) {
    getStore().setItem(LOCAL_STORAGE_KEY_EMAILS, JSON.stringify([]));
  }
  if (!getStore().getItem(LOCAL_STORAGE_KEY_INTEGRATIONS)) {
    getStore().setItem(LOCAL_STORAGE_KEY_INTEGRATIONS, JSON.stringify([]));
  }
  if (!getStore().getItem(LOCAL_STORAGE_KEY_AUDIT)) {
    getStore().setItem(LOCAL_STORAGE_KEY_AUDIT, JSON.stringify([]));
  }
}

// Call init once
initializeLocalStorage();

/**
 * Register Participant API
 */
export async function registerParticipant(formData) {
  // Client-side pre-validation
  const { isValid, errors } = validateRegistrationForm(formData);
  if (!isValid) {
    const firstErr = Object.values(errors)[0];
    throw new Error(firstErr || "Invalid form data");
  }

  const normEmail = normalizeEmail(formData.email);
  const normPhone = normalizePhone(formData.phoneNumber);

  // Generate tokens
  const timestampPart = Date.now().toString().slice(-4);
  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  const registrationId = `CLP-${timestampPart}-${randomSuffix}`;
  const rawTicketToken = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)) +
    (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2));
  const tokenHash = await sha256Hex(rawTicketToken);

  // If Supabase is configured and not running in Vitest test suite, insert into Supabase PostgreSQL table
  if (isSupabaseConfigured && supabase && !isRunningInTest) {
    // 1. Pre-check for duplicate email or phone in Supabase
    const { data: existingRecords } = await supabase
      .from("registrations")
      .select("registration_id, normalized_email, normalized_phone")
      .or(`normalized_email.eq.${normEmail},normalized_phone.eq.${normPhone}`);

    if (existingRecords && existingRecords.length > 0) {
      const match = existingRecords[0];
      const isEmail = match.normalized_email === normEmail;
      const err = new Error(
        isEmail
          ? "A participant with this email address has already registered for Career Launchpad."
          : "A participant with this phone number has already registered for Career Launchpad."
      );
      err.code = "DUPLICATE_REGISTRATION";
      throw err;
    }

    const deptValue = (formData.department || formData.domain || "").trim();
    const domainValue = (formData.domain || formData.department || "").trim();
    const formattedDomain =
      deptValue && domainValue && deptValue !== domainValue
        ? `${domainValue} (${deptValue})`
        : domainValue || deptValue;

    // 2. Direct insert into Supabase PostgreSQL table
    const primaryPayload = {
      registration_id: registrationId,
      full_name: formData.fullName.trim(),
      phone_number: formData.phoneNumber.trim(),
      normalized_phone: normPhone,
      email: formData.email.trim(),
      normalized_email: normEmail,
      college_name: formData.collegeName.trim(),
      pass_out_year: parseInt(formData.passOutYear, 10) || formData.passOutYear,
      domain: formattedDomain,
      ai_skills: formData.aiSkills || [],
      ticket_token_hash: tokenHash,
      email_status: "pending",
      attendance_status: "not_checked_in",
    };

    let { data: inserted, error: insertError } = await supabase
      .from("registrations")
      .insert(primaryPayload)
      .select()
      .single();

    if (!insertError && inserted) {
      syncRegistrationToSheet(inserted).catch(() => {});
      return {
        ...inserted,
        ticket_token: rawTicketToken,
      };
    }

    if (insertError) {
      if (insertError.code === "23505") {
        const err = new Error("This email address or phone number is already registered.");
        err.code = "DUPLICATE_REGISTRATION";
        throw err;
      }
      if (insertError.code === "42501") {
        throw new Error("Row Level Security blocked registration. Please run the SQL policy in your Supabase SQL editor (see instructions).");
      }
      throw new Error(insertError.message || "Failed to save registration in Supabase.");
    }
  }

  // Local Storage Mock Provider for development/testing
  const regs = JSON.parse(getStore().getItem(LOCAL_STORAGE_KEY_REGS) || "[]");

  // Duplicate checks
  const existingEmail = regs.find(r => r.normalized_email === normEmail);
  if (existingEmail) {
    const err = new Error("A participant with this email address has already registered for Career Launchpad.");
    err.code = "DUPLICATE_REGISTRATION";
    throw err;
  }

  const existingPhone = regs.find(r => r.normalized_phone === normPhone);
  if (existingPhone) {
    const err = new Error("A participant with this phone number has already registered for Career Launchpad.");
    err.code = "DUPLICATE_REGISTRATION";
    throw err;
  }

  const deptValue = (formData.department || formData.domain || "").trim();
  const domainValue = (formData.domain || formData.department || "").trim();

  const newReg = {
    id: crypto.randomUUID ? crypto.randomUUID() : `reg-${Date.now()}`,
    registration_id: registrationId,
    full_name: formData.fullName.trim(),
    phone_number: formData.phoneNumber.trim(),
    normalized_phone: normPhone,
    email: formData.email.trim(),
    normalized_email: normEmail,
    college_name: formData.collegeName.trim(),
    pass_out_year: parseInt(formData.passOutYear, 10) || formData.passOutYear,
    department: deptValue,
    domain: domainValue,
    ai_skills: formData.aiSkills || [],
    ticket_token_hash: tokenHash,
    email_status: "sent",
    attendance_status: "not_checked_in",
    registered_at: new Date().toISOString(),
    checked_in_at: null,
    checked_in_by: null,
  };

  regs.unshift(newReg);
  getStore().setItem(LOCAL_STORAGE_KEY_REGS, JSON.stringify(regs));

  // Add job records
  const emails = JSON.parse(getStore().getItem(LOCAL_STORAGE_KEY_EMAILS) || "[]");
  emails.push({
    id: `email-${Date.now()}`,
    registration_id: registrationId,
    recipient_email: normEmail,
    status: "sent",
    attempts: 1,
    created_at: new Date().toISOString(),
  });
  getStore().setItem(LOCAL_STORAGE_KEY_EMAILS, JSON.stringify(emails));

  const sheets = JSON.parse(getStore().getItem(LOCAL_STORAGE_KEY_INTEGRATIONS) || "[]");
  sheets.push({
    id: `sheet-${Date.now()}`,
    registration_id: registrationId,
    job_type: "insert_row",
    status: "synced",
    attempts: 1,
    created_at: new Date().toISOString(),
  });
  getStore().setItem(LOCAL_STORAGE_KEY_INTEGRATIONS, JSON.stringify(sheets));

  syncRegistrationToSheet(newReg).catch(() => {});

  return {
    ...newReg,
    ticket_token: rawTicketToken,
  };
}

/**
 * Verify Ticket Token or Registration ID
 */
export async function verifyTicket({ token, registrationId }) {
  if (isSupabaseConfigured && supabase && !isRunningInTest) {
    try {
      let tokenHash = "";
      let regId = registrationId ? registrationId.trim() : "";
      let participantRecord = null;

      if (token && (token.toUpperCase().startsWith("CLP-") || token.toUpperCase().startsWith("GL-"))) {
        regId = token.trim();
      }

      if (regId) {
        const { data: reg } = await supabase
          .from("registrations")
          .select("*")
          .ilike("registration_id", regId)
          .maybeSingle();

        if (reg) {
          participantRecord = reg;
          tokenHash = reg.ticket_token_hash;
        }
      }

      if (!tokenHash && token) {
        tokenHash = await sha256Hex(token.trim());
      }

      if (!participantRecord && tokenHash) {
        const { data: reg } = await supabase
          .from("registrations")
          .select("*")
          .eq("ticket_token_hash", tokenHash)
          .maybeSingle();
        if (reg) {
          participantRecord = reg;
        }
      }

      if (tokenHash) {
        const { data: rpcResult, error: rpcError } = await supabase.rpc("check_in_participant", {
          p_token_hash: tokenHash,
          p_admin_id: null,
        });

        if (!rpcError && rpcResult) {
          const checkInTime = rpcResult.checked_in_at || new Date().toISOString();
          const fullAttendanceData = {
            ...(participantRecord || {}),
            ...rpcResult,
            checked_in_at: checkInTime,
          };
          syncAttendanceToSheet(fullAttendanceData, checkInTime).catch((err) => {
            console.error("Attendance sync to Google Sheet failed:", err);
          });
          return fullAttendanceData;
        }
      }

      if (!tokenHash && token) {
        const { data: regByToken } = await supabase
          .from("registrations")
          .select("*")
          .ilike("registration_id", token.trim())
          .maybeSingle();

        if (regByToken && regByToken.ticket_token_hash) {
          const { data: rpcResult, error: rpcError } = await supabase.rpc("check_in_participant", {
            p_token_hash: regByToken.ticket_token_hash,
            p_admin_id: null,
          });
          if (!rpcError && rpcResult) {
            const checkInTime = rpcResult.checked_in_at || new Date().toISOString();
            const fullAttendanceData = {
              ...regByToken,
              ...rpcResult,
              checked_in_at: checkInTime,
            };
            syncAttendanceToSheet(fullAttendanceData, checkInTime).catch((err) => {
              console.error("Attendance sync to Google Sheet failed:", err);
            });
            return fullAttendanceData;
          }
        }
      }
    } catch (e) {
      console.warn("Direct Supabase verification check encountered error, checking local store:", e);
    }
  }

  // Local Storage verification logic
  const regs = JSON.parse(getStore().getItem(LOCAL_STORAGE_KEY_REGS) || "[]");
  let participant = null;

  if (token) {
    const tokenHash = await sha256Hex(token.trim());
    participant = regs.find(r => r.ticket_token_hash === tokenHash);
  } else if (registrationId) {
    participant = regs.find(r => r.registration_id.toLowerCase() === registrationId.trim().toLowerCase());
  }

  if (!participant) {
    return {
      status: "not_found",
      message: "Invalid ticket token. No participant matches this code.",
    };
  }

  if (participant.attendance_status === "checked_in") {
    return {
      status: "already_checked_in",
      registration_id: participant.registration_id,
      full_name: participant.full_name,
      college_name: participant.college_name,
      domain: participant.domain,
      checked_in_at: participant.checked_in_at,
    };
  }

  // Atomically update attendance
  const checkInTime = new Date().toISOString();
  participant.attendance_status = "checked_in";
  participant.checked_in_at = checkInTime;
  participant.checked_in_by = "Admin Desk (Local)";

  getStore().setItem(LOCAL_STORAGE_KEY_REGS, JSON.stringify(regs));

  // Queue Google Sheets update job
  const sheets = JSON.parse(getStore().getItem(LOCAL_STORAGE_KEY_INTEGRATIONS) || "[]");
  sheets.unshift({
    id: `sheet-${Date.now()}`,
    registration_id: participant.registration_id,
    job_type: "update_attendance",
    status: "synced",
    attempts: 1,
    created_at: checkInTime,
  });
  getStore().setItem(LOCAL_STORAGE_KEY_INTEGRATIONS, JSON.stringify(sheets));

  // Add audit log
  const audit = JSON.parse(getStore().getItem(LOCAL_STORAGE_KEY_AUDIT) || "[]");
  audit.unshift({
    id: `audit-${Date.now()}`,
    action: "check_in",
    performed_by: "Administrator",
    target_registration_id: participant.registration_id,
    details: { time: checkInTime, method: "qr_scanner" },
    created_at: checkInTime,
  });
  getStore().setItem(LOCAL_STORAGE_KEY_AUDIT, JSON.stringify(audit));

  syncAttendanceToSheet(participant, checkInTime).catch(() => {});

  return {
    status: "success",
    registration_id: participant.registration_id,
    full_name: participant.full_name,
    college_name: participant.college_name,
    domain: participant.domain,
    checked_in_at: checkInTime,
  };
}

/**
 * Fetch registrations with search, filter, and pagination
 */
export async function fetchRegistrations({
  search = "",
  domain = "",
  passOutYear = "",
  attendanceStatus = "",
  page = 1,
  pageSize = 10,
}) {
  if (isSupabaseConfigured && supabase && !isRunningInTest) {
    let query = supabase.from("registrations").select("*", { count: "exact" });

    if (search.trim()) {
      const s = search.trim();
      query = query.or(
        `full_name.ilike.%${s}%,email.ilike.%${s}%,phone_number.ilike.%${s}%,registration_id.ilike.%${s}%`
      );
    }
    if (domain) {
      query = query.eq("domain", domain);
    }
    if (passOutYear) {
      query = query.eq("pass_out_year", parseInt(passOutYear, 10));
    }
    if (attendanceStatus) {
      query = query.eq("attendance_status", attendanceStatus);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await query
      .order("registered_at", { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    return {
      records: data || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  }

  // Local Storage filtering & pagination
  const regs = JSON.parse(getStore().getItem(LOCAL_STORAGE_KEY_REGS) || "[]");

  let filtered = [...regs];

  if (search.trim()) {
    const s = search.trim().toLowerCase();
    filtered = filtered.filter(
      r =>
        r.full_name?.toLowerCase().includes(s) ||
        r.email?.toLowerCase().includes(s) ||
        r.phone_number?.includes(s) ||
        r.registration_id?.toLowerCase().includes(s) ||
        r.college_name?.toLowerCase().includes(s) ||
        r.department?.toLowerCase().includes(s) ||
        r.domain?.toLowerCase().includes(s)
    );
  }

  if (domain) {
    filtered = filtered.filter(
      r =>
        (r.department && r.department === domain) ||
        (r.domain && r.domain.toLowerCase().includes(domain.toLowerCase()))
    );
  }

  if (passOutYear) {
    filtered = filtered.filter(r => String(r.pass_out_year) === String(passOutYear));
  }

  if (attendanceStatus) {
    filtered = filtered.filter(r => r.attendance_status === attendanceStatus);
  }

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const records = filtered.slice(start, start + pageSize);

  return {
    records,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

/**
 * Fetch Admin Dashboard Metrics
 */
export async function fetchDashboardStats() {
  if (isSupabaseConfigured && supabase) {
    const { count: totalRegs } = await supabase.from("registrations").select("*", { count: "exact", head: true });
    const { count: checkedIn } = await supabase
      .from("registrations")
      .select("*", { count: "exact", head: true })
      .eq("attendance_status", "checked_in");
    const { count: failedEmails } = await supabase
      .from("registrations")
      .select("*", { count: "exact", head: true })
      .eq("email_status", "failed");
    const { count: pendingSheets } = await supabase
      .from("integration_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    const total = totalRegs || 0;
    const attended = checkedIn || 0;

    return {
      totalRegistrations: total,
      checkedIn: attended,
      notCheckedIn: Math.max(0, total - attended),
      failedEmails: failedEmails || 0,
      pendingSheetsSync: pendingSheets || 0,
    };
  }

  // Local Storage counts
  const regs = JSON.parse(getStore().getItem(LOCAL_STORAGE_KEY_REGS) || "[]");
  const sheets = JSON.parse(getStore().getItem(LOCAL_STORAGE_KEY_INTEGRATIONS) || "[]");

  const total = regs.length;
  const attended = regs.filter(r => r.attendance_status === "checked_in").length;
  const failedEmails = regs.filter(r => r.email_status === "failed").length;
  const pendingSheets = sheets.filter(s => s.status === "pending").length;

  return {
    totalRegistrations: total,
    checkedIn: attended,
    notCheckedIn: total - attended,
    failedEmails,
    pendingSheetsSync: pendingSheets,
  };
}

/**
 * Resend Ticket Email
 */
export async function resendTicketEmail(registrationId) {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.functions.invoke("resend-ticket", {
      body: { registrationId },
    });
    if (error) throw new Error(error.message);
    return data;
  }

  // Local storage simulation
  const regs = JSON.parse(getStore().getItem(LOCAL_STORAGE_KEY_REGS) || "[]");
  const reg = regs.find(r => r.registration_id === registrationId);
  if (!reg) throw new Error("Participant not found.");

  reg.email_status = "sent";
  getStore().setItem(LOCAL_STORAGE_KEY_REGS, JSON.stringify(regs));

  return { success: true, message: "Ticket re-sent successfully." };
}

/**
 * Export Registrations to CSV
 */
export function exportRegistrationsToCSV(records) {
  const headers = [
    "Registration ID",
    "Full Name",
    "Phone Number",
    "Email Address",
    "College Name",
    "Department",
    "Domain",
    "Pass Out Year",
    "AI Skills",
    "Registration Date",
    "Email Status",
    "Attendance Status",
    "Check-in Time",
  ];

  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '""';
    let str = String(value);
    // Protect against spreadsheet formula injection
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }
    return `"${str.replace(/"/g, '""')}"`;
  };

  const rows = records.map(r => [
    escapeCSV(r.registration_id),
    escapeCSV(r.full_name),
    escapeCSV(r.phone_number),
    escapeCSV(r.email),
    escapeCSV(r.college_name),
    escapeCSV(r.department || r.domain),
    escapeCSV(r.domain || r.department),
    escapeCSV(r.pass_out_year),
    escapeCSV(Array.isArray(r.ai_skills) ? r.ai_skills.join(", ") : ""),
    escapeCSV(new Date(r.registered_at).toLocaleString()),
    escapeCSV(r.email_status),
    escapeCSV(r.attendance_status),
    escapeCSV(r.checked_in_at ? new Date(r.checked_in_at).toLocaleString() : "Not Checked In"),
  ]);

  const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `career_launchpad_participants_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
