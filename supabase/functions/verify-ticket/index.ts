// Supabase Edge Function: verify-ticket
// Validates administrator identity and executes atomic ticket redemption.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256Hex(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing admin authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    // 1. Verify caller session using user's token
    const clientUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await clientUser.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized administrator access." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Verify admin role in admin_profiles using service client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: adminProfile, error: profileError } = await adminClient
      .from("admin_profiles")
      .select("id, role, is_active")
      .eq("id", user.id)
      .eq("is_active", true)
      .single();

    if (profileError || !adminProfile) {
      return new Response(JSON.stringify({ error: "Forbidden: Active administrator profile required." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { token, registrationId } = body;

    if (!token && !registrationId) {
      return new Response(JSON.stringify({ error: "Either ticket token or registration ID must be provided." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let tokenHash = "";
    if (token) {
      tokenHash = await sha256Hex(token.trim());
    } else if (registrationId) {
      // Lookup registration by public registration ID for manual lookup fallback
      const { data: reg, error: regError } = await adminClient
        .from("registrations")
        .select("ticket_token_hash")
        .ilike("registration_id", registrationId.trim())
        .single();

      if (regError || !reg) {
        return new Response(JSON.stringify({
          status: "not_found",
          message: "Registration ID not found in database.",
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      tokenHash = reg.ticket_token_hash;
    }

    // 3. Execute atomic database stored procedure
    const { data: result, error: rpcError } = await adminClient.rpc("check_in_participant", {
      p_token_hash: tokenHash,
      p_admin_id: user.id,
    });

    if (rpcError) {
      console.error("RPC check_in_participant error:", rpcError);
      return new Response(JSON.stringify({
        status: "error",
        message: "Failed to process check-in transaction. Please retry.",
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Ticket verification error:", err);
    return new Response(JSON.stringify({
      status: "error",
      message: "Internal server error during verification.",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
