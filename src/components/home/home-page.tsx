"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useAppStore } from "@/src/components/providers/app-store-provider";
import { RoleForm, emptyRoleFormValues } from "@/src/components/roles/role-form";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Modal } from "@/src/components/ui/modal";
import { formatDateTime } from "@/src/lib/utils/time";

export function HomePage() {
  const { store, createRole } = useAppStore();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const roles = useMemo(() => {
    return [...store.roles].sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1));
  }, [store.roles]);

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <p className="font-sans text-xs uppercase tracking-[0.14em] text-paper-muted">Quiet Interview</p>
        <h1 className="text-4xl leading-tight md:text-5xl">Role Practice</h1>
        <p className="max-w-2xl text-paper-softInk">
          Build a role profile, generate an interviewer script, and practice realistic conversations.
        </p>
      </header>

      {roles.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => setIsCreateOpen(true)}>
            Create role
          </Button>
        </div>
      ) : null}

      {roles.length === 0 ? (
        <Card className="space-y-3">
          <h2 className="text-2xl">No roles yet</h2>
          <p className="text-paper-softInk">
            Start with one role context. You can add as much detail as you want and generate interview attempts under it.
          </p>
          <Button type="button" onClick={() => setIsCreateOpen(true)}>
            Practice for your first role
          </Button>
        </Card>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {roles.map((role) => {
            const attemptsForRole = store.attempts.filter((attempt) => attempt.roleId === role.id);

            return (
              <Link key={role.id} href={`/roles/${role.id}`}>
                <Card className="h-full space-y-4 transition hover:border-paper-accent">
                  <div className="space-y-1">
                    <h2 className="text-2xl leading-tight">{role.title}</h2>
                    <p className="font-sans text-xs uppercase tracking-[0.1em] text-paper-muted">
                      Updated {formatDateTime(role.updatedAt)}
                    </p>
                  </div>

                  <p className="text-paper-softInk">
                    {role.organizationName || role.organizationDescription || "No additional role notes yet."}
                  </p>

                  <p className="font-sans text-xs uppercase tracking-[0.1em] text-paper-muted">
                    {attemptsForRole.length} interview {attemptsForRole.length === 1 ? "attempt" : "attempts"}
                  </p>
                </Card>
              </Link>
            );
          })}
        </section>
      )}

      {isCreateOpen ? (
        <Modal title="Create role" onClose={() => setIsCreateOpen(false)}>
          <RoleForm
            initialValues={emptyRoleFormValues}
            submitLabel="Save role"
            onSubmit={(values) => {
              createRole(values);
              setIsCreateOpen(false);
            }}
            onCancel={() => setIsCreateOpen(false)}
          />
        </Modal>
      ) : null}
    </main>
  );
}
