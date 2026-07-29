/**
 * Resolve catalog entries into runtime BusinessConnection states.
 * Pure — callers supply live signals; placeholders stay coming_soon.
 */

import { CONNECTION_CATALOG } from "@/lib/business-connections/catalog";
import {
  ConnectionHealthLevels,
  ConnectionProviderIds,
  ConnectionStatuses,
  type BusinessConnection,
  type ConnectionCatalogEntry,
  type ConnectionHealth,
  type ConnectionNextAction,
  type ConnectionStatus,
} from "@/lib/business-connections/types";

export type LiveConnectionSignals = {
  /** Google Business Profile connected with valid scopes. */
  gbpConnected: boolean;
  /** Connected but expired / revoked / missing scopes / error. */
  gbpNeedsAttention: boolean;
  gbpLastSyncAt: string | null;
  /** Business has a website URL on file. */
  hasWebsite: boolean;
  /** A website analysis row exists for this business. */
  websiteAnalyzed: boolean;
  websiteAnalyzedAt: string | null;
  /** OAuth / storage globally unavailable (platform). */
  gbpPlatformUnavailable?: boolean;
};

function actionsFor(
  entry: ConnectionCatalogEntry,
  status: ConnectionStatus,
): ConnectionNextAction[] {
  if (entry.implementation === "placeholder") {
    return [
      {
        id: `${entry.id}_notify`,
        label: "We'll let you know when this connection is ready",
        href: null,
        availableNow: false,
      },
    ];
  }

  if (status === ConnectionStatuses.CONNECTED) {
    return entry.manageHref
      ? [
          {
            id: `${entry.id}_manage`,
            label: "Review connection",
            href: entry.manageHref,
            availableNow: true,
          },
        ]
      : [];
  }

  if (status === ConnectionStatuses.NEEDS_ATTENTION) {
    return [
      {
        id: `${entry.id}_fix`,
        label: "Reconnect to restore insights",
        href: entry.connectHref ?? entry.manageHref,
        availableNow: Boolean(entry.connectHref ?? entry.manageHref),
      },
    ];
  }

  if (status === ConnectionStatuses.NOT_CONNECTED) {
    return [
      {
        id: `${entry.id}_connect`,
        label: "Connect to teach the Business Brain",
        href: entry.connectHref,
        availableNow: Boolean(entry.connectHref),
      },
    ];
  }

  return [];
}

function resolveGbp(entry: ConnectionCatalogEntry, signals: LiveConnectionSignals): BusinessConnection {
  if (signals.gbpPlatformUnavailable) {
    return finalize(entry, {
      status: ConnectionStatuses.UNAVAILABLE,
      health: ConnectionHealthLevels.UNKNOWN,
      lastSyncAt: null,
      availableCapabilities: [],
    });
  }

  if (signals.gbpConnected) {
    return finalize(entry, {
      status: ConnectionStatuses.CONNECTED,
      health: ConnectionHealthLevels.HEALTHY,
      lastSyncAt: signals.gbpLastSyncAt,
      availableCapabilities: entry.capabilities,
    });
  }

  if (signals.gbpNeedsAttention) {
    return finalize(entry, {
      status: ConnectionStatuses.NEEDS_ATTENTION,
      health: ConnectionHealthLevels.ATTENTION,
      lastSyncAt: signals.gbpLastSyncAt,
      availableCapabilities: [],
    });
  }

  return finalize(entry, {
    status: ConnectionStatuses.NOT_CONNECTED,
    health: ConnectionHealthLevels.NOT_APPLICABLE,
    lastSyncAt: null,
    availableCapabilities: [],
  });
}

function resolveWebsite(
  entry: ConnectionCatalogEntry,
  signals: LiveConnectionSignals,
): BusinessConnection {
  if (signals.websiteAnalyzed) {
    return finalize(entry, {
      status: ConnectionStatuses.CONNECTED,
      health: ConnectionHealthLevels.HEALTHY,
      lastSyncAt: signals.websiteAnalyzedAt,
      availableCapabilities: entry.capabilities,
    });
  }

  if (signals.hasWebsite) {
    return finalize(entry, {
      status: ConnectionStatuses.NOT_CONNECTED,
      health: ConnectionHealthLevels.NOT_APPLICABLE,
      lastSyncAt: null,
      availableCapabilities: [],
    });
  }

  // No website on file — still invite analysis path; treat as not connected.
  return finalize(entry, {
    status: ConnectionStatuses.NOT_CONNECTED,
    health: ConnectionHealthLevels.NOT_APPLICABLE,
    lastSyncAt: null,
    availableCapabilities: [],
  });
}

function finalize(
  entry: ConnectionCatalogEntry,
  partial: {
    status: ConnectionStatus;
    health: ConnectionHealth;
    lastSyncAt: string | null;
    availableCapabilities: BusinessConnection["availableCapabilities"];
  },
): BusinessConnection {
  return {
    ...entry,
    ...partial,
    recommendedNextActions: actionsFor(entry, partial.status),
  };
}

function resolvePlaceholder(entry: ConnectionCatalogEntry): BusinessConnection {
  return finalize(entry, {
    status: ConnectionStatuses.COMING_SOON,
    health: ConnectionHealthLevels.NOT_APPLICABLE,
    lastSyncAt: null,
    availableCapabilities: [],
  });
}

/** Resolve the full catalog against live signals. */
export function resolveBusinessConnections(
  signals: LiveConnectionSignals,
): BusinessConnection[] {
  return CONNECTION_CATALOG.map((entry) => {
    if (entry.implementation === "placeholder") {
      return resolvePlaceholder(entry);
    }
    if (entry.providerId === ConnectionProviderIds.GOOGLE_BUSINESS_PROFILE) {
      return resolveGbp(entry, signals);
    }
    if (entry.providerId === ConnectionProviderIds.WEBSITE_ANALYSIS) {
      return resolveWebsite(entry, signals);
    }
    return resolvePlaceholder(entry);
  });
}
