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
  const { store, createRole, toggleRoleFavorite } = useAppStore();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const roles = useMemo(() => {
    return [...store.roles].sort((a, b) => {
      if (a.isFavorited !== b.isFavorited) {
        return a.isFavorited ? -1 : 1;
      }
      return a.updatedAt > b.updatedAt ? -1 : 1;
    });
  }, [store.roles]);

  return (
    <main className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="font-sans text-xs uppercase tracking-[0.14em] text-paper-muted">Inner View</p>
          <h1 className="text-4xl leading-tight md:text-5xl">Role Practice</h1>
          <p className="max-w-2xl text-paper-softInk">
            Build a role profile, generate an interviewer script, and practice realistic conversations.
          </p>
        </div>

        <Link
          href="/profile"
          className="font-sans text-xs uppercase tracking-[0.14em] text-paper-muted hover:text-paper-ink"
        >
          Profile
        </Link>
      </header>

      {roles.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => setIsCreateOpen(true)}>
            <span>Create role</span>
            <span className="ml-2 text-lg leading-none">+</span>
          </Button>
        </div>
      ) : null}

      {roles.length === 0 ? (
        <Card className="space-y-3">
          <h2 className="text-2xl">No roles yet</h2>
          <p className="text-paper-softInk">
            Start with one role context. You can add as much detail as you want and generate practice sessions under it.
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
                <Card className="relative h-full space-y-4 transition hover:border-paper-accent">
                  <button
                    type="button"
                    aria-label={role.isFavorited ? "Unfavorite role" : "Favorite role"}
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
                      strokeWidth={1.5}
                      className={`h-5 w-5 ${role.isFavorited ? "text-paper-accent" : "text-paper-muted"}`}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
                      />
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
                    {attemptsForRole.length} times practiced
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
