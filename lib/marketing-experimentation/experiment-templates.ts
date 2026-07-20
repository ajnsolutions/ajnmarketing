/**
 * Declarative experiment templates — data only.
 */

import {
  ExperimentTypes,
  type ExperimentTemplate,
  type ExperimentType,
} from "@/lib/marketing-experimentation/experiment-types";

export const EXPERIMENT_TEMPLATES: readonly ExperimentTemplate[] = [
  {
    id: "tmpl_posting_time_v1",
    experimentType: ExperimentTypes.POSTING_TIME,
    title: "Posting time",
    defaultHypothesis: "Mid-week posts earn more engagement than weekend posts.",
    primaryMetric: "engagement",
    variants: [
      { key: "a", label: "Mid-week", description: "Publish Tuesday–Thursday mornings." },
      { key: "b", label: "Weekend", description: "Publish Saturday–Sunday mornings." },
    ],
  },
  {
    id: "tmpl_content_format_v1",
    experimentType: ExperimentTypes.CONTENT_FORMAT,
    title: "Content format",
    defaultHypothesis: "Short updates outperform longer posts for clicks.",
    primaryMetric: "clicks",
    variants: [
      { key: "a", label: "Short update", description: "Brief, scannable format." },
      { key: "b", label: "Longer story", description: "Richer narrative format." },
    ],
  },
  {
    id: "tmpl_cta_variation_v1",
    experimentType: ExperimentTypes.CTA_VARIATION,
    title: "CTA variation",
    defaultHypothesis: "A direct call-to-action drives more conversions than a soft ask.",
    primaryMetric: "conversions",
    variants: [
      { key: "a", label: "Direct CTA", description: "Clear next-step language." },
      { key: "b", label: "Soft ask", description: "Gentle invitation language." },
    ],
  },
  {
    id: "tmpl_messaging_style_v1",
    experimentType: ExperimentTypes.MESSAGING_STYLE,
    title: "Educational vs promotional",
    defaultHypothesis: "Educational messaging earns more engagement than promotional messaging.",
    primaryMetric: "engagement",
    variants: [
      { key: "a", label: "Educational", description: "Teach or tip-forward copy." },
      { key: "b", label: "Promotional", description: "Offer-forward copy." },
    ],
  },
  {
    id: "tmpl_image_vs_text_v1",
    experimentType: ExperimentTypes.IMAGE_VS_TEXT,
    title: "Image vs text emphasis",
    defaultHypothesis: "Image-led posts reach more people than text-led posts.",
    primaryMetric: "reach",
    variants: [
      { key: "a", label: "Image-led", description: "Visual emphasis with short caption." },
      { key: "b", label: "Text-led", description: "Copy emphasis with light visuals." },
    ],
  },
  {
    id: "tmpl_campaign_sequencing_v1",
    experimentType: ExperimentTypes.CAMPAIGN_SEQUENCING,
    title: "Campaign sequencing",
    defaultHypothesis: "Leading with awareness then offer improves consistency.",
    primaryMetric: "publishingConsistency",
    variants: [
      { key: "a", label: "Awareness → offer", description: "Educate first, promote second." },
      { key: "b", label: "Offer → awareness", description: "Promote first, educate second." },
    ],
  },
  {
    id: "tmpl_review_request_timing_v1",
    experimentType: ExperimentTypes.REVIEW_REQUEST_TIMING,
    title: "Review request timing",
    defaultHypothesis: "Asking for reviews soon after service yields more reviews.",
    primaryMetric: "reviews",
    variants: [
      { key: "a", label: "Same day", description: "Request shortly after the visit." },
      { key: "b", label: "Follow-up week", description: "Request several days later." },
    ],
  },
] as const;

export function getExperimentTemplate(experimentType: ExperimentType): ExperimentTemplate | null {
  return EXPERIMENT_TEMPLATES.find((template) => template.experimentType === experimentType) ?? null;
}

export function listExperimentTemplates(): ExperimentTemplate[] {
  return [...EXPERIMENT_TEMPLATES];
}
