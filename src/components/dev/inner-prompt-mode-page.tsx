"use client";

import { useEffect, useMemo, useState } from "react";

import { useAppStore } from "@/src/components/providers/app-store-provider";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Notice } from "@/src/components/ui/notice";
import { Select } from "@/src/components/ui/select";
import { Textarea } from "@/src/components/ui/textarea";
import { requestInterviewScript, requestInterviewTurn } from "@/src/lib/ai/client-api";
import { assembleScriptGenerationCall } from "@/src/lib/ai/script-generation/assemble-script-generation-call";
import { createLogger } from "@/src/lib/logger";
import { migrateToCurrentSchema } from "@/src/lib/storage/schema";
import {
  END_TOKEN,
  INTERVIEW_CATEGORY_OPTIONS,
  type InterviewConfig,
  type TranscriptTurn,
} from "@/src/lib/types";
import { createId } from "@/src/lib/utils/id";
import { nowIso } from "@/src/lib/utils/time";

const logger = createLogger("inner-prompt-mode");

const defaultConfig: InterviewConfig = {
  personaIntensity: 25,
  followUpIntensity: 45,
  primaryQuestionCount: 5,
  category: "Strictly Behavioral",
  notes: "",
};

type Stage = 1 | 2 | 3;

export function InnerPromptModePage() {
  const { hydrated, store, replaceStore } = useAppStore();

  const [stage, setStage] = useState<Stage>(1);

  const [contextJson, setContextJson] = useState("");
  const [contextDirty, setContextDirty] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [contextStatus, setContextStatus] = useState<string | null>(null);

  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [config, setConfig] = useState<InterviewConfig>(defaultConfig);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [generatedScript, setGeneratedScript] = useState("");

  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [answerDraft, setAnswerDraft] = useState("");
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [interviewComplete, setInterviewComplete] = useState(false);

  useEffect(() => {
    if (!hydrated || contextDirty) {
      return;
    }

    setContextJson(JSON.stringify(store, null, 2));
  }, [contextDirty, hydrated, store]);

  useEffect(() => {
    const roleExists = store.roles.some((role) => role.id === selectedRoleId);
    if (roleExists) {
      return;
    }

    setSelectedRoleId(store.roles[0]?.id || "");
  }, [selectedRoleId, store.roles]);

  const selectedRole = useMemo(() => {
    return store.roles.find((role) => role.id === selectedRoleId) || null;
  }, [selectedRoleId, store.roles]);

  const assembledMessages = useMemo(() => {
    if (!store.profile || !selectedRole) {
      return null;
    }

    return assembleScriptGenerationCall({
      profile: store.profile,
      role: selectedRole,
      config,
    });
  }, [config, selectedRole, store.profile]);

  const applyContextJson = () => {
    setContextError(null);
    setContextStatus(null);

    try {
      const parsed = JSON.parse(contextJson) as unknown;
      const normalized = migrateToCurrentSchema(parsed);
      replaceStore(normalized);
      setContextJson(JSON.stringify(normalized, null, 2));
      setContextDirty(false);
      setContextStatus("Context updated from JSON editor.");
      logger.info("Developer context editor applied local store JSON.", {
        roleCount: normalized.roles.length,
        attemptCount: normalized.attempts.length,
        hasProfile: Boolean(normalized.profile),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid JSON payload.";
      setContextError(message);
      logger.error("Developer context editor failed to parse JSON.", { message });
    }
  };

  const resetContextEditor = () => {
    setContextError(null);
    setContextStatus(null);
    setContextDirty(false);
    setContextJson(JSON.stringify(store, null, 2));
  };

  const generateScript = async () => {
    if (!store.profile) {
      setScriptError("Profile is missing. Add it in stage 1 before generating a script.");
      return;
    }

    if (!selectedRole) {
      setScriptError("Role is missing. Add at least one role in stage 1.");
      return;
    }

    setScriptLoading(true);
    setScriptError(null);

    try {
      const script = await requestInterviewScript({
        profile: store.profile,
        role: selectedRole,
        config,
      });
      setGeneratedScript(script);
      logger.info("Inner prompt mode generated an interviewer script.", {
        roleId: selectedRole.id,
        scriptLength: script.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate script.";
      setScriptError(message);
      logger.error("Inner prompt mode failed to generate interviewer script.", { message });
    } finally {
      setScriptLoading(false);
    }
  };

  const requestNextTurn = async (nextTranscript: TranscriptTurn[]) => {
    const trimmedScript = generatedScript.trim();

    if (!trimmedScript) {
      setLiveError("Generate a script in stage 2 before starting stage 3.");
      return;
    }

    setLiveLoading(true);
    setLiveError(null);

    try {
      const next = await requestInterviewTurn({
        script: trimmedScript,
        transcript: nextTranscript,
        primaryQuestionCount: config.primaryQuestionCount,
      });

      if (next.isEnd || next.question.trim() === END_TOKEN) {
        if (next.response.trim()) {
          const closingTurn: TranscriptTurn = {
            id: createId(),
            role: "assistant",
            content: `Response: ${next.response.trim()}`,
            createdAt: nowIso(),
          };
          setTranscript((current) => [...current, closingTurn]);
        }

        setInterviewComplete(true);
        logger.info("Inner prompt mode interview reached end token.", {
          transcriptLength: nextTranscript.length,
        });
        return;
      }

      const assistantTurn: TranscriptTurn = {
        id: createId(),
        role: "assistant",
        content: next.message.trim(),
        createdAt: nowIso(),
      };

      setTranscript((current) => [...current, assistantTurn]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to get next interviewer turn.";
      setLiveError(message);
      logger.error("Inner prompt mode interview turn request failed.", { message });
    } finally {
      setLiveLoading(false);
    }
  };

  const startInterview = async () => {
    setTranscript([]);
    setAnswerDraft("");
    setInterviewComplete(false);
    await requestNextTurn([]);
  };

  const sendAnswer = async () => {
    const content = answerDraft.trim();
    if (!content) {
      setLiveError("Type an answer before sending.");
      return;
    }

    const userTurn: TranscriptTurn = {
      id: createId(),
      role: "user",
      content,
      createdAt: nowIso(),
    };

    const nextTranscript = [...transcript, userTurn];
    setTranscript(nextTranscript);
    setAnswerDraft("");
    await requestNextTurn(nextTranscript);
  };

  const stageButtonVariant = (candidate: Stage) => (stage === candidate ? "primary" : "ghost");

  return (
    <main className="space-y-6 pb-16">
      <header className="space-y-2">
        <p className="font-sans text-xs uppercase tracking-[0.12em] text-paper-muted">Developer iteration mode</p>
        <h1 className="text-4xl leading-tight">Inner Prompt</h1>
        <p className="text-paper-softInk">
          Separate route for editing context, viewing script-generation prompts, and running a live interview loop.
        </p>
      </header>

      <Card className="flex flex-wrap gap-3">
        <Button type="button" variant={stageButtonVariant(1)} onClick={() => setStage(1)}>
          1. Context
        </Button>
        <Button type="button" variant={stageButtonVariant(2)} onClick={() => setStage(2)}>
          2. Script Prompt
        </Button>
        <Button type="button" variant={stageButtonVariant(3)} onClick={() => setStage(3)}>
          3. Live Interview
        </Button>
      </Card>

      {!hydrated ? (
        <Card>
          <p className="text-paper-softInk">Loading local context...</p>
        </Card>
      ) : null}

      {hydrated && stage === 1 ? (
        <Card className="space-y-4">
          <h2 className="text-2xl">Stage 1: Edit full local context</h2>
          <p className="text-paper-softInk">
            This editor maps to the entire app local storage object. You can modify any field directly.
          </p>
          <Textarea
            value={contextJson}
            onChange={(event) => {
              setContextJson(event.target.value);
              setContextDirty(true);
            }}
            rows={24}
          />
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={applyContextJson}>
              Apply JSON to local context
            </Button>
            <Button type="button" variant="ghost" onClick={resetContextEditor}>
              Reload current local context
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStage(2)}>
              Continue to stage 2
            </Button>
          </div>
          {contextStatus ? <Notice tone="success" message={contextStatus} /> : null}
          {contextError ? <Notice tone="error" message={contextError} /> : null}
        </Card>
      ) : null}

      {hydrated && stage === 2 ? (
        <Card className="space-y-4">
          <h2 className="text-2xl">Stage 2: Script generation prompt + output</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="inner-role-select">Role</Label>
              <Select
                id="inner-role-select"
                value={selectedRoleId}
                onChange={(event) => setSelectedRoleId(event.target.value)}
              >
                <option value="">Select role</option>
                {store.roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.title}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="inner-category">Category</Label>
              <Select
                id="inner-category"
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
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="inner-persona">Persona intensity</Label>
              <Input
                id="inner-persona"
                type="number"
                min={0}
                max={100}
                value={config.personaIntensity}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    personaIntensity: Number(event.target.value),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inner-followups">Follow-up intensity</Label>
              <Input
                id="inner-followups"
                type="number"
                min={0}
                max={100}
                value={config.followUpIntensity}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    followUpIntensity: Number(event.target.value),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inner-count">Primary question count</Label>
              <Input
                id="inner-count"
                type="number"
                min={1}
                max={10}
                value={config.primaryQuestionCount}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    primaryQuestionCount: Number(event.target.value),
                  }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="inner-notes">Notes</Label>
            <Textarea
              id="inner-notes"
              value={config.notes}
              onChange={(event) => setConfig((current) => ({ ...current, notes: event.target.value }))}
              rows={3}
            />
          </div>

          {assembledMessages ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>System prompt sent to script generator</Label>
                <Textarea value={assembledMessages[0]?.content || ""} rows={10} readOnly />
              </div>
              <div className="space-y-2">
                <Label>User prompt sent to script generator</Label>
                <Textarea value={assembledMessages[1]?.content || ""} rows={16} readOnly />
              </div>
            </div>
          ) : (
            <Notice tone="neutral" message="Profile and role are required to assemble the script-generation prompts." />
          )}

          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={generateScript} disabled={scriptLoading}>
              {scriptLoading ? "Generating..." : "Generate interviewer script"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStage(3)}>
              Continue to stage 3
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="generated-script">Generated interviewer script</Label>
            <Textarea
              id="generated-script"
              value={generatedScript}
              onChange={(event) => setGeneratedScript(event.target.value)}
              rows={18}
            />
          </div>

          {scriptError ? <Notice tone="error" message={scriptError} /> : null}
        </Card>
      ) : null}

      {hydrated && stage === 3 ? (
        <Card className="space-y-4">
          <h2 className="text-2xl">Stage 3: Live interview with script</h2>
          <p className="text-paper-softInk">
            This runs a live turn-by-turn interview against the script currently in stage 2.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={startInterview} disabled={liveLoading || !generatedScript.trim()}>
              {transcript.length === 0 ? "Start interview" : "Restart interview"}
            </Button>
          </div>

          {interviewComplete ? (
            <Notice tone="success" message="Interview returned end token and is complete." />
          ) : null}

          <div className="space-y-2">
            <Label>Transcript</Label>
            <div className="max-h-[24rem] space-y-2 overflow-y-auto rounded-paper border border-paper-border p-3">
              {transcript.length === 0 ? <p className="text-paper-softInk">No turns yet.</p> : null}
              {transcript.map((turn) => (
                <div
                  key={turn.id}
                  className={`rounded-paper border px-3 py-2 ${
                    turn.role === "assistant"
                      ? "border-paper-border bg-paper-bg text-paper-ink"
                      : "border-paper-accent/40 bg-paper-elevated text-paper-softInk"
                  }`}
                >
                  <p className="font-sans text-xs uppercase tracking-[0.1em] text-paper-muted">
                    {turn.role === "assistant" ? "Interviewer" : "You"}
                  </p>
                  <p className="whitespace-pre-wrap">{turn.content}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="live-answer">Your answer</Label>
            <Textarea
              id="live-answer"
              value={answerDraft}
              onChange={(event) => setAnswerDraft(event.target.value)}
              rows={4}
              disabled={liveLoading || interviewComplete}
            />
            <Button
              type="button"
              onClick={sendAnswer}
              disabled={liveLoading || interviewComplete || !answerDraft.trim() || transcript.length === 0}
            >
              {liveLoading ? "Waiting for interviewer..." : "Send answer"}
            </Button>
          </div>

          {liveError ? <Notice tone="error" message={liveError} /> : null}
          {!generatedScript.trim() ? (
            <Notice tone="neutral" message="Generate or paste an interviewer script in stage 2 before running stage 3." />
          ) : null}
        </Card>
      ) : null}
    </main>
  );
}
