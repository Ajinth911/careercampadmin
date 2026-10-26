import { createClient } from "@supabase/supabase-js";

// Production Supabase project credentials as defaults to ensure direct database storage
const DEFAULT_SUPABASE_URL = "https://nzyamdkhywaolmuvdfph.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56eWFtZGtoeXdhb2xtdXZkZnBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MzIyOTAsImV4cCI6MjEwODQwODI5MH0.9MVpUHfjL5pxkiWVsXEutvkqw6ujeMfEJlQo58mF5qc";

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== "https://your-project.supabase.co" &&
  !supabaseUrl.includes("placeholder")
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
