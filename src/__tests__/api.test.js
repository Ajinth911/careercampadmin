import { describe, it, expect, beforeEach } from "vitest";
import { registerParticipant, verifyTicket } from "../lib/api";

const mockStorage = {};
globalThis.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, val) => {
    mockStorage[key] = String(val);
  },
  removeItem: (key) => {
    delete mockStorage[key];
  },
  clear: () => {
    for (const k in mockStorage) delete mockStorage[k];
  },
};

describe("Career Launchpad API & Verification Engine", () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it("successfully registers participant and returns ticket token", async () => {
    const reg = await registerParticipant({
      fullName: "Ananya Sharma",
      email: "ananya.sharma@example.com",
      phoneNumber: "+91 9988776655",
      collegeName: "PSG College",
      passOutYear: "2026",
      domain: "Computer Science Engineering",
      aiSkills: ["Machine Learning", "Prompt Engineering"],
      consent: true,
    });

    expect(reg.registration_id).toMatch(/^CLP-/);
    expect(reg.full_name).toBe("Ananya Sharma");
    expect(reg.ticket_token).toBeDefined();
    expect(reg.attendance_status).toBe("not_checked_in");
  });

  it("prevents duplicate registration with identical email", async () => {
    const payload = {
      fullName: "Karthik Raja",
      email: "karthik.raja@example.com",
      phoneNumber: "+91 9123456780",
      collegeName: "Anna University",
      passOutYear: "2025",
      domain: "Information Technology",
      consent: true,
    };

    await registerParticipant(payload);

    await expect(
      registerParticipant({
        ...payload,
        fullName: "Karthik Another",
        phoneNumber: "+91 9123456781",
      })
    ).rejects.toThrow("already registered");
  });

  it("prevents duplicate registration with identical phone number", async () => {
    const payload = {
      fullName: "Pooja V",
      email: "pooja.v@example.com",
      phoneNumber: "+91 9555544444",
      collegeName: "IIT Madras",
      passOutYear: "2024",
      domain: "Mechanical Engineering",
      consent: true,
    };

    await registerParticipant(payload);

    await expect(
      registerParticipant({
        ...payload,
        email: "pooja.alternate@example.com",
        fullName: "Pooja Second",
      })
    ).rejects.toThrow("already registered");
  });

  it("approves valid ticket check-in and rejects repeat scans", async () => {
    const reg = await registerParticipant({
      fullName: "Vignesh Kumar",
      email: "vignesh.k@example.com",
      phoneNumber: "+91 9444433333",
      collegeName: "NIT Trichy",
      passOutYear: "2025",
      domain: "Electrical and Electronics Engineering",
      consent: true,
    });

    // 1st Scan: Should succeed
    const firstCheckIn = await verifyTicket({ token: reg.ticket_token });
    expect(firstCheckIn.status).toBe("success");
    expect(firstCheckIn.registration_id).toBe(reg.registration_id);
    expect(firstCheckIn.checked_in_at).toBeDefined();

    // 2nd Scan: Must reject with already_checked_in
    const secondCheckIn = await verifyTicket({ token: reg.ticket_token });
    expect(secondCheckIn.status).toBe("already_checked_in");
    expect(secondCheckIn.registration_id).toBe(reg.registration_id);

    // Invalid Token check
    const invalidCheckIn = await verifyTicket({ token: "nonexistent-token-xyz" });
    expect(invalidCheckIn.status).toBe("not_found");
  });

  it("stores and queries distinct department and domain values", async () => {
    const reg = await registerParticipant({
      fullName: "Deepak Sundar",
      email: "deepak.sundar@example.com",
      phoneNumber: "+91 9777766666",
      collegeName: "Government College of Technology",
      passOutYear: "2026",
      department: "Biomedical Engineering",
      domain: "Healthcare AI & Computer Vision",
      aiSkills: ["Computer Vision", "Machine Learning"],
      consent: true,
    });

    expect(reg.department).toBe("Biomedical Engineering");
    expect(reg.domain).toBe("Healthcare AI & Computer Vision");

    const queryResult = await (await import("../lib/api")).fetchRegistrations({
      domain: "Biomedical Engineering",
    });

    expect(queryResult.records.length).toBeGreaterThan(0);
    const found = queryResult.records.find((r) => r.registration_id === reg.registration_id);
    expect(found).toBeDefined();
    expect(found.department).toBe("Biomedical Engineering");
    expect(found.domain).toBe("Healthcare AI & Computer Vision");
  });
});
