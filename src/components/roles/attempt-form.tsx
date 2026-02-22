"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/src/components/ui/button";
import { Label } from "@/src/components/ui/label";
import { Notice } from "@/src/components/ui/notice";
import { Select } from "@/src/components/ui/select";
import { Slider } from "@/src/components/ui/slider";
import { Textarea } from "@/src/components/ui/textarea";
import { INTERVIEW_CATEGORY_OPTIONS, type InterviewConfig } from "@/src/lib/types";

export const defaultInterviewConfig: InterviewConfig = {
  personaIntensity: 3,
  followUpIntensity: 4,
  primaryQuestionCount: 4,
  category: "Strictly Behavioral",
  notes: "",
};

export function AttemptForm({
  onSubmit,
  onCancel,
  loading,
  error,
}: {
  onSubmit: (config: InterviewConfig) => void;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
}) {
  const [config, setConfig] = useState<InterviewConfig>(defaultInterviewConfig);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(config);
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="persona-intensity">Interviewer Tone</Label>
        <Slider
          id="persona-intensity"
          min={1}
          max={10}
          step={1}
          value={config.personaIntensity}
          onChange={(event) =>
            setConfig((current) => ({
              ...current,
              personaIntensity: Number(event.target.value),
            }))
          }
          labels={{ min: "Friendly", max: "Dry" }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="follow-up-intensity">Follow-up Frequency</Label>
        <Slider
          id="follow-up-intensity"
          min={1}
          max={10}
          step={1}
          value={config.followUpIntensity}
          onChange={(event) =>
            setConfig((current) => ({
              ...current,
              followUpIntensity: Number(event.target.value),
            }))
          }
          labels={{ min: "Never", max: "Up to 2 follow-ups" }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="question-count">Length (primary questions)</Label>
        <Slider
          id="question-count"
          min={1}
          max={6}
          step={1}
          value={config.primaryQuestionCount}
          onChange={(event) =>
            setConfig((current) => ({
              ...current,
              primaryQuestionCount: Number(event.target.value),
            }))
          }
          labels={{ min: "1", max: "6" }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Select
          id="category"
          value={config.category}
          onChange={(event) =>
            setConfig((current) => ({
              ...current,
              category: event.target.value as InterviewConfig["category"],
            }))
          }
        >
          {INTERVIEW_CATEGORY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Anything else to know or do in this interview?</Label>
        <Textarea
          id="notes"
          value={config.notes}
          onChange={(event) => setConfig((current) => ({ ...current, notes: event.target.value }))}
          rows={4}
          placeholder="Optional guidance for style, focus, or pressure"
        />
      </div>

      {error ? <Notice tone="error" message={error} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Generating script..." : "Create interview"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
