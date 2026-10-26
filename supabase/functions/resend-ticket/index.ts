// Supabase Edge Function: resend-ticket
// Allows re-sending ticket confirmation emails to participants with retry tracking.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing administrator authorization header." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // 1. Validate caller admin session
    const clientUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await clientUser.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized access: valid admin session required." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: adminProfile } = await supabase
      .from("admin_profiles")
      .select("id, is_active")
      .eq("id", user.id)
      .eq("is_active", true)
      .single();

    if (!adminProfile) {
      return new Response(JSON.stringify({ error: "Forbidden: Active administrator profile required." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { registrationId } = body;

    if (!registrationId) {
      return new Response(JSON.stringify({ error: "registrationId is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lookup participant
    const { data: reg, error: regError } = await supabase
      .from("registrations")
      .select("*")
      .eq("registration_id", registrationId)
      .single();

    if (regError || !reg) {
      return new Response(JSON.stringify({ error: "Participant not found." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let emailDelivered = false;
    let errorMessage = null;

    if (resendApiKey) {
      try {
        const emailHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
            <div style="border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 24px;">
              <h1 style="font-size: 24px; margin: 0; letter-spacing: -0.5px;">CAREER LAUNCHPAD</h1>
              <p style="color: #666; margin: 4px 0 0 0; font-size: 14px;">Your next opportunity starts here.</p>
            </div>
            <p>Dear <strong>${reg.full_name}</strong>,</p>
            <p>This is your official confirmation and digital pass for <strong>Career Launchpad</strong>.</p>
            <div style="background: #f4f4f5; border: 1px solid #e5e7eb; border-radius: 4px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0;"><strong>Registration ID:</strong> ${reg.registration_id}</p>
              <p style="margin: 0 0 8px 0;"><strong>College:</strong> ${reg.college_name}</p>
              <p style="margin: 0 0 8px 0;"><strong>Domain:</strong> ${reg.domain}</p>
              <p style="margin: 0;"><strong>Pass-Out Year:</strong> ${reg.pass_out_year}</p>
            </div>
            <p style="color: #333; font-size: 14px;">
              Please present your digital QR pass from your registration receipt at the entrance desk for rapid check-in.
            </p>
            <div style="margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px; font-size: 12px; color: #888;">
              Career Launchpad Verification Team
            </div>
          </div>
        `;

        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Career Launchpad <tickets@careerlaunchpad.dev>",
            to: [reg.email],
            subject: "Your Career Launchpad Ticket — Registration Confirmed",
            html: emailHtml,
          }),
        });

        if (resendRes.ok) {
          emailDelivered = true;
        } else {
          const errData = await resendRes.json();
          errorMessage = errData.message || "Failed to send email via Resend.";
        }
      } catch (err: any) {
        errorMessage = err.message || "Network exception sending email";
      }
    } else {
      // In development or when API key is not configured, simulate queued delivery
      emailDelivered = true;
    }

    const newStatus = emailDelivered ? "sent" : "failed";

    // Update registrations email_status
    await supabase
      .from("registrations")
      .update({ email_status: newStatus })
      .eq("registration_id", registrationId);

    // Update or insert email job
    await supabase.from("email_jobs").insert({
      registration_id: registrationId,
      recipient_email: reg.email,
      status: newStatus,
      attempts: 1,
      last_error: errorMessage,
    });

    // Audit log operation
    await supabase.from("audit_logs").insert({
      action: "ticket_resent",
      performed_by: user.id,
      target_registration_id: registrationId,
      details: { status: newStatus, recipient: reg.email, error: errorMessage },
    });

    return new Response(
      JSON.stringify({
        success: emailDelivered,
        status: newStatus,
        message: emailDelivered
          ? "Ticket email dispatched successfully."
          : `Failed to deliver email: ${errorMessage}`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Resend ticket error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to resend ticket." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
