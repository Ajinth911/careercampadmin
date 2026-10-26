// Supabase Edge Function: register
// Handles participant registration, server-side duplicate prevention, token hashing, and ticket queuing.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Helper to calculate SHA-256 hex string
async function sha256Hex(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Normalization functions
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string): string {
  // Keep digits, normalize to international format without spaces/dashes
  const cleaned = phone.replace(/[^0-9+]/g, "");
  return cleaned;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      fullName,
      phoneNumber,
      email,
      collegeName,
      passOutYear,
      department,
      domain,
      aiSkills,
      consent,
    } = body;

    // 1. Server-side validation with strict bounds
    if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2 || fullName.trim().length > 100) {
      return new Response(JSON.stringify({ error: "Full name must be between 2 and 100 characters." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!email || typeof email !== "string" || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return new Response(JSON.stringify({ error: "Valid email address (max 255 chars) is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const digitsOnly = phoneNumber ? String(phoneNumber).replace(/\D/g, "") : "";
    if (!phoneNumber || digitsOnly.length < 10 || String(phoneNumber).length > 25) {
      return new Response(JSON.stringify({ error: "Valid phone number (10 to 25 digits) is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!collegeName || typeof collegeName !== "string" || collegeName.trim().length < 2 || collegeName.trim().length > 150) {
      return new Response(JSON.stringify({ error: "College name must be between 2 and 150 characters." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const yearNum = parseInt(passOutYear, 10);
    if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2035) {
      return new Response(JSON.stringify({ error: "Valid pass out year (between 2000 and 2035) is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const deptVal = (department || domain || "").trim();
    if (!deptVal || deptVal === "Others" || deptVal.length > 100) {
      return new Response(JSON.stringify({ error: "Department selection or entry (max 100 chars) is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const domainVal = (domain || department || "").trim();
    if (!domainVal || domainVal === "Others" || domainVal.length > 100) {
      return new Response(JSON.stringify({ error: "Domain selection or entry (max 100 chars) is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (Array.isArray(aiSkills) && aiSkills.length > 20) {
      return new Response(JSON.stringify({ error: "Maximum 20 AI skills can be selected." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!consent) {
      return new Response(JSON.stringify({ error: "You must accept the terms to register." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normEmail = normalizeEmail(email);
    const normPhone = normalizePhone(phoneNumber);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Pre-check for duplicate email or phone
    const { data: existingRecords, error: checkError } = await supabase
      .from("registrations")
      .select("registration_id, normalized_email, normalized_phone")
      .or(`normalized_email.eq.${normEmail},normalized_phone.eq.${normPhone}`);

    if (checkError) {
      console.error("Database check error:", checkError);
    }

    if (existingRecords && existingRecords.length > 0) {
      const match = existingRecords[0];
      const isEmail = match.normalized_email === normEmail;
      return new Response(
        JSON.stringify({
          error: isEmail
            ? "A participant with this email address has already registered for Career Launchpad."
            : "A participant with this phone number has already registered for Career Launchpad.",
          code: "DUPLICATE_REGISTRATION",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Generate secure tokens & unique registration ID
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const timestampPart = Date.now().toString().slice(-4);
    const registrationId = `CLP-${timestampPart}-${randomSuffix}`;

    const rawTicketToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const tokenHash = await sha256Hex(rawTicketToken);

    // 4. Atomic Insert into PostgreSQL
    const { data: inserted, error: insertError } = await supabase
      .from("registrations")
      .insert({
        registration_id: registrationId,
        full_name: fullName.trim(),
        phone_number: phoneNumber.trim(),
        normalized_phone: normPhone,
        email: normEmail,
        normalized_email: normEmail,
        college_name: collegeName.trim(),
        pass_out_year: yearNum,
        department: deptVal,
        domain: domainVal,
        ai_skills: Array.isArray(aiSkills) ? aiSkills : [],
        ticket_token_hash: tokenHash,
        email_status: "pending",
        attendance_status: "not_checked_in",
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return new Response(
          JSON.stringify({
            error: "This email address or phone number is already registered.",
            code: "DUPLICATE_REGISTRATION",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("Insert registration error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create registration record. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Queue Email Job
    await supabase.from("email_jobs").insert({
      registration_id: registrationId,
      recipient_email: normEmail,
      status: "pending",
    });

    // 6. Queue Google Sheets Integration Job
    await supabase.from("integration_jobs").insert({
      registration_id: registrationId,
      job_type: "insert_row",
      status: "pending",
    });

    return new Response(
      JSON.stringify({
        success: true,
        registration: {
          registration_id: inserted.registration_id,
          full_name: inserted.full_name,
          email: inserted.email,
          phone_number: inserted.phone_number,
          college_name: inserted.college_name,
          pass_out_year: inserted.pass_out_year,
          domain: inserted.domain,
          ai_skills: inserted.ai_skills,
          registered_at: inserted.registered_at,
          ticket_token: rawTicketToken,
        },
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Unhandled registration exception:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
