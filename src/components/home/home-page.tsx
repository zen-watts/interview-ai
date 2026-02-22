"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useAppStore } from "@/src/components/providers/app-store-provider";
import { RoleForm, emptyRoleFormValues } from "@/src/components/roles/role-form";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Modal } from "@/src/components/ui/modal";
import type { RoleProfile } from "@/src/lib/types";
import { formatDateTime } from "@/src/lib/utils/time";

function sortByUpdatedAt(a: RoleProfile, b: RoleProfile) {
  return a.updatedAt > b.updatedAt ? -1 : 1;
}

export function HomePage() {
  const { store, createRole, toggleRoleFavorite } = useAppStore();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const pinnedRoles = useMemo(() => {
    return store.roles.filter((r) => r.isFavorited).sort(sortByUpdatedAt);
  }, [store.roles]);

  const allRoles = useMemo(() => {
    return store.roles.filter((r) => !r.isFavorited).sort(sortByUpdatedAt);
  }, [store.roles]);

  const hasRoles = store.roles.length > 0;

  function RoleCard({ role }: { role: RoleProfile }) {
    const attemptsForRole = store.attempts.filter((attempt) => attempt.roleId === role.id);

    return (
      <Link href={`/roles/${role.id}`}>
        <Card className="relative h-full space-y-4 transition hover:border-paper-accent">
          <button
            type="button"
            aria-label={role.isFavorited ? "Unpin role" : "Pin role"}
            className="absolute right-3 top-3 p-1 transition hover:scale-110"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleRoleFavorite(role.id);
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill={role.isFavorited ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-5 w-5 ${role.isFavorited ? "text-paper-accent" : "text-paper-muted"}`}
            >
              <path d="M12 17v5" />
              <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
            </svg>
          </button>

          <div className="space-y-1 pr-8">
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
  }

  return (
    <main className="space-y-8">
      <header>
        <h1 className="text-4xl leading-tight md:text-5xl">Role Dashboard</h1>
      </header>

      {!hasRoles ? (
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
        <>
          {pinnedRoles.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-medium">Pinned</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {pinnedRoles.map((role) => (
                  <RoleCard key={role.id} role={role} />
                ))}
              </div>
            </section>
          )}

          <section className="space-y-4">
            <h2 className="text-lg font-medium">All roles</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <button
                type="button"
                className="text-left"
                onClick={() => setIsCreateOpen(true)}
              >
                <Card className="flex h-full flex-col items-center justify-center gap-3 transition hover:border-paper-accent">
                  <span className="text-4xl leading-none text-paper-muted">+</span>
                  <span className="font-sans text-sm text-paper-muted">Create role</span>
                </Card>
              </button>
              {allRoles.map((role) => (
                <RoleCard key={role.id} role={role} />
              ))}
            </div>
          </section>
        </>
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
