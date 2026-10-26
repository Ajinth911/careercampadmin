// Form validation and normalization utilities

export const DEPARTMENT_OPTIONS = [
  "Artificial Intelligence and Data Science",
  "Computer Science and Engineering",
  "Information Technology",
  "Electronics and Communication Engineering",
  "Electrical and Electronics Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Others",
];

export const DOMAIN_OPTIONS = [
  "Full Stack Web Development",
  "Frontend Development",
  "Backend & API Engineering",
  "Artificial Intelligence & Machine Learning",
  "Data Science & Analytics",
  "Cloud Computing & DevOps",
  "Cybersecurity & Ethical Hacking",
  "Mobile App Development",
  "UI/UX Design & Product",
  "Embedded Systems & IoT",
  "Blockchain & Web3",
  "Others",
];

export const AI_SKILL_OPTIONS = [
  "Machine Learning",
  "Deep Learning",
  "Generative AI and LLMs",
  "Prompt Engineering",
  "Natural Language Processing",
  "Computer Vision",
  "Data Analytics",
  "AI Agents and Automation",
  "Other",
  "No AI Skills Yet",
];

export const PASSOUT_YEAR_OPTIONS = [
  "2023",
  "2024",
  "2025",
  "2026",
  "2027",
  "2028",
  "Others",
];

export function normalizeEmail(email) {
  if (!email) return "";
  return email.trim().toLowerCase();
}

export function normalizePhone(phone) {
  if (!phone) return "";
  return phone.replace(/[^0-9+]/g, "").trim();
}

export function validateRegistrationForm(formData) {
  const errors = {};

  if (!formData || typeof formData !== "object") {
    return { isValid: false, errors: { form: "Invalid form payload." } };
  }

  // Full Name (2 to 100 characters)
  const fullName = (formData.fullName || "").trim();
  if (fullName.length < 2) {
    errors.fullName = "Full name must be at least 2 characters long.";
  } else if (fullName.length > 100) {
    errors.fullName = "Full name cannot exceed 100 characters.";
  }

  // Email (max 255 chars, standard RFC 5322 regex)
  const email = (formData.email || "").trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    errors.email = "Please enter a valid email address.";
  } else if (email.length > 255) {
    errors.email = "Email address cannot exceed 255 characters.";
  }

  // Phone Number (10 to 25 characters, at least 10 numeric digits)
  const rawPhone = (formData.phoneNumber || "").toString().trim();
  const digitsOnly = rawPhone.replace(/\D/g, "");
  if (!rawPhone || digitsOnly.length < 10) {
    errors.phoneNumber = "Please enter a valid phone number (at least 10 digits).";
  } else if (rawPhone.length > 25) {
    errors.phoneNumber = "Phone number cannot exceed 25 characters.";
  }

  // College Name (2 to 150 characters)
  const collegeName = (formData.collegeName || "").trim();
  if (collegeName.length < 2) {
    errors.collegeName = "College name is required.";
  } else if (collegeName.length > 150) {
    errors.collegeName = "College name cannot exceed 150 characters.";
  }

  // Pass Out Year (Valid 4-digit graduation year between 2000 and 2035)
  const passYearStr = (formData.passOutYear || "").toString().trim();
  const passYearNum = parseInt(passYearStr, 10);
  if (!passYearStr || passYearStr === "Others" || isNaN(passYearNum) || passYearNum < 2000 || passYearNum > 2035) {
    errors.passOutYear = "Please select or type a valid 4-digit graduation year (2000-2035).";
  }

  // Department (2 to 100 characters, not Others)
  const dept = (formData.department || formData.domain || "").trim();
  if (!dept || dept === "Others") {
    errors.department = "Please select or type your department.";
  } else if (dept.length > 100) {
    errors.department = "Department name cannot exceed 100 characters.";
  }

  // Domain (2 to 100 characters, not Others)
  const dom = (formData.domain || "").trim();
  if (!dom || dom === "Others") {
    errors.domain = "Please select or type your domain.";
  } else if (dom.length > 100) {
    errors.domain = "Domain name cannot exceed 100 characters.";
  }

  // AI Skills array limit
  if (Array.isArray(formData.aiSkills) && formData.aiSkills.length > 20) {
    errors.aiSkills = "Maximum 20 AI skills can be selected.";
  }

  // Consent
  if (!formData.consent) {
    errors.consent = "You must consent to registration and attendance processing.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
