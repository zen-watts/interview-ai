"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/src/components/ui/button";
import { Label } from "@/src/components/ui/label";
import { Notice } from "@/src/components/ui/notice";
import { Slider } from "@/src/components/ui/slider";
import { Textarea } from "@/src/components/ui/textarea";
import { cn } from "@/src/lib/utils/cn";
import { INTERVIEW_CATEGORY_OPTIONS, type InterviewCategory, type InterviewConfig } from "@/src/lib/types";

export const defaultInterviewConfig: InterviewConfig = {
  temperament: 25,
  questionDifficulty: 25,
  followUpIntensity: 45,
  primaryQuestionCount: 5,
  categories: ["Strictly Behavioral"],
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
        <Label htmlFor="temperament" hint="Controls the interviewer's tone and demeanor, from warm and supportive to high-pressure and intense.">Temperament</Label>
        <Slider
          id="temperament"
          min={0}
          max={100}
          step={1}
          value={config.temperament}
          onChange={(event) =>
            setConfig((current) => ({
              ...current,
              temperament: Number(event.target.value),
            }))
          }
          labels={{ min: "Calm", max: "Intense" }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="question-difficulty" hint="Sets the complexity of questions, from entry-level fundamentals to expert scenarios requiring deep expertise.">Question Difficulty</Label>
        <Slider
          id="question-difficulty"
          min={0}
          max={100}
          step={1}
          value={config.questionDifficulty}
          onChange={(event) =>
            setConfig((current) => ({
              ...current,
              questionDifficulty: Number(event.target.value),
            }))
          }
          labels={{ min: "Beginner", max: "Expert" }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="follow-up-intensity" hint="How often the interviewer digs deeper into your answers with follow-up questions.">Follow-up Frequency</Label>
        <Slider
          id="follow-up-intensity"
          min={0}
          max={100}
          step={1}
          value={config.followUpIntensity}
          onChange={(event) =>
            setConfig((current) => ({
              ...current,
              followUpIntensity: Number(event.target.value),
            }))
          }
          labels={{ min: "Never", max: "Multiple per question" }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="question-count" hint="The total number of main questions in the interview. More questions means a longer session.">Length (primary questions)</Label>
        <Slider
          id="question-count"
          min={1}
          max={10}
          step={1}
          value={config.primaryQuestionCount}
          onChange={(event) =>
            setConfig((current) => ({
              ...current,
              primaryQuestionCount: Number(event.target.value),
            }))
          }
          labels={{ min: "1", max: "10" }}
        />
      </div>

      <div className="space-y-2">
        <Label hint="Pick one or more question types. Select multiple to create a blended interview.">Categories</Label>
        <div className="flex flex-wrap gap-2">
          {INTERVIEW_CATEGORY_OPTIONS.map((option) => {
            const isSelected = config.categories.includes(option);
            return (
              <button
                key={option}
                type="button"
                className={cn(
                  "rounded-paper border px-3 py-1.5 font-sans text-sm transition",
                  isSelected
                    ? "border-paper-accent bg-paper-accent/10 text-paper-ink"
                    : "border-paper-border text-paper-muted hover:border-paper-accent",
                )}
                onClick={() =>
                  setConfig((current) => {
                    const next = isSelected
                      ? current.categories.filter((c) => c !== option)
                      : [...current.categories, option];
                    return { ...current, categories: next.length > 0 ? next : current.categories };
                  })
                }
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes" hint="Optional free-text instructions for the interviewer — focus areas, scenarios to include, or anything else.">Anything else to know or do in this interview?</Label>
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
