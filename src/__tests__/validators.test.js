import { describe, it, expect } from "vitest";
import {
  normalizeEmail,
  normalizePhone,
  validateRegistrationForm,
  DOMAIN_OPTIONS,
} from "../lib/validators";

describe("Validators and Normalizers", () => {
  it("normalizes emails properly to lowercase and trimmed", () => {
    expect(normalizeEmail("   Participant@Example.COM  ")).toBe("participant@example.com");
    expect(normalizeEmail("")).toBe("");
  });

  it("normalizes phone numbers to pure numeric digits", () => {
    expect(normalizePhone("+91 98765-43210")).toBe("+919876543210");
    expect(normalizePhone("(987) 654-3210")).toBe("9876543210");
  });

  it("validates valid registration form data", () => {
    const validForm = {
      fullName: "Senthil Nathan",
      email: "senthil@university.edu",
      phoneNumber: "+91 9876543210",
      collegeName: "Government College of Technology",
      passOutYear: "2025",
      domain: DOMAIN_OPTIONS[0],
      consent: true,
    };
    const { isValid, errors } = validateRegistrationForm(validForm);
    expect(isValid).toBe(true);
    expect(Object.keys(errors).length).toBe(0);
  });

  it("catches invalid email, short phone number, and missing consent", () => {
    const invalidForm = {
      fullName: "A",
      email: "bad-email",
      phoneNumber: "123",
      collegeName: "",
      passOutYear: "",
      domain: "",
      consent: false,
    };
    const { isValid, errors } = validateRegistrationForm(invalidForm);
    expect(isValid).toBe(false);
    expect(errors.fullName).toBeDefined();
    expect(errors.email).toBeDefined();
    expect(errors.phoneNumber).toBeDefined();
    expect(errors.collegeName).toBeDefined();
    expect(errors.passOutYear).toBeDefined();
    expect(errors.domain).toBeDefined();
    expect(errors.consent).toBeDefined();
  });

  it("validates form with custom department and custom pass out year (Others)", () => {
    const customForm = {
      fullName: "Priya Sundaram",
      email: "priya@domain.com",
      phoneNumber: "+91 9123456789",
      collegeName: "Coimbatore Institute of Technology",
      passOutYear: "2029",
      department: "Biomedical Engineering",
      domain: "Healthcare AI & Computer Vision",
      consent: true,
    };
    const { isValid, errors } = validateRegistrationForm(customForm);
    expect(isValid).toBe(true);
    expect(Object.keys(errors).length).toBe(0);
  });

  it("rejects when Others is left un-typed for department or passOutYear", () => {
    const unTypedForm = {
      fullName: "Priya Sundaram",
      email: "priya@domain.com",
      phoneNumber: "+91 9123456789",
      collegeName: "Coimbatore Institute of Technology",
      passOutYear: "Others",
      department: "Others",
      domain: "",
      consent: true,
    };
    const { isValid, errors } = validateRegistrationForm(unTypedForm);
    expect(isValid).toBe(false);
    expect(errors.passOutYear).toBeDefined();
    expect(errors.department).toBeDefined();
    expect(errors.domain).toBeDefined();
  });
});
