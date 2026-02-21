"use client";

import { FormEvent, useMemo, useState, type ReactNode } from "react";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import { Notice } from "@/src/components/ui/notice";

export interface RoleFormValues {
  title: string;
  organizationName: string;
  organizationDescription: string;
  fullJobDescription: string;
}

export const emptyRoleFormValues: RoleFormValues = {
  title: "",
  organizationName: "",
  organizationDescription: "",
  fullJobDescription: "",
};

export function RoleForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  extraActions,
}: {
  initialValues: RoleFormValues;
  submitLabel: string;
  onSubmit: (values: RoleFormValues) => void;
  onCancel: () => void;
  extraActions?: ReactNode;
}) {
  const [values, setValues] = useState<RoleFormValues>(initialValues);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => values.title.trim().length > 0, [values.title]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      setError("Role title is required.");
      return;
    }

    onSubmit({
      ...values,
      title: values.title.trim(),
    });
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="role-title">Role Title</Label>
        <Input
          id="role-title"
          value={values.title}
          onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}
          placeholder="Product Manager Intern"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="org-name">Organization name</Label>
        <Input
          id="org-name"
          value={values.organizationName}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              organizationName: event.target.value,
            }))
          }
          placeholder="Acme Corp"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="org-description">Organization description</Label>
        <Textarea
          id="org-description"
          value={values.organizationDescription}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              organizationDescription: event.target.value,
            }))
          }
          rows={3}
          placeholder="Share information about the organization"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="job-description">Full job description</Label>
        <Textarea
          id="job-description"
          value={values.fullJobDescription}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              fullJobDescription: event.target.value,
            }))
          }
          rows={6}
          placeholder="Paste full job description here"
        />
      </div>

      {error ? <Notice tone="error" message={error} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!canSubmit}>
            {submitLabel}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
        {extraActions ? <div className="flex items-center">{extraActions}</div> : null}
      </div>
    </form>
  );
}
