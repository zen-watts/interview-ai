import { createLogger } from "@/src/lib/logger";
import type { AppStore } from "@/src/lib/types";

import {
  STORAGE_KEY,
  createEmptyStore,
  migrateToCurrentSchema,
} from "@/src/lib/storage/schema";

const logger = createLogger("storage");

function hasWindow() {
  return typeof window !== "undefined";
}

export function loadStore(): AppStore {
  if (!hasWindow()) {
    return createEmptyStore();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      logger.info("load.empty");
      return createEmptyStore();
    }

    const parsed = JSON.parse(raw) as unknown;
    const migrated = migrateToCurrentSchema(parsed);

    logger.info("load.success", {
      roleCount: migrated.roles.length,
      attemptCount: migrated.attempts.length,
      hasProfile: Boolean(migrated.profile),
    });

    return migrated;
  } catch (error) {
    logger.error("load.failed", {
      message: error instanceof Error ? error.message : "Unknown localStorage error",
    });

    return createEmptyStore();
  }
}

export function persistStore(store: AppStore): void {
  if (!hasWindow()) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    logger.debug("persist.success", {
      roleCount: store.roles.length,
      attemptCount: store.attempts.length,
      hasProfile: Boolean(store.profile),
    });
  } catch (error) {
    logger.error("persist.failed", {
      message: error instanceof Error ? error.message : "Unknown localStorage error",
    });
  }
}
