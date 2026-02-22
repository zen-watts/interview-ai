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
  } = useAppStore();
  const router = useRouter();

  const [editOpen, setEditOpen] = useState(false);
  const [attemptOpen, setAttemptOpen] = useState(false);
  const [attemptLoading, setAttemptLoading] = useState(false);
  const [attemptError, setAttemptError] = useState<string | null>(null);

  const role = useMemo(() => store.roles.find((item) => item.id === roleId) ?? null, [store.roles, roleId]);
  const attempts = useMemo(() => {
    return store.attempts
      .filter((item) => item.roleId === roleId)
      .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
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

  return (
    <main className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link href="/" className="font-sans text-xs uppercase tracking-[0.12em] text-paper-muted hover:text-paper-ink">
            Home
          </Link>
          <h1 className="text-4xl leading-tight">{role.title}</h1>
          <p className="max-w-3xl text-paper-softInk">
            {role.organizationName || role.organizationDescription || "Add context in settings to personalize interviews."}
          </p>
        </div>

        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => setEditOpen(true)}>
            Edit role
          </Button>
          {attempts.length > 0 ? <Button onClick={() => setAttemptOpen(true)}>Create interview</Button> : null}
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-2xl">Interview attempts</h2>

        {attempts.length === 0 ? (
          <Card className="space-y-3">
            <p className="text-paper-softInk">No interview attempts yet for this role.</p>
            <Button type="button" onClick={() => setAttemptOpen(true)}>
              Create interview
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {attempts.map((attempt) => (
              <Link
                key={attempt.id}
                href={
                  attempt.status === "analysis_pending" || attempt.status === "complete"
                    ? `/roles/${role.id}/attempts/${attempt.id}/conclusion`
                    : `/roles/${role.id}/attempts/${attempt.id}`
                }
              >
                <Card className="h-full space-y-4 transition hover:border-paper-accent">
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
        )}
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
                    "Delete this role and all interview attempts tied to it?",
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

              try {
                const script = await requestInterviewScript({
                  profile: store.profile,
                  role,
                  config,
                });
                setAttemptScript(attempt.id, script);
                setAttemptOpen(false);
              } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to generate script.";
                setAttemptStatus(attempt.id, "error", message);
                patchAttempt(attempt.id, {
                  script: null,
                });
                setAttemptError(message);
              } finally {
                setAttemptLoading(false);
              }
            }}
          />
        </Modal>
      ) : null}
    </main>
  );
}
