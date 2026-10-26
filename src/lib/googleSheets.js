// Google Sheets Sync Client
// Handles real-time appending and attendance updating for Google Spreadsheets.

const WEBHOOK_STORAGE_KEY = "clp_google_sheets_webhook_url";

export function getGoogleSheetsWebhookUrl() {
  const envUrl =
    import.meta.env.VITE_GOOGLE_SHEETS_WEBHOOK_URL ||
    import.meta.env.VITE_GOOGLE_SHEETS_URL ||
    import.meta.env.VITE_GOOGLE_SHEET_URL;
  if (envUrl && typeof envUrl === "string" && envUrl.startsWith("http")) return envUrl.trim();
  return (
    localStorage.getItem(WEBHOOK_STORAGE_KEY) ||
    localStorage.getItem("clp_google_sheets_webhook_url") ||
    localStorage.getItem("google_sheets_url") ||
    ""
  );
}

export function setGoogleSheetsWebhookUrl(url) {
  if (url && url.trim()) {
    const trimmed = url.trim();
    localStorage.setItem(WEBHOOK_STORAGE_KEY, trimmed);
    localStorage.setItem("clp_google_sheets_webhook_url", trimmed);
    localStorage.setItem("google_sheets_url", trimmed);
  } else {
    localStorage.removeItem(WEBHOOK_STORAGE_KEY);
    localStorage.removeItem("clp_google_sheets_webhook_url");
    localStorage.removeItem("google_sheets_url");
  }
}

// Sanitize against spreadsheet formula injection
function sanitizeSheetValue(value) {
  if (value === null || value === undefined) return "";
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Appends a newly registered participant to the Google Sheet.
 */
export async function syncRegistrationToSheet(participant) {
  const webhookUrl = getGoogleSheetsWebhookUrl();
  if (!webhookUrl) return { skipped: true, message: "Google Sheets Webhook URL not configured" };

  try {
    const isObj = typeof participant === "object" && participant !== null;
    const regId = isObj ? (participant.registration_id || participant.registrationId || participant.ticketId) : participant;
    const fullName = isObj ? (participant.full_name || participant.fullName || participant.name) : "";
    const phone = isObj ? (participant.phone_number || participant.phoneNumber || participant.phone) : "";
    const email = isObj ? participant.email : "";
    const college = isObj ? (participant.college_name || participant.collegeName || participant.college) : "";
    const year = isObj ? (participant.pass_out_year || participant.passOutYear || participant.year) : "";
    const department = isObj ? (participant.department || participant.domain) : "";
    const domain = isObj ? (participant.domain || participant.department || participant.roleStatus) : "";
    const skills = isObj
      ? (Array.isArray(participant.ai_skills) ? participant.ai_skills.join(", ") : participant.ai_skills || participant.aiSkills || "")
      : "";

    const regDate = new Date(participant.registered_at || Date.now()).toLocaleString();

    const payload = {
      action: "insert_registration",
      sheetName: "Registrations",
      registrationId: sanitizeSheetValue(regId),
      ticketId: sanitizeSheetValue(regId),
      fullName: sanitizeSheetValue(fullName),
      name: sanitizeSheetValue(fullName),
      phoneNumber: phone ? `'${sanitizeSheetValue(phone)}` : "",
      phone: phone ? `'${sanitizeSheetValue(phone)}` : "",
      email: sanitizeSheetValue(email),
      collegeName: sanitizeSheetValue(college),
      college: sanitizeSheetValue(college),
      passOutYear: year,
      year: year,
      department: sanitizeSheetValue(department),
      domain: sanitizeSheetValue(domain),
      roleStatus: sanitizeSheetValue(domain || department),
      aiSkills: sanitizeSheetValue(skills),
      registrationDate: regDate,
      timestamp: regDate,
      emailStatus: participant.email_status || "sent",
      attendanceStatus: participant.attendance_status || "not_checked_in",
      checkInTime: "",
      checkedInBy: "",
    };

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      mode: "no-cors",
    });

    return { success: true };
  } catch (err) {
    console.error("Google Sheets sync error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Sends full participant details and check-in timestamp to the Google Sheet upon QR scan.
 * Automatically inserts or updates row.
 */
export async function syncAttendanceToSheet(participant, checkInTime, checkedInBy = "Entrance Gate Scanner") {
  const webhookUrl = getGoogleSheetsWebhookUrl();
  if (!webhookUrl) {
    console.warn("[GoogleSheets] Webhook URL not configured. Cannot sync attendance.");
    return { skipped: true, message: "Google Sheets Webhook URL not configured" };
  }

  try {
    const isObj = typeof participant === "object" && participant !== null;
    const regId = isObj ? (participant.registration_id || participant.registrationId || participant.ticketId) : participant;
    const fullName = isObj ? (participant.full_name || participant.fullName || participant.name) : "";
    const phone = isObj ? (participant.phone_number || participant.phoneNumber || participant.phone) : "";
    const email = isObj ? participant.email : "";
    const college = isObj ? (participant.college_name || participant.collegeName || participant.college) : "";
    const year = isObj ? (participant.pass_out_year || participant.passOutYear || participant.year) : "";
    const department = isObj ? (participant.department || participant.domain) : "";
    const domain = isObj ? (participant.domain || participant.department || participant.roleStatus) : "";
    const skills = isObj
      ? (Array.isArray(participant.ai_skills) ? participant.ai_skills.join(", ") : participant.ai_skills || participant.aiSkills || "")
      : "";

    const formattedTime = new Date(checkInTime || Date.now()).toLocaleString();

    const payload = {
      action: "check_in_scan",
      type: "check_in",
      sheetName: "Registrations",
      
      registrationId: sanitizeSheetValue(regId),
      ticketId: sanitizeSheetValue(regId),
      
      fullName: sanitizeSheetValue(fullName),
      name: sanitizeSheetValue(fullName),
      
      phoneNumber: phone ? `'${sanitizeSheetValue(phone)}` : "",
      phone: phone ? `'${sanitizeSheetValue(phone)}` : "",
      
      email: sanitizeSheetValue(email),
      
      collegeName: sanitizeSheetValue(college),
      college: sanitizeSheetValue(college),
      
      passOutYear: year,
      year: year,
      
      department: sanitizeSheetValue(department),
      domain: sanitizeSheetValue(domain),
      roleStatus: sanitizeSheetValue(domain || department),
      
      aiSkills: sanitizeSheetValue(skills),
      
      attendanceStatus: "checked_in",
      status: "checked_in",
      
      checkInTime: formattedTime,
      timestamp: formattedTime,
      checkedInBy: sanitizeSheetValue(checkedInBy),
    };

    console.log("[GoogleSheets] Sending attendance sync payload:", payload);

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      mode: "no-cors",
    });

    return { success: true };
  } catch (err) {
    console.error("Google Sheets attendance update error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Google Apps Script Template code for the user to paste into their Google Sheet
 */
export const GOOGLE_APPS_SCRIPT_TEMPLATE = `// -------------------------------------------------------------
// Career Launchpad — Real-Time Google Sheets Webhook Script
// Paste this code in Google Sheets -> Extensions -> Apps Script
// Deploy as: Web app -> Execute as: Me -> Who has access: Anyone
// -------------------------------------------------------------

function getTargetSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Registrations") || ss.getSheetByName("VIPS") || ss.getActiveSheet();
  if (!sheet) {
    sheet = ss.insertSheet("Registrations");
  }
  return sheet;
}

function setupSheet() {
  var sheet = getTargetSheet();
  var defaultHeaders = [
    "Registration ID",
    "Full Name",
    "Phone Number",
    "Email",
    "College Name",
    "Year of Pass Out",
    "Department",
    "Domain",
    "AI Skill Set",
    "Registration Date",
    "Email Status",
    "Attendance Status",
    "Check-in Time",
    "Checked-in By"
  ];
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(defaultHeaders);
    sheet.getRange(1, 1, 1, defaultHeaders.length)
      .setFontWeight("bold")
      .setBackground("#111111")
      .setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }
}

function doPost(e) {
  try {
    setupSheet();
    var sheet = getTargetSheet();
    var data = JSON.parse(e.postData.contents);
    
    var regId = String(data.registrationId || data.ticketId || "").trim();
    var fullName = String(data.fullName || data.name || "").trim();
    var phone = String(data.phoneNumber || data.phone || "").trim();
    var email = String(data.email || "").trim();
    var college = String(data.collegeName || data.college || "").trim();
    var passYear = String(data.passOutYear || data.year || "").trim();
    var department = String(data.department || "").trim();
    var domain = String(data.domain || data.roleStatus || "").trim();
    var skills = String(data.aiSkills || "").trim();
    var checkInTime = String(data.checkInTime || data.timestamp || new Date().toLocaleString()).trim();
    var checkedInBy = String(data.checkedInBy || "Gate Scanner").trim();
    var regDate = String(data.registrationDate || checkInTime).trim();
    
    var values = sheet.getDataRange().getValues();
    var headers = values.length > 0 ? values[0].map(function(h) { return String(h).trim().toLowerCase(); }) : [];
    
    // Find column indexes
    var regCol = -1;
    var statusCol = -1;
    var timeCol = -1;
    var byCol = -1;
    
    for (var c = 0; c < headers.length; c++) {
      var h = headers[c];
      if (h.indexOf("registration") !== -1 || h.indexOf("ticket") !== -1 || h.indexOf("passcode") !== -1 || h.indexOf("id") !== -1) {
        if (regCol === -1) regCol = c;
      }
      if (h.indexOf("attendance") !== -1 || h === "status") {
        statusCol = c;
      }
      if (h.indexOf("check-in time") !== -1 || h.indexOf("checkin") !== -1 || (h.indexOf("time") !== -1 && h.indexOf("reg") === -1)) {
        timeCol = c;
      }
      if (h.indexOf("checked-in by") !== -1 || h.indexOf("scanner") !== -1) {
        byCol = c;
      }
    }
    
    // Default to Column 1 (index 0) for Registration ID if not identified
    if (regCol === -1) regCol = 0;
    
    // Search for existing participant row
    var foundRow = -1;
    if (regId) {
      for (var r = 1; r < values.length; r++) {
        var rowVal = String(values[r][regCol]).trim().toUpperCase();
        if (rowVal === regId.toUpperCase()) {
          foundRow = r + 1;
          break;
        }
        if (email && values[r][3] && String(values[r][3]).trim().toLowerCase() === email.toLowerCase()) {
          foundRow = r + 1;
          break;
        }
      }
    }
    
    var isCheckIn = data.action === "check_in_scan" || data.action === "update_attendance" || data.type === "check_in" || data.attendanceStatus === "checked_in";
    
    if (isCheckIn) {
      if (foundRow > 0) {
        // Ensure status and time columns exist
        if (statusCol === -1) {
          statusCol = headers.length;
          sheet.getRange(1, statusCol + 1).setValue("Attendance Status").setFontWeight("bold");
          headers.push("attendance status");
        }
        if (timeCol === -1) {
          timeCol = headers.length;
          sheet.getRange(1, timeCol + 1).setValue("Check-in Time").setFontWeight("bold");
          headers.push("check-in time");
        }
        if (byCol === -1) {
          byCol = headers.length;
          sheet.getRange(1, byCol + 1).setValue("Checked-in By").setFontWeight("bold");
          headers.push("checked-in by");
        }
        
        sheet.getRange(foundRow, statusCol + 1).setValue("checked_in");
        sheet.getRange(foundRow, timeCol + 1).setValue(checkInTime);
        sheet.getRange(foundRow, byCol + 1).setValue(checkedInBy);
      } else {
        // Participant not in sheet yet — append new row with attendance marked checked_in
        sheet.appendRow([
          regId,
          fullName || "Attendee",
          phone,
          email,
          college,
          passYear,
          department,
          domain,
          skills,
          regDate,
          "confirmed",
          "checked_in",
          checkInTime,
          checkedInBy
        ]);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "checked_in", row: foundRow }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Regular registration insert
    if (foundRow <= 0) {
      sheet.appendRow([
        regId,
        fullName,
        phone,
        email,
        college,
        passYear,
        department,
        domain,
        skills,
        regDate,
        "sent",
        "not_checked_in",
        "",
        ""
      ]);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "inserted" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
`;
