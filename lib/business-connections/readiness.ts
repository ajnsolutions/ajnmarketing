/**
 * Business Brain readiness — which intelligence sources are available.
 * Customer-facing labels; used for onboarding and empty states.
 */

import {
  ConnectionCapabilities,
  ConnectionStatuses,
  type BusinessBrainReadinessItem,
  type BusinessBrainReadinessState,
  type BusinessConnection,
} from "@/lib/business-connections/types";

type ReadinessSpec = {
  id: string;
  label: string;
  capability: (typeof ConnectionCapabilities)[keyof typeof ConnectionCapabilities];
  unavailableDetail: string;
  availableDetail: string;
  comingSoonDetail: string;
};

const READINESS_SPECS: readonly ReadinessSpec[] = [
  {
    id: "readiness_customer_feedback",
    label: "Customer feedback",
    capability: ConnectionCapabilities.REVIEWS,
    availableDetail: "Customer feedback available — reviews help recommendations stay authentic.",
    unavailableDetail: "Customer feedback unavailable — connect Google Business Profile to learn how customers talk about you.",
    comingSoonDetail: "Additional feedback sources are coming soon.",
  },
  {
    id: "readiness_search_performance",
    label: "Search performance",
    capability: ConnectionCapabilities.SEARCH_PERFORMANCE,
    availableDetail: "Search performance available.",
    unavailableDetail: "Search performance unavailable — we can't yet see which searches bring people to you.",
    comingSoonDetail: "Search performance connection is coming soon.",
  },
  {
    id: "readiness_website_analytics",
    label: "Website analytics",
    capability: ConnectionCapabilities.WEBSITE_ANALYTICS,
    availableDetail: "Website analytics available.",
    unavailableDetail: "Website analytics unavailable — page-level visitor patterns aren't connected yet.",
    comingSoonDetail: "Website analytics connection is coming soon.",
  },
  {
    id: "readiness_website_content",
    label: "Website understanding",
    capability: ConnectionCapabilities.WEBSITE_CONTENT,
    availableDetail: "Website understanding available — we can ground advice in your site.",
    unavailableDetail: "Website understanding unavailable — add or analyze your website to teach the Business Brain.",
    comingSoonDetail: "Website understanding is preparing.",
  },
  {
    id: "readiness_document_knowledge",
    label: "Document knowledge",
    capability: ConnectionCapabilities.DOCUMENT_KNOWLEDGE,
    availableDetail: "Document knowledge available.",
    unavailableDetail: "Document knowledge unavailable — brochures and service sheets aren't connected yet.",
    comingSoonDetail: "Document uploads are coming soon.",
  },
];

function stateForCapability(
  connections: BusinessConnection[],
  capability: ReadinessSpec["capability"],
): { state: BusinessBrainReadinessState; related: string[] } {
  const related = connections.filter((c) => c.capabilities.includes(capability));
  const relatedIds = related.map((c) => c.id);

  if (related.some((c) => c.status === ConnectionStatuses.CONNECTED)) {
    return { state: "available", related: relatedIds };
  }

  if (related.some((c) => c.status === ConnectionStatuses.NEEDS_ATTENTION)) {
    return { state: "partial", related: relatedIds };
  }

  if (
    related.length > 0 &&
    related.every((c) => c.status === ConnectionStatuses.COMING_SOON)
  ) {
    return { state: "coming_soon", related: relatedIds };
  }

  return { state: "unavailable", related: relatedIds };
}

export function buildBusinessBrainReadiness(
  connections: BusinessConnection[],
): BusinessBrainReadinessItem[] {
  return READINESS_SPECS.map((spec) => {
    const { state, related } = stateForCapability(connections, spec.capability);
    let detail = spec.unavailableDetail;
    if (state === "available") detail = spec.availableDetail;
    else if (state === "coming_soon") detail = spec.comingSoonDetail;
    else if (state === "partial") {
      detail = `${spec.label} needs attention — reconnect so recommendations stay current.`;
    }

    return {
      id: spec.id,
      label: spec.label,
      state,
      detail,
      relatedConnectionIds: related,
    };
  });
}
