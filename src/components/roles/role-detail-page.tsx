"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAppStore } from "@/src/components/providers/app-store-provider";
import { AttemptForm } from "@/src/components/roles/attempt-form";
import { RoleForm, type RoleFormValues } from "@/src/components/roles/role-form";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Modal } from "@/src/components/ui/modal";
import { Notice } from "@/src/components/ui/notice";
import { requestInterviewScript } from "@/src/lib/ai/client-api";
import { cn } from "@/src/lib/utils/cn";
import { formatDateTime } from "@/src/lib/utils/time";

const statusCopy: Record<string, string> = {
  script_pending: "Generating script",
  ready: "Ready",
  in_progress: "In progress",
  analysis_pending: "Analyzing",
  complete: "Complete",
  error: "Needs attention",
};

function toRoleFormValues(values: {
  title: string;
  organizationName: string;
  organizationDescription: string;
  fullJobDescription: string;
}): RoleFormValues {
  return {
    title: values.title,
    organizationName: values.organizationName,
    organizationDescription: values.organizationDescription,
    fullJobDescription: values.fullJobDescription,
  };
}

export function RoleDetailPage({ roleId }: { roleId: string }) {
  const {
    store,
    updateRole,
    createAttempt,
    setAttemptScript,
    setAttemptStatus,
    patchAttempt,
    deleteRole,
    newlyCreatedAttemptId,
  } = useAppStore();
  const router = useRouter();

  const [editOpen, setEditOpen] = useState(false);
  const [attemptOpen, setAttemptOpen] = useState(false);
  const [attemptLoading, setAttemptLoading] = useState(false);
  const [attemptError, setAttemptError] = useState<string | null>(null);
  const [creatingAttemptId, setCreatingAttemptId] = useState<string | null>(null);

  const role = useMemo(() => store.roles.find((item) => item.id === roleId) ?? null, [store.roles, roleId]);
  const attempts = useMemo(() => {
    return store.attempts
      .filter((item) => item.roleId === roleId)
      .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1));
  }, [store.attempts, roleId]);

  if (!role) {
    return (
      <main className="space-y-6">
        <Card className="space-y-3">
          <h1 className="text-3xl">Role not found</h1>
          <p className="text-paper-softInk">This role does not exist in local storage anymore.</p>
          <Link href="/">
            <Button>Back to home</Button>
          </Link>
        </Card>
      </main>
    );
  }

  if (attemptLoading && creatingAttemptId) {
    return (
      <main className="page-enter flex min-h-[72vh] items-center justify-center">
        <Card className="w-full max-w-2xl space-y-5">
          <p className="font-sans text-xs uppercase tracking-[0.12em] text-paper-muted">Preparing interview session</p>
          <h1 className="text-3xl leading-tight">Generating your interviewer script</h1>
          <p className="text-paper-softInk">
            Building a custom session for <span className="text-paper-ink">{role.title}</span>. You&apos;ll be taken to the
            interview start screen as soon as it&apos;s ready.
          </p>
          <p className="font-sans text-xs uppercase tracking-[0.12em] text-paper-muted">
            <span className="loading-dots">Generating</span>
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="page-enter space-y-8">
      <header className="max-w-3xl space-y-4">
        <h1 className="text-4xl leading-tight">{role.title}</h1>
        <p className="text-paper-softInk">
          {role.organizationName || role.organizationDescription || "Add context in settings to personalize interviews."}
        </p>
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="inline-flex w-fit items-center gap-2 text-paper-softInk transition hover:text-paper-ink hover:underline"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0A1.65 1.65 0 0 0 20.91 10H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
          <span>Role settings</span>
        </button>
      </header>

      <section className="space-y-3">
        <h2 className="text-2xl">Interview Sessions</h2>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <button
              type="button"
              className="text-left"
              onClick={() => setAttemptOpen(true)}
            >
              <Card className="flex h-full flex-col items-center justify-center gap-3 transition-all duration-200 hover:-translate-y-1 hover:border-paper-accent hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)]">
                <span className="text-4xl leading-none text-paper-softInk">+</span>
                <span className="font-sans text-sm text-paper-ink">Create interview</span>
              </Card>
            </button>
            {attempts.map((attempt) => (
              <Link
                key={attempt.id}
                href={
                  attempt.status === "analysis_pending" || attempt.status === "complete"
                    ? `/roles/${role.id}/attempts/${attempt.id}/conclusion`
                    : `/roles/${role.id}/attempts/${attempt.id}`
                }
              >
                <Card
                  className={cn(
                    "h-full space-y-4 transition-all duration-200 hover:-translate-y-1 hover:border-paper-accent hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)]",
                    attempt.id === newlyCreatedAttemptId && "card-glow-border card-pop"
                  )}
                >
                  <div className="space-y-1">
                    <h3 className="text-xl">{attempt.config.category}</h3>
                    <p className="font-sans text-xs uppercase tracking-[0.1em] text-paper-muted">
                      {attempt.config.primaryQuestionCount} primary questions
                    </p>
                  </div>

                  <p className="text-paper-softInk">Status: {statusCopy[attempt.status] || attempt.status}</p>

                  <p className="font-sans text-xs uppercase tracking-[0.1em] text-paper-muted">
                    Created {formatDateTime(attempt.createdAt)}
                  </p>

                  {attempt.lastError ? <Notice tone="error" message={attempt.lastError} /> : null}
                </Card>
              </Link>
            ))}
        </div>
      </section>

      {editOpen ? (
        <Modal title="Edit role" onClose={() => setEditOpen(false)}>
          <RoleForm
            initialValues={toRoleFormValues(role)}
            submitLabel="Save changes"
            onSubmit={(values) => {
              updateRole(role.id, values);
              setEditOpen(false);
            }}
            onCancel={() => setEditOpen(false)}
            extraActions={
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  const confirmed = window.confirm(
                    "Delete this role and all practice sessions tied to it?",
                  );
                  if (!confirmed) {
                    return;
                  }
                  deleteRole(role.id);
                  setEditOpen(false);
                  router.push("/");
                }}
              >
                Delete
              </Button>
            }
          />
        </Modal>
      ) : null}

      {attemptOpen ? (
        <Modal title="Create interview" onClose={() => setAttemptOpen(false)}>
          <AttemptForm
            loading={attemptLoading}
            error={attemptError}
            onCancel={() => setAttemptOpen(false)}
            onSubmit={async (config) => {
              if (!store.profile) {
                setAttemptError("Complete onboarding before creating interviews.");
                return;
              }

              setAttemptError(null);
              setAttemptLoading(true);

              const attempt = createAttempt(role.id, config);
              setAttemptOpen(false);
              setCreatingAttemptId(attempt.id);
              let shouldResetLoading = true;

              try {
                const script = await requestInterviewScript({
                  profile: store.profile,
                  role,
                  config,
                });
                setAttemptScript(attempt.id, script);
                shouldResetLoading = false;
                router.replace(`/roles/${role.id}/attempts/${attempt.id}`);
              } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to generate script.";
                setAttemptStatus(attempt.id, "error", message);
                patchAttempt(attempt.id, {
                  script: null,
                });
                setAttemptError(message);
                setCreatingAttemptId(null);
                setAttemptOpen(true);
              } finally {
                if (shouldResetLoading) {
                  setAttemptLoading(false);
                }
              }
            }}
          />
        </Modal>
      ) : null}
    </main>
  );
}
