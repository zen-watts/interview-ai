"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { createLogger } from "@/src/lib/logger";
import { loadStore, persistStore } from "@/src/lib/storage/local-storage";
import { createEmptyStore } from "@/src/lib/storage/schema";
import type {
  AppStore,
  DevSettings,
  InterviewAnalysis,
  InterviewAttempt,
  InterviewAttemptStatus,
  InterviewConfig,
  RoleProfile,
  TranscriptTurn,
  UserProfile,
} from "@/src/lib/types";
import { createId } from "@/src/lib/utils/id";
import { nowIso } from "@/src/lib/utils/time";

const logger = createLogger("store-provider");

interface RoleInput {
  title: string;
  organizationName: string;
  organizationDescription: string;
  fullJobDescription: string;
}

interface ProfileInput {
  name: string;
  targetJob: string;
  experienceLevel: UserProfile["experienceLevel"];
  resumeText: string;
  resumeSummary: string;
}

interface AppStoreContextValue {
  store: AppStore;
  hydrated: boolean;
  saveProfile: (input: ProfileInput) => void;
  createRole: (input: RoleInput) => RoleProfile;
  updateRole: (roleId: string, input: RoleInput) => void;
  createAttempt: (roleId: string, config: InterviewConfig) => InterviewAttempt;
  patchAttempt: (attemptId: string, patch: Partial<InterviewAttempt>) => void;
  appendTranscriptTurn: (attemptId: string, turn: TranscriptTurn) => void;
  replaceTranscript: (attemptId: string, transcript: TranscriptTurn[]) => void;
  setAttemptStatus: (attemptId: string, status: InterviewAttemptStatus, lastError?: string | null) => void;
  setAttemptScript: (attemptId: string, script: string) => void;
  setAttemptAnalysis: (attemptId: string, analysis: InterviewAnalysis) => void;
  patchDevSettings: (patch: Partial<DevSettings>) => void;
}

const AppStoreContext = createContext<AppStoreContextValue | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<AppStore>(createEmptyStore());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loaded = loadStore();
    setStore(loaded);
    setHydrated(true);
    logger.info("App state hydrated from local storage.", {
      roleCount: loaded.roles.length,
      attemptCount: loaded.attempts.length,
      hasProfile: Boolean(loaded.profile),
    });
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    persistStore(store);
  }, [hydrated, store]);

  const saveProfile = useCallback((input: ProfileInput) => {
    setStore((current) => {
      const now = nowIso();
      const createdAt = current.profile?.createdAt || now;

      logger.info("User profile saved.", {
        hasResumeText: Boolean(input.resumeText),
        hasResumeSummary: Boolean(input.resumeSummary),
      });

      return {
        ...current,
        profile: {
          ...input,
          createdAt,
          updatedAt: now,
        },
      };
    });
  }, []);

  const createRole = useCallback((input: RoleInput) => {
    const now = nowIso();
    const role: RoleProfile = {
      id: createId(),
      title: input.title.trim(),
      organizationName: input.organizationName.trim(),
      organizationDescription: input.organizationDescription.trim(),
      fullJobDescription: input.fullJobDescription.trim(),
      createdAt: now,
      updatedAt: now,
    };

    setStore((current) => {
      logger.info("Role profile created.", { roleId: role.id, title: role.title });

      return {
        ...current,
        roles: [role, ...current.roles],
      };
    });

    return role;
  }, []);

  const updateRole = useCallback((roleId: string, input: RoleInput) => {
    setStore((current) => {
      const roles = current.roles.map((role) => {
        if (role.id !== roleId) {
          return role;
        }

        const updatedRole = {
          ...role,
          title: input.title.trim(),
          organizationName: input.organizationName.trim(),
          organizationDescription: input.organizationDescription.trim(),
          fullJobDescription: input.fullJobDescription.trim(),
          updatedAt: nowIso(),
        };

        logger.info("Role profile updated.", { roleId: updatedRole.id, title: updatedRole.title });
        return updatedRole;
      });

      return {
        ...current,
        roles,
      };
    });
  }, []);

  const createAttempt = useCallback((roleId: string, config: InterviewConfig) => {
    const now = nowIso();
    const attempt: InterviewAttempt = {
      id: createId(),
      roleId,
      config,
      status: "script_pending",
      script: null,
      transcript: [],
      analysis: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    };

    setStore((current) => {
      logger.info("Interview attempt created.", {
        attemptId: attempt.id,
        roleId,
        questionCount: config.primaryQuestionCount,
      });

      return {
        ...current,
        attempts: [attempt, ...current.attempts],
      };
    });

    return attempt;
  }, []);

  const patchAttempt = useCallback((attemptId: string, patch: Partial<InterviewAttempt>) => {
    setStore((current) => {
      const attempts = current.attempts.map((attempt) => {
        if (attempt.id !== attemptId) {
          return attempt;
        }

        return {
          ...attempt,
          ...patch,
          updatedAt: nowIso(),
        };
      });

      return {
        ...current,
        attempts,
      };
    });
  }, []);

  const appendTranscriptTurn = useCallback((attemptId: string, turn: TranscriptTurn) => {
    setStore((current) => {
      const attempts = current.attempts.map((attempt) => {
        if (attempt.id !== attemptId) {
          return attempt;
        }

        return {
          ...attempt,
          transcript: [...attempt.transcript, turn],
          updatedAt: nowIso(),
        };
      });

      return {
        ...current,
        attempts,
      };
    });
  }, []);

  const replaceTranscript = useCallback((attemptId: string, transcript: TranscriptTurn[]) => {
    setStore((current) => {
      const attempts = current.attempts.map((attempt) => {
        if (attempt.id !== attemptId) {
          return attempt;
        }

        return {
          ...attempt,
          transcript,
          updatedAt: nowIso(),
        };
      });

      return {
        ...current,
        attempts,
      };
    });
  }, []);

  const setAttemptStatus = useCallback(
    (attemptId: string, status: InterviewAttemptStatus, lastError: string | null = null) => {
      patchAttempt(attemptId, {
        status,
        lastError,
      });

      logger.info("Interview attempt status updated.", {
        attemptId,
        status,
        hasError: Boolean(lastError),
      });
    },
    [patchAttempt],
  );

  const setAttemptScript = useCallback(
    (attemptId: string, script: string) => {
      patchAttempt(attemptId, {
        script,
        status: "ready",
        lastError: null,
      });

      logger.info("Interview script generated and saved.", { attemptId, scriptLength: script.length });
    },
    [patchAttempt],
  );

  const setAttemptAnalysis = useCallback(
    (attemptId: string, analysis: InterviewAnalysis) => {
      patchAttempt(attemptId, {
        analysis,
        status: "complete",
        lastError: null,
      });

      logger.info("Interview analysis saved.", { attemptId, redFlagCount: analysis.red_flags.length });
    },
    [patchAttempt],
  );

  const patchDevSettings = useCallback((patch: Partial<DevSettings>) => {
    setStore((current) => {
      const nextSettings = {
        ...current.devSettings,
        ...patch,
      };

      logger.info("Developer settings updated.", nextSettings);

      return {
        ...current,
        devSettings: nextSettings,
      };
    });
  }, []);

  const value = useMemo<AppStoreContextValue>(
    () => ({
      store,
      hydrated,
      saveProfile,
      createRole,
      updateRole,
      createAttempt,
      patchAttempt,
      appendTranscriptTurn,
      replaceTranscript,
      setAttemptStatus,
      setAttemptScript,
      setAttemptAnalysis,
      patchDevSettings,
    }),
    [
      appendTranscriptTurn,
      createAttempt,
      createRole,
      hydrated,
      patchAttempt,
      replaceTranscript,
      saveProfile,
      setAttemptAnalysis,
      setAttemptScript,
      setAttemptStatus,
      patchDevSettings,
      store,
      updateRole,
    ],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const context = useContext(AppStoreContext);
  if (!context) {
    throw new Error("useAppStore must be used inside AppStoreProvider");
  }

  return context;
}
