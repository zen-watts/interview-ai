"use client";

import { useMemo, useState } from "react";

import { useAppStore } from "@/src/components/providers/app-store-provider";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Notice } from "@/src/components/ui/notice";
import { Textarea } from "@/src/components/ui/textarea";
import { requestResumeSummary } from "@/src/lib/ai/client-api";
import { createLogger } from "@/src/lib/logger";
import type { UserProfile } from "@/src/lib/types";
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
  pronouns: string;
  resumeText: string;
  resumeSummary: string;
}

const initialDraft: ProfileDraft = {
  name: "",
  targetJob: "Defined per role",
  experienceLevel: "new_grad",
  age: "",
  pronouns: "",
  resumeText: "",
  resumeSummary: "",
};

export function OnboardingFlow() {
  const { saveProfile } = useAppStore();

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ProfileDraft>(initialDraft);
  const [resumeFileName, setResumeFileName] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const canFinish = useMemo(() => {
    return draft.name.trim().length > 0;
  }, [draft.name]);

  const nextStep = () => {
    setError(null);
    setStatusMessage(null);
    setStep((current) => Math.min(current + 1, 3));
  };

  const prevStep = () => {
    setError(null);
    setStatusMessage(null);
    setStep((current) => Math.max(current - 1, 0));
  };

  const handleResumeUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    setStatusMessage("Extracting resume text...");
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

    saveProfile({
      name: draft.name.trim(),
      targetJob: draft.targetJob.trim() || "Defined per role",
      experienceLevel: draft.experienceLevel,
      age: parsedAge,
      pronouns: draft.pronouns.trim(),
      resumeText: draft.resumeText,
      resumeSummary: draft.resumeSummary.trim(),
    });

    logger.info("Onboarding complete. User profile saved.", {
      hasResumeText: Boolean(draft.resumeText),
      hasResumeSummary: Boolean(draft.resumeSummary),
    });
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <Card className="w-full max-w-3xl space-y-8 p-8 md:p-10">
        <div className="font-sans text-xs uppercase tracking-[0.16em] text-paper-muted">Onboarding</div>

        {step === 0 ? (
          <div className="space-y-4">
            <h1 className="text-4xl leading-tight md:text-5xl">Inner View</h1>
            <p className="max-w-2xl text-paper-softInk">
              Interview practice that feels realistic, focused, and calm.
            </p>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <h2 className="text-3xl leading-tight">How this works</h2>
            <p className="max-w-2xl text-paper-softInk">
              We build interview sessions from your background and role context, then run a realistic turn-by-turn
              conversation.
            </p>
            <p className="max-w-2xl text-paper-softInk">
              After each interview, you get direct, no-score analysis focused on what to fix next.
            </p>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-5">
            <h2 className="text-3xl leading-tight">Upload your resume (optional)</h2>
            <p className="text-paper-softInk">Supports PDF, DOCX, and TXT. You can skip this and enter info manually.</p>

            <div className="space-y-2">
              <Label htmlFor="resume-upload">Resume file</Label>
              <Input
                id="resume-upload"
                type="file"
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

            {resumeFileName ? (
              <p className="font-sans text-xs uppercase tracking-[0.12em] text-paper-muted">Loaded: {resumeFileName}</p>
            ) : null}
            {statusMessage ? <Notice message={statusMessage} tone="success" /> : null}
            {error ? <Notice message={error} tone="error" /> : null}
            {uploading ? <p className="text-sm text-paper-softInk">Working on your resume...</p> : null}
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
                <Input
                  id="profile-pronouns"
                  value={draft.pronouns}
                  onChange={(event) => setDraft((current) => ({ ...current, pronouns: event.target.value }))}
                  placeholder="she/her, he/him, they/them"
                />
              </div>
            </div>

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

            {error ? <Notice message={error} tone="error" /> : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={prevStep}>
              Back
            </Button>
          ) : null}

          {step < 3 ? (
            <Button type="button" onClick={nextStep} disabled={uploading}>
              {step === 2 ? "Continue" : "Next"}
            </Button>
          ) : (
            <Button type="button" onClick={handleFinish} disabled={!canFinish}>
              Finish onboarding
            </Button>
          )}

          {step === 2 ? (
            <Button type="button" variant="ghost" onClick={nextStep} disabled={uploading}>
              Skip resume
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
