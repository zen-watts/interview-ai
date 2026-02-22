"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAppStore } from "@/src/components/providers/app-store-provider";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Notice } from "@/src/components/ui/notice";
import { Textarea } from "@/src/components/ui/textarea";
import { createLogger } from "@/src/lib/logger";
import type { UserProfile } from "@/src/lib/types";

const logger = createLogger("profile");

interface ProfileDraft {
  name: string;
  age: string;
  pronouns: string;
  resumeSummary: string;
}

function toDraft(profile: UserProfile): ProfileDraft {
  return {
    name: profile.name,
    age: profile.age ? String(profile.age) : "",
    pronouns: profile.pronouns,
    resumeSummary: profile.resumeSummary,
  };
}

export function ProfilePage() {
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

  if (!store.profile || !form) {
    return (
      <main className="space-y-6">
        <Card className="space-y-3">
          <h1 className="text-3xl">Profile not found</h1>
          <p className="text-paper-softInk">Complete onboarding to create your profile.</p>
          <Link href="/">
            <Button>Go to role practice</Button>
          </Link>
        </Card>
      </main>
    );
  }

  const handleSave = () => {
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
      targetJob: store.profile?.targetJob || "Defined per role",
      experienceLevel: store.profile?.experienceLevel || "new_grad",
      age: parsedAge,
      pronouns: form.pronouns.trim(),
      resumeText: store.profile?.resumeText || "",
      resumeSummary: form.resumeSummary.trim(),
    });

    logger.info("profile.saved", {
      hasResumeText: Boolean(form.resumeText),
      hasResumeSummary: Boolean(form.resumeSummary),
    });

    router.push("/");
  };

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
          Role Practice
        </Link>
      </header>

      <div className="flex justify-center">
        <Card className="w-full max-w-3xl space-y-6 p-8 md:p-10">
          <div className="space-y-1">
            <h1 className="text-3xl leading-tight">Profile</h1>
            <p className="text-paper-softInk">Update the details that personalize your interviews.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              value={form.name}
              onChange={(event) => setForm((current) => (current ? { ...current, name: event.target.value } : current))}
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
                onChange={(event) => setForm((current) => (current ? { ...current, age: event.target.value } : current))}
                placeholder="29"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-pronouns">Pronouns (optional)</Label>
              <Input
                id="profile-pronouns"
                value={form.pronouns}
                onChange={(event) =>
                  setForm((current) => (current ? { ...current, pronouns: event.target.value } : current))
                }
                placeholder="she/her, he/him, they/them"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="resume-summary">Resume context summary</Label>
            <Textarea
              id="resume-summary"
              value={form.resumeSummary}
              onChange={(event) =>
                setForm((current) => (current ? { ...current, resumeSummary: event.target.value } : current))
              }
              rows={4}
              placeholder="Optional summary used to personalize interviews"
            />
          </div>

          {error ? <Notice message={error} tone="error" /> : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={handleSave}>
              Save profile
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
