"use client";

import { useMemo, useState } from "react";

import { useAppStore } from "@/src/components/providers/app-store-provider";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Notice } from "@/src/components/ui/notice";
import { Select } from "@/src/components/ui/select";
import { Textarea } from "@/src/components/ui/textarea";
import { createLogger } from "@/src/lib/logger";
import {
  CUSTOM_PRONOUN_OPTION,
  DEFAULT_PRONOUN_OPTION,
  PRONOUN_PRESET_OPTIONS,
  type UserProfile,
} from "@/src/lib/types";
import { requestResumeSummary } from "@/src/lib/ai/client-api";
import { extractResumeText } from "@/src/lib/utils/resume-parser";

const logger = createLogger("onboarding");

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "{}") {
      return serialized;
    }
  } catch {
    // Ignore serialization failures.
  }

  return fallback;
}

interface ProfileDraft {
  name: string;
  targetJob: string;
  experienceLevel: UserProfile["experienceLevel"];
  age: string;
  pronounsOption: string;
  pronounsCustom: string;
  resumeText: string;
  resumeSummary: string;
  resumeEducation: string;
  resumeExperience: string;
}

const initialDraft: ProfileDraft = {
  name: "",
  targetJob: "Defined per role",
  experienceLevel: "new_grad",
  age: "",
  pronounsOption: DEFAULT_PRONOUN_OPTION,
  pronounsCustom: "",
  resumeText: "",
  resumeSummary: "",
  resumeEducation: "",
  resumeExperience: "",
};

export function OnboardingFlow() {
  const { saveProfile } = useAppStore();

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ProfileDraft>(initialDraft);
  const [resumeFileName, setResumeFileName] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [transitionState, setTransitionState] = useState<"idle" | "out" | "in">("idle");
  const [isFinishing, setIsFinishing] = useState(false);

  const isTransitioning = transitionState !== "idle";
  const canContinue = step !== 2 || Boolean(draft.resumeText);
  const stepClassName =
    transitionState === "out"
      ? "onboarding-step-exit"
      : transitionState === "in"
        ? "onboarding-step-enter"
        : "onboarding-step-idle";

  const canFinish = useMemo(() => {
    return draft.name.trim().length > 0;
  }, [draft.name]);

  const transitionToStep = (nextStep: number) => {
    if (isTransitioning || nextStep === step) {
      return;
    }

    setTransitionState("out");
    window.setTimeout(() => {
      setStep(nextStep);
      setTransitionState("in");
      window.setTimeout(() => {
        setTransitionState("idle");
      }, 220);
    }, 160);
  };

  const nextStep = () => {
    setError(null);
    setStatusMessage(null);
    transitionToStep(Math.min(step + 1, 3));
  };

  const prevStep = () => {
    setError(null);
    setStatusMessage(null);
    transitionToStep(Math.max(step - 1, 0));
  };

  const handleResumeUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    setResumeFileName(file.name);

    try {
      const resumeText = await extractResumeText(file);

      if (!resumeText) {
        throw new Error("Could not extract text from that file.");
      }

      setDraft((current) => ({
        ...current,
        resumeText,
      }));

      if (resumeText.length < 50) {
        setStatusMessage("Resume text was captured, but it is too short to autofill profile fields.");
        logger.warn("Resume text was extracted but is too short for reliable autofill.", {
          charCount: resumeText.length,
        });
        return;
      }

      setStatusMessage("Resume text extracted. Generating profile hints...");

      const summary = await requestResumeSummary(resumeText);
      setDraft((current) => ({
        ...current,
        name: summary.name || current.name,
        targetJob: summary.targetJob || current.targetJob,
        experienceLevel: summary.experienceLevel || current.experienceLevel,
        resumeSummary: summary.resumeSummary || current.resumeSummary,
      }));

      setStatusMessage("Resume uploaded. We autofilled fields below; you can edit everything.");
      logger.info("Resume processed and profile fields autofilled.", {
        hasName: Boolean(summary.name),
        hasTargetJob: Boolean(summary.targetJob),
      });
    } catch (uploadError) {
      const message = toErrorMessage(uploadError, "Resume upload failed.");
      setError(message);
      setStatusMessage(null);
      logger.error("Resume upload or processing failed.", {
        message,
        detail: uploadError instanceof Error ? uploadError.stack : String(uploadError),
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFinish = () => {
    if (isFinishing) {
      return;
    }
    const normalizedAge = draft.age.trim();
    let parsedAge: number | null = null;

    if (normalizedAge) {
      const candidateAge = Number.parseInt(normalizedAge, 10);
      if (!Number.isInteger(candidateAge) || candidateAge < 1 || candidateAge > 120) {
        setError("Age must be a whole number between 1 and 120, or left empty.");
        return;
      }
      parsedAge = candidateAge;
    }

    if (!canFinish) {
      setError("Please enter your name.");
      return;
    }

    setIsFinishing(true);
    window.setTimeout(() => {
      saveProfile({
        name: draft.name.trim(),
        targetJob: draft.targetJob.trim() || "Defined per role",
        experienceLevel: draft.experienceLevel,
        age: parsedAge,
        pronouns: (
          draft.pronounsOption === DEFAULT_PRONOUN_OPTION
            ? ""
            : draft.pronounsOption === CUSTOM_PRONOUN_OPTION
              ? draft.pronounsCustom
              : draft.pronounsOption
        ).trim(),
        resumeText: draft.resumeText,
        resumeSummary: draft.resumeSummary.trim(),
        resumeEducation: draft.resumeEducation.trim(),
        resumeExperience: draft.resumeExperience.trim(),
      });

      logger.info("Onboarding complete. User profile saved.", {
        hasResumeText: Boolean(draft.resumeText),
        hasResumeSummary: Boolean(draft.resumeSummary),
      });
    }, 220);
  };

  return (
    <>
      <div className="flex min-h-[80vh] items-center justify-center">
        <Card className={`w-full max-w-3xl space-y-8 p-8 md:p-10 ${isFinishing ? "onboarding-card-exit" : ""}`}>
        <div className="font-sans text-xs uppercase tracking-[0.16em] text-paper-muted">Onboarding</div>

        <div className={stepClassName}>
          {step === 0 ? (
            <div className="space-y-4">
              <h1 className="fade-up text-4xl leading-tight md:text-5xl">Inner View</h1>
              <p className="fade-up-slower max-w-2xl text-paper-softInk">
                Interview practice that feels realistic, focused, and calm.
              </p>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <h2 className="fade-up text-3xl leading-tight">How this works</h2>
              <p className="fade-up-slower max-w-2xl text-paper-softInk">
                We build interview sessions from your background and role context, then run a realistic turn-by-turn
                conversation.
              </p>
              <p className="fade-up-slowest max-w-2xl text-paper-softInk">
                After each interview, you get direct, no-score analysis focused on what to fix next.
              </p>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <h2 className="text-3xl leading-tight">Upload your resume (optional)</h2>
              <p className="text-paper-softInk">Supports PDF, DOCX, and TXT. You can skip this and enter info manually.</p>

              <div className="space-y-4 rounded-paper border border-paper-border bg-paper-elevated p-4">
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label htmlFor="resume-upload">Resume file</Label>
                  </div>
                  <label
                    htmlFor="resume-upload"
                    className="inline-flex w-fit cursor-pointer items-center justify-center rounded-paper border border-paper-border bg-paper-bg px-3 py-2 text-sm font-medium text-paper-ink transition hover:border-paper-accent"
                  >
                    Choose file
                  </label>
                  <input
                    id="resume-upload"
                    type="file"
                    className="sr-only"
                    accept=".pdf,.docx,.txt,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) {
                        return;
                      }

                      void handleResumeUpload(file);
                    }}
                  />
                </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-paper border border-paper-border bg-paper-bg px-3 py-2">
                  <p className="text-sm text-paper-muted">
                    {resumeFileName ? resumeFileName : "No file selected yet."}
                  </p>
                  {resumeFileName ? (
                    <span
                      className={`font-sans text-[0.7rem] uppercase tracking-[0.16em] text-paper-muted ${
                        uploading ? "loading-dots" : ""
                      }`}
                    >
                      {uploading ? "Uploading" : "Ready"}
                    </span>
                  ) : null}
                </div>
              </div>

              {statusMessage ? <Notice message={statusMessage} tone="neutral" /> : null}
              {error ? <Notice message={error} tone="error" /> : null}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              <h2 className="text-3xl leading-tight">Confirm your profile</h2>

              <div className="space-y-2">
                <Label htmlFor="profile-name">Name</Label>
                <Input
                  id="profile-name"
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Jane Candidate"
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="profile-age">Age (optional)</Label>
                  <Input
                    id="profile-age"
                    type="number"
                    min={1}
                    max={120}
                    inputMode="numeric"
                    value={draft.age}
                    onChange={(event) => setDraft((current) => ({ ...current, age: event.target.value }))}
                    placeholder="29"
                  />
                </div>

              <div className="space-y-2">
                <Label htmlFor="profile-pronouns">Pronouns (optional)</Label>
                <Select
                  id="profile-pronouns"
                  value={draft.pronounsOption}
                  className={draft.pronounsOption === DEFAULT_PRONOUN_OPTION ? "text-paper-muted font-normal" : "font-normal"}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      pronounsOption: event.target.value,
                    }))
                  }
                >
                  <option value={DEFAULT_PRONOUN_OPTION}>No preference</option>
                  {PRONOUN_PRESET_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                  <option value={CUSTOM_PRONOUN_OPTION}>Custom</option>
                </Select>
                {draft.pronounsOption === CUSTOM_PRONOUN_OPTION ? (
                  <Input
                    id="profile-pronouns-custom"
                    value={draft.pronounsCustom}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        pronounsCustom: event.target.value,
                      }))
                    }
                    placeholder="Type your pronouns"
                  />
                ) : null}
              </div>
              </div>

              {draft.resumeText ? (
                <div className="space-y-2">
                  <Label htmlFor="resume-summary">Resume context summary</Label>
                  <Textarea
                    id="resume-summary"
                    value={draft.resumeSummary}
                    onChange={(event) => setDraft((current) => ({ ...current, resumeSummary: event.target.value }))}
                    rows={4}
                    placeholder="Optional summary used to personalize interviews"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="resume-education">Education</Label>
                    <Textarea
                      id="resume-education"
                      value={draft.resumeEducation}
                      onChange={(event) => setDraft((current) => ({ ...current, resumeEducation: event.target.value }))}
                      rows={3}
                      placeholder="Schools, programs, and key coursework"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="resume-experience">Experience</Label>
                    <Textarea
                      id="resume-experience"
                      value={draft.resumeExperience}
                      onChange={(event) => setDraft((current) => ({ ...current, resumeExperience: event.target.value }))}
                      rows={4}
                      placeholder="Roles, responsibilities, and impact"
                    />
                  </div>
                </div>
              )}

              {error ? <Notice message={error} tone="error" /> : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-3">
            {step > 0 ? (
              <Button type="button" variant="ghost" onClick={prevStep} disabled={isTransitioning}>
                Back
              </Button>
            ) : null}

            {step < 3 ? (
              <Button
                type="button"
                onClick={nextStep}
                disabled={uploading || isTransitioning || !canContinue}
              >
                {step === 2 ? "Continue" : "Next"}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleFinish}
                disabled={!canFinish || isTransitioning || isFinishing}
              >
                Finish onboarding
              </Button>
            )}
          </div>

          {step === 2 ? (
            <Button type="button" variant="ghost" onClick={nextStep} disabled={uploading || isTransitioning}>
              Skip resume
            </Button>
          ) : null}
        </div>
        </Card>
      </div>
    </>
  );
}
