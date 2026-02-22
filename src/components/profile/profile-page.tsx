"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
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

const logger = createLogger("profile");

interface ProfileDraft {
  name: string;
  age: string;
  pronounsOption: string;
  pronounsCustom: string;
  resumeSummary: string;
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
  setForm: Dispatch<SetStateAction<ProfileDraft | null>>;
  handleSave: () => void;
}

function useProfileForm(): ProfileFormState {
  const { store, saveProfile } = useAppStore();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileDraft | null>(null);

  useEffect(() => {
    if (!store.profile) {
      return;
    }
    setForm(toDraft(store.profile));
  }, [store.profile]);

  const profile = store.profile;
  const isDirty =
    profile && form
      ? form.name.trim() !== profile.name ||
        form.age.trim() !== (profile.age ? String(profile.age) : "") ||
        resolvePronounsValue(form) !== profile.pronouns ||
        form.resumeSummary.trim() !== profile.resumeSummary
      : false;

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
    });

    logger.info("profile.saved", {
      hasResumeText: Boolean(store.profile?.resumeText),
      hasResumeSummary: Boolean(form.resumeSummary),
    });

    router.push("/");
  };

  return {
    profile,
    form,
    error,
    isDirty,
    setForm,
    handleSave,
  };
}

function ProfileFormFields({
  form,
  setForm,
  error,
  isDirty,
  onSave,
  showTitle,
}: {
  form: ProfileDraft;
  setForm: Dispatch<SetStateAction<ProfileDraft | null>>;
  error: string | null;
  isDirty: boolean;
  onSave: () => void;
  showTitle: boolean;
}) {
  const updateField = (field: keyof ProfileDraft, value: string) => {
    setForm((current) => (current ? { ...current, [field]: value } : current));
  };

  return (
    <div className="space-y-6">
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

      {error ? <Notice message={error} tone="error" /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={onSave} disabled={!isDirty}>
          Save profile
        </Button>
      </div>
    </div>
  );
}

export function ProfileModalContent() {
  const { profile, form, error, isDirty, setForm, handleSave } = useProfileForm();

  if (!profile || !form) {
    return null;
  }

  return (
    <ProfileFormFields
      form={form}
      setForm={setForm}
      error={error}
      isDirty={isDirty}
      onSave={handleSave}
      showTitle={false}
    />
  );
}

export function ProfilePage() {
  const { profile, form, error, isDirty, setForm, handleSave } = useProfileForm();

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
          />
        </Card>
      </div>
    </main>
  );
}
