export const END_TOKEN = "<INTERVIEW_END>";

export const EXPERIENCE_LEVEL_OPTIONS = [
  { value: "in_college", label: "In college" },
  { value: "new_grad", label: "New grad" },
  { value: "2_years", label: "2 years" },
  { value: "5_years", label: "5 years" },
  { value: "10_years", label: "10 years" },
  { value: "15_plus_years", label: "15+ years" },
] as const;

export type ExperienceLevel = (typeof EXPERIENCE_LEVEL_OPTIONS)[number]["value"];

export const INTERVIEW_CATEGORY_OPTIONS = [
  "Strictly Behavioral",
  "Mix",
  "Technical Concepts",
  "Unhinged",
] as const;

export type InterviewCategory = (typeof INTERVIEW_CATEGORY_OPTIONS)[number];

export type InterviewAttemptStatus =
  | "script_pending"
  | "ready"
  | "in_progress"
  | "analysis_pending"
  | "complete"
  | "error";

export interface UserProfile {
  name: string;
  targetJob: string;
  experienceLevel: ExperienceLevel;
  age: number | null;
  pronouns: string;
  resumeText: string;
  resumeSummary: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoleProfile {
  id: string;
  title: string;
  organizationName: string;
  organizationDescription: string;
  fullJobDescription: string;
  isFavorited: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewConfig {
  personaIntensity: number;
  followUpIntensity: number;
  primaryQuestionCount: number;
  category: InterviewCategory;
  notes: string;
}

export interface TranscriptTurn {
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string;
  answerDurationSec?: number;
}

export interface InterviewAnalysis {
  impression_short: string;
  impression_long: string;
  red_flags: string[];
  top_improvement: string;
}

export interface InterviewAttempt {
  id: string;
  roleId: string;
  config: InterviewConfig;
  status: InterviewAttemptStatus;
  script: string | null;
  transcript: TranscriptTurn[];
  analysis: InterviewAnalysis | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DevSettings {
  showInterviewerScriptOnConclusion: boolean;
}

export interface AppStoreV1 {
  schemaVersion: 1;
  profile: UserProfile | null;
  roles: RoleProfile[];
  attempts: InterviewAttempt[];
}

export interface AppStoreV2 {
  schemaVersion: 2;
  profile: UserProfile | null;
  roles: RoleProfile[];
  attempts: InterviewAttempt[];
  devSettings: DevSettings;
}

export type AppStore = AppStoreV2;
