"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

const logger = createLogger("profile");

interface ProfileDraft {
  name: string;
  age: string;
  pronounsOption: string;
  pronounsCustom: string;
  resumeSummary: string;
  resumeEducation: string;
  resumeExperience: string;
}

function toDraft(profile: UserProfile): ProfileDraft {
  const profilePronouns = profile.pronouns.trim();
  const isPreset = PRONOUN_PRESET_OPTIONS.some((option) => option.value === profilePronouns);

  return {
    name: profile.name,
    age: profile.age ? String(profile.age) : "",
    pronounsOption: profilePronouns ? (isPreset ? profilePronouns : CUSTOM_PRONOUN_OPTION) : DEFAULT_PRONOUN_OPTION,
    pronounsCustom: isPreset ? "" : profilePronouns,
    resumeSummary: profile.resumeSummary,
    resumeEducation: profile.resumeEducation,
    resumeExperience: profile.resumeExperience,
  };
}

function resolvePronounsValue(draft: ProfileDraft): string {
  if (draft.pronounsOption === DEFAULT_PRONOUN_OPTION) {
    return "";
  }

  if (draft.pronounsOption === CUSTOM_PRONOUN_OPTION) {
    return draft.pronounsCustom.trim();
  }

  return draft.pronounsOption;
}

interface ProfileFormState {
  profile: UserProfile | null;
  form: ProfileDraft | null;
  error: string | null;
  isDirty: boolean;
  hasResumeText: boolean;
  isResumePanelActive: boolean;
  setForm: Dispatch<SetStateAction<ProfileDraft | null>>;
  handleSave: () => void;
  panelView: "main" | "transition-to-resume" | "resume" | "transition-to-main";
  mainPanelClassName: string;
  resumePanelClassName: string;
  resumeUploadFileName: string;
  resumeUploadStatus: string | null;
  resumeUploadError: string | null;
  resumeUploadLoading: boolean;
  canSaveResumeUpload: boolean;
  resumeUploadLabel: string;
  openResumePanel: () => void;
  closeResumePanel: () => void;
  handleResumeFile: (file: File) => void;
  handleResumeUploadSave: () => void;
}

function useProfileForm(): ProfileFormState {
  const { store, saveProfile } = useAppStore();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileDraft | null>(null);
  const [panelView, setPanelView] = useState<"main" | "transition-to-resume" | "resume" | "transition-to-main">(
    "main"
  );
  const [resumeUploadFileName, setResumeUploadFileName] = useState("");
  const [resumeUploadStatus, setResumeUploadStatus] = useState<string | null>(null);
  const [resumeUploadError, setResumeUploadError] = useState<string | null>(null);
  const [resumeUploadLoading, setResumeUploadLoading] = useState(false);
  const [resumeUploadText, setResumeUploadText] = useState("");
  const [resumeUploadSummary, setResumeUploadSummary] = useState("");

  useEffect(() => {
    if (!store.profile) {
      return;
    }
    setForm(toDraft(store.profile));
  }, [store.profile]);

  const profile = store.profile;
  const hasResumeText = Boolean(profile?.resumeText);
  const isDirty = (() => {
    if (!profile || !form) {
      return false;
    }

    return (
      form.name.trim() !== profile.name ||
      form.age.trim() !== (profile.age ? String(profile.age) : "") ||
      resolvePronounsValue(form) !== profile.pronouns ||
      form.resumeSummary.trim() !== profile.resumeSummary ||
      form.resumeEducation.trim() !== profile.resumeEducation ||
      form.resumeExperience.trim() !== profile.resumeExperience
    );
  })();

  const handleSave = () => {
    if (!profile || !form || !isDirty) {
      return;
    }
    setError(null);
    const normalizedAge = form.age.trim();
    let parsedAge: number | null = null;

    if (normalizedAge) {
      const candidateAge = Number.parseInt(normalizedAge, 10);
      if (!Number.isInteger(candidateAge) || candidateAge < 1 || candidateAge > 120) {
        setError("Age must be a whole number between 1 and 120, or left empty.");
        return;
      }
      parsedAge = candidateAge;
    }

    if (!form.name.trim()) {
      setError("Please enter your name.");
      return;
    }

    saveProfile({
      name: form.name.trim(),
      targetJob: profile.targetJob || "Defined per role",
      experienceLevel: profile.experienceLevel || "new_grad",
      age: parsedAge,
      pronouns: resolvePronounsValue(form),
      resumeText: profile.resumeText || "",
      resumeSummary: form.resumeSummary.trim(),
      resumeEducation: form.resumeEducation.trim(),
      resumeExperience: form.resumeExperience.trim(),
    });

    logger.info("profile.saved", {
      hasResumeText: Boolean(store.profile?.resumeText),
      hasResumeSummary: Boolean(form.resumeSummary),
    });

    router.push("/");
  };

  const isResumePanelActive = panelView !== "main";
  const mainPanelClassName = useMemo(() => {
    if (panelView === "transition-to-resume") {
      return "profile-panel-exit";
    }
    if (panelView === "main") {
      return "profile-panel-idle";
    }
    return "profile-panel-idle";
  }, [panelView]);

  const resumePanelClassName = useMemo(() => {
    if (panelView === "transition-to-main") {
      return "profile-panel-exit";
    }
    if (panelView === "resume") {
      return "profile-panel-enter";
    }
    return "profile-panel-idle";
  }, [panelView]);

  const openResumePanel = () => {
    if (panelView !== "main") {
      return;
    }
    setPanelView("transition-to-resume");
    setResumeUploadFileName("");
    setResumeUploadStatus(null);
    setResumeUploadError(null);
    setResumeUploadText("");
    setResumeUploadSummary("");
    window.setTimeout(() => {
      setPanelView("resume");
    }, 160);
  };

  const closeResumePanel = () => {
    if (panelView !== "resume") {
      return;
    }
    setPanelView("transition-to-main");
    window.setTimeout(() => {
      setPanelView("main");
      setResumeUploadStatus(null);
      setResumeUploadError(null);
      setResumeUploadLoading(false);
      setResumeUploadText("");
      setResumeUploadSummary("");
    }, 220);
  };

  const handleResumeFile = (file: File) => {
    void (async () => {
      setResumeUploadLoading(true);
      setResumeUploadError(null);
      setResumeUploadFileName(file.name);

      try {
        setResumeUploadStatus("Extracting resume text...");
        const resumeText = await extractResumeText(file);

        if (!resumeText) {
          throw new Error("Could not extract text from that file.");
        }

        setResumeUploadText(resumeText);

        if (resumeText.length < 50) {
          setResumeUploadStatus("Resume text was captured, but it is too short to summarize.");
          logger.warn("Resume text too short for summary.", { charCount: resumeText.length });
          return;
        }

        setResumeUploadStatus("Resume text extracted. Generating summary...");
        const summary = await requestResumeSummary(resumeText);
        setResumeUploadSummary(summary.resumeSummary || "");
        setResumeUploadStatus("Resume uploaded. Review and save to update your profile.");
        logger.info("Resume reupload processed for profile.", {
          hasSummary: Boolean(summary.resumeSummary),
        });
      } catch (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message : "Resume upload failed.";
        setResumeUploadError(message);
        setResumeUploadStatus(null);
        logger.error("Profile resume upload failed.", {
          message,
          detail: uploadError instanceof Error ? uploadError.stack : String(uploadError),
        });
      } finally {
        setResumeUploadLoading(false);
      }
    })();
  };

  const canSaveResumeUpload = Boolean(profile && form && resumeUploadText) && !resumeUploadLoading;
  const resumeUploadLabel = profile?.resumeText ? "Reupload resume" : "Upload resume";

  const handleResumeUploadSave = () => {
    if (!profile || !form || !resumeUploadText) {
      return;
    }

    saveProfile({
      name: form.name.trim() || profile.name,
      targetJob: profile.targetJob,
      experienceLevel: profile.experienceLevel,
      age: profile.age,
      pronouns: resolvePronounsValue(form),
      resumeText: resumeUploadText,
      resumeSummary: resumeUploadSummary || form.resumeSummary.trim(),
      resumeEducation: form.resumeEducation.trim(),
      resumeExperience: form.resumeExperience.trim(),
    });

    setForm((current) =>
      current
        ? {
            ...current,
            resumeSummary: resumeUploadSummary || current.resumeSummary,
          }
        : current
    );

    logger.info("profile.resume.updated", {
      hasSummary: Boolean(resumeUploadSummary),
      resumeLength: resumeUploadText.length,
    });

    closeResumePanel();
  };

  return {
    profile,
    form,
    error,
    isDirty,
    hasResumeText,
    isResumePanelActive,
    setForm,
    handleSave,
    panelView,
    mainPanelClassName,
    resumePanelClassName,
    resumeUploadFileName,
    resumeUploadStatus,
    resumeUploadError,
    resumeUploadLoading,
    canSaveResumeUpload,
    resumeUploadLabel,
    openResumePanel,
    closeResumePanel,
    handleResumeFile,
    handleResumeUploadSave,
  };
}

function ProfileFormFields({
  form,
  setForm,
  error,
  isDirty,
  onSave,
  showTitle,
  hasResumeText,
  panelView,
  mainPanelClassName,
  resumePanelClassName,
  resumeUploadFileName,
  resumeUploadStatus,
  resumeUploadError,
  resumeUploadLoading,
  canSaveResumeUpload,
  resumeUploadLabel,
  onOpenResumePanel,
  onCloseResumePanel,
  onResumeFile,
  onResumeSave,
}: {
  form: ProfileDraft;
  setForm: Dispatch<SetStateAction<ProfileDraft | null>>;
  error: string | null;
  isDirty: boolean;
  onSave: () => void;
  showTitle: boolean;
  hasResumeText: boolean;
  panelView: "main" | "transition-to-resume" | "resume" | "transition-to-main";
  mainPanelClassName: string;
  resumePanelClassName: string;
  resumeUploadFileName: string;
  resumeUploadStatus: string | null;
  resumeUploadError: string | null;
  resumeUploadLoading: boolean;
  canSaveResumeUpload: boolean;
  resumeUploadLabel: string;
  onOpenResumePanel: () => void;
  onCloseResumePanel: () => void;
  onResumeFile: (file: File) => void;
  onResumeSave: () => void;
}) {
  const updateField = (field: keyof ProfileDraft, value: string) => {
    setForm((current) => (current ? { ...current, [field]: value } : current));
  };

  const shouldUseResumeSummary = hasResumeText;

  if (panelView !== "main" && panelView !== "transition-to-resume") {
    return (
      <div className={`${resumePanelClassName} space-y-6`}>
        <button
          type="button"
          className="inline-flex items-center gap-2 font-sans text-xs uppercase tracking-[0.14em] text-paper-muted hover:text-paper-ink"
          onClick={onCloseResumePanel}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M11.78 4.22a.75.75 0 0 1 0 1.06L7.06 10l4.72 4.72a.75.75 0 1 1-1.06 1.06l-5.25-5.25a.75.75 0 0 1 0-1.06l5.25-5.25a.75.75 0 0 1 1.06 0Z"
              clipRule="evenodd"
            />
          </svg>
          Back
        </button>

        <div className="space-y-4 rounded-paper border border-paper-border bg-paper-elevated p-4">
          <div className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="profile-resume-upload">Resume file</Label>
            </div>
            <label
              htmlFor="profile-resume-upload"
              className="inline-flex w-fit cursor-pointer items-center justify-center rounded-paper border border-paper-border bg-paper-bg px-3 py-2 text-sm font-medium text-paper-ink transition hover:border-paper-accent"
            >
              Choose file
            </label>
            <input
              id="profile-resume-upload"
              type="file"
              className="sr-only"
              accept=".pdf,.docx,.txt,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  return;
                }
                onResumeFile(file);
              }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-paper border border-paper-border bg-paper-bg px-3 py-2">
            <p className="text-sm text-paper-muted">
              {resumeUploadFileName ? resumeUploadFileName : "No file selected yet."}
            </p>
            {resumeUploadFileName ? (
              <span
                className={`font-sans text-[0.7rem] uppercase tracking-[0.16em] text-paper-muted ${
                  resumeUploadLoading ? "loading-dots" : ""
                }`}
              >
                {resumeUploadLoading ? "Uploading" : "Ready"}
              </span>
            ) : null}
          </div>
        </div>

        {resumeUploadError ? <Notice message={resumeUploadError} tone="error" /> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={onResumeSave} disabled={!canSaveResumeUpload}>
            Save resume
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${mainPanelClassName} space-y-6`}>
      {showTitle ? (
        <div className="space-y-1">
          <h1 className="text-3xl leading-tight">Profile</h1>
          <p className="text-paper-softInk">Update the details that personalize your interviews.</p>
        </div>
      ) : (
        <p className="text-paper-softInk">Update the details that personalize your interviews.</p>
      )}

      <div className="space-y-2">
        <Label htmlFor="profile-name">Name</Label>
        <Input
          id="profile-name"
          value={form.name}
          onChange={(event) => updateField("name", event.target.value)}
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
            value={form.age}
            onChange={(event) => updateField("age", event.target.value)}
            placeholder="29"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-pronouns">Pronouns (optional)</Label>
          <Select
            id="profile-pronouns"
            value={form.pronounsOption}
            className={form.pronounsOption === DEFAULT_PRONOUN_OPTION ? "text-paper-muted font-normal" : "font-normal"}
            onChange={(event) => updateField("pronounsOption", event.target.value)}
          >
            <option value={DEFAULT_PRONOUN_OPTION}>No preference</option>
            {PRONOUN_PRESET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            <option value={CUSTOM_PRONOUN_OPTION}>Custom</option>
          </Select>
          {form.pronounsOption === CUSTOM_PRONOUN_OPTION ? (
            <Input
              id="profile-pronouns-custom"
              value={form.pronounsCustom}
              onChange={(event) => updateField("pronounsCustom", event.target.value)}
              placeholder="Type your pronouns"
            />
          ) : null}
        </div>
      </div>

      {shouldUseResumeSummary ? (
        <div className="space-y-2">
          <Label htmlFor="resume-summary">Resume context summary</Label>
          <Textarea
            id="resume-summary"
            value={form.resumeSummary}
            onChange={(event) => updateField("resumeSummary", event.target.value)}
            rows={4}
            placeholder="Optional summary used to personalize interviews"
          />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="resume-education">Education</Label>
            <Textarea
              id="resume-education"
              value={form.resumeEducation}
              onChange={(event) => updateField("resumeEducation", event.target.value)}
              rows={3}
              placeholder="Schools, programs, and key coursework"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="resume-experience">Experience</Label>
            <Textarea
              id="resume-experience"
              value={form.resumeExperience}
              onChange={(event) => updateField("resumeExperience", event.target.value)}
              rows={4}
              placeholder="Roles, responsibilities, and impact"
            />
          </div>
        </div>
      )}

      <div className="pt-1">
        <Button
          type="button"
          variant="ghost"
          className="px-2 py-1 text-xs"
          onClick={onOpenResumePanel}
        >
          {resumeUploadLabel}
        </Button>
      </div>

      {error ? <Notice message={error} tone="error" /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={onSave} disabled={!isDirty}>
          Save profile
        </Button>
      </div>
    </div>
  );
}

export function ProfileModalContent({
  onResumePanelStateChange,
}: {
  onResumePanelStateChange?: (isOpen: boolean) => void;
}) {
  const {
    profile,
    form,
    error,
    isDirty,
    hasResumeText,
    isResumePanelActive,
    setForm,
    handleSave,
    panelView,
    mainPanelClassName,
    resumePanelClassName,
    resumeUploadFileName,
    resumeUploadStatus,
    resumeUploadError,
    resumeUploadLoading,
    canSaveResumeUpload,
    resumeUploadLabel,
    openResumePanel,
    closeResumePanel,
    handleResumeFile,
    handleResumeUploadSave,
  } = useProfileForm();

  useEffect(() => {
    onResumePanelStateChange?.(isResumePanelActive);
  }, [isResumePanelActive, onResumePanelStateChange]);

  if (!profile || !form) {
    return null;
  }

  return (
    <>
      <ProfileFormFields
        form={form}
        setForm={setForm}
        error={error}
        isDirty={isDirty}
        onSave={handleSave}
        showTitle={false}
        hasResumeText={hasResumeText}
        panelView={panelView}
        mainPanelClassName={mainPanelClassName}
        resumePanelClassName={resumePanelClassName}
        resumeUploadFileName={resumeUploadFileName}
        resumeUploadStatus={resumeUploadStatus}
        resumeUploadError={resumeUploadError}
        resumeUploadLoading={resumeUploadLoading}
        canSaveResumeUpload={canSaveResumeUpload}
        resumeUploadLabel={resumeUploadLabel}
        onOpenResumePanel={openResumePanel}
        onCloseResumePanel={closeResumePanel}
        onResumeFile={handleResumeFile}
        onResumeSave={handleResumeUploadSave}
      />
    </>
  );
}

export function ProfilePage() {
  const {
    profile,
    form,
    error,
    isDirty,
    hasResumeText,
    isResumePanelActive,
    setForm,
    handleSave,
    panelView,
    mainPanelClassName,
    resumePanelClassName,
    resumeUploadFileName,
    resumeUploadStatus,
    resumeUploadError,
    resumeUploadLoading,
    canSaveResumeUpload,
    resumeUploadLabel,
    openResumePanel,
    closeResumePanel,
    handleResumeFile,
    handleResumeUploadSave,
  } = useProfileForm();

  if (!profile || !form) {
    return (
      <main className="space-y-6">
        <Card className="space-y-3">
          <h1 className="text-3xl">Profile not found</h1>
          <p className="text-paper-softInk">Complete onboarding to create your profile.</p>
          <Link href="/">
            <Button>Go to role dashboard</Button>
          </Link>
        </Card>
      </main>
    );
  }

  return (
    <main className="space-y-8">
      <header className="flex items-center justify-between gap-4">
        {!isResumePanelActive ? (
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-sans text-xs uppercase tracking-[0.14em] text-paper-muted hover:text-paper-ink"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M11.78 4.22a.75.75 0 0 1 0 1.06L7.06 10l4.72 4.72a.75.75 0 1 1-1.06 1.06l-5.25-5.25a.75.75 0 0 1 0-1.06l5.25-5.25a.75.75 0 0 1 1.06 0Z"
                clipRule="evenodd"
              />
            </svg>
            Role Dashboard
          </Link>
        ) : (
          <span className="inline-flex items-center gap-2 font-sans text-xs uppercase tracking-[0.14em] text-paper-muted">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M11.78 4.22a.75.75 0 0 1 0 1.06L7.06 10l4.72 4.72a.75.75 0 1 1-1.06 1.06l-5.25-5.25a.75.75 0 0 1 0-1.06l5.25-5.25a.75.75 0 0 1 1.06 0Z"
                clipRule="evenodd"
              />
            </svg>
            Role Dashboard
          </span>
        )}
      </header>

      <div className="flex justify-center">
        <Card className="w-full max-w-3xl space-y-6 p-8 md:p-10">
          <ProfileFormFields
            form={form}
            setForm={setForm}
            error={error}
            isDirty={isDirty}
            onSave={handleSave}
            showTitle
            hasResumeText={hasResumeText}
            panelView={panelView}
            mainPanelClassName={mainPanelClassName}
            resumePanelClassName={resumePanelClassName}
            resumeUploadFileName={resumeUploadFileName}
            resumeUploadStatus={resumeUploadStatus}
            resumeUploadError={resumeUploadError}
            resumeUploadLoading={resumeUploadLoading}
            canSaveResumeUpload={canSaveResumeUpload}
            resumeUploadLabel={resumeUploadLabel}
            onOpenResumePanel={openResumePanel}
            onCloseResumePanel={closeResumePanel}
            onResumeFile={handleResumeFile}
            onResumeSave={handleResumeUploadSave}
          />
        </Card>
      </div>
    </main>
  );
}
