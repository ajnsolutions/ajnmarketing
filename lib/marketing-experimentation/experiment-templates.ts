/**
 * Declarative experiment templates — data only.
 *
 * [Claude review, follow-up] Only `supported: true` templates may ever back a Marketing
 * Director proposal (see lib/marketing-director/experimentEligibility.ts and migration
 * 029's CHECK constraint on marketing_experiment_proposals.experiment_type, which is
 * hard-restricted to the same two types). The test for "supported" is not "does this
 * template read plausibly" — every one of the seven originally declared types can
 * produce a plausible-sounding hypothesis and variant pair — the test is: does an
 * existing, already-recorded timestamp or record let a *future* phase attribute an
 * outcome to one variant specifically, without inventing new classification metadata?
 *
 * - `posting_time` / `review_request_timing`: supported. Both variants describe *when*
 *   an existing action happens (publish a post; send a review request), and
 *   publishing_queue already records `scheduled_for`/`published_at` for every such
 *   action. A future phase that captures per-item analytics could attribute outcomes to
 *   "was this the mid-week/weekend variant" using data that already exists today.
 * - `content_format`, `cta_variation`, `messaging_style`, `image_vs_text`: deferred. Each
 *   variant describes a property of the *content itself* (short vs. long; direct vs.
 *   soft CTA; educational vs. promotional; image-led vs. text-led) that is not captured
 *   anywhere in this schema — realizing these would require inventing new content
 *   classification fields, a materially larger scope than this phase.
 * - `campaign_sequencing`: deferred. Its variants compare *whole differently-ordered
 *   campaigns* run at different times, not two parallel treatments of one experiment —
 *   a structurally different (between-campaigns) comparison this engine does not model.
 */

import {
  ExperimentTypes,
  type ExperimentTemplate,
  type ExperimentType,
} from "@/lib/marketing-experimentation/experiment-types";

/** The only experiment types Marketing Director may currently propose. Keep in sync
 * with migration 029's CHECK constraint on marketing_experiment_proposals.experiment_type. */
export const SUPPORTED_EXPERIMENT_TYPES: readonly ExperimentType[] = [
  ExperimentTypes.POSTING_TIME,
  ExperimentTypes.REVIEW_REQUEST_TIMING,
];

export const EXPERIMENT_TEMPLATES: readonly ExperimentTemplate[] = [
  {
    id: "tmpl_posting_time_v1",
    experimentType: ExperimentTypes.POSTING_TIME,
    title: "Posting time",
    defaultHypothesis: "Mid-week posts earn more engagement than weekend posts.",
    primaryMetric: "engagement",
    supported: true,
    variants: [
      { key: "control", label: "Mid-week", description: "Publish Tuesday–Thursday mornings." },
      { key: "treatment", label: "Weekend", description: "Publish Saturday–Sunday mornings." },
    ],
  },
  {
    id: "tmpl_content_format_v1",
    experimentType: ExperimentTypes.CONTENT_FORMAT,
    title: "Content format",
    defaultHypothesis: "Short updates outperform longer posts for clicks.",
    primaryMetric: "clicks",
    supported: false,
    deferralReason:
      "Requires classifying content as short/long, a distinction not captured anywhere in the schema today.",
    variants: [
      { key: "control", label: "Short update", description: "Brief, scannable format." },
      { key: "treatment", label: "Longer story", description: "Richer narrative format." },
    ],
  },
  {
    id: "tmpl_cta_variation_v1",
    experimentType: ExperimentTypes.CTA_VARIATION,
    title: "CTA variation",
    defaultHypothesis: "A direct call-to-action drives more conversions than a soft ask.",
    primaryMetric: "conversions",
    supported: false,
    deferralReason:
      "Requires classifying a piece of content's CTA style, a distinction not captured anywhere in the schema today.",
    variants: [
      { key: "control", label: "Direct CTA", description: "Clear next-step language." },
      { key: "treatment", label: "Soft ask", description: "Gentle invitation language." },
    ],
  },
  {
    id: "tmpl_messaging_style_v1",
    experimentType: ExperimentTypes.MESSAGING_STYLE,
    title: "Educational vs promotional",
    defaultHypothesis: "Educational messaging earns more engagement than promotional messaging.",
    primaryMetric: "engagement",
    supported: false,
    deferralReason:
      "Requires classifying content as educational/promotional, a distinction not captured anywhere in the schema today.",
    variants: [
      { key: "control", label: "Educational", description: "Teach or tip-forward copy." },
      { key: "treatment", label: "Promotional", description: "Offer-forward copy." },
    ],
  },
  {
    id: "tmpl_image_vs_text_v1",
    experimentType: ExperimentTypes.IMAGE_VS_TEXT,
    title: "Image vs text emphasis",
    defaultHypothesis: "Image-led posts reach more people than text-led posts.",
    primaryMetric: "reach",
    supported: false,
    deferralReason:
      "Requires classifying content as image-led/text-led, a distinction not captured anywhere in the schema today.",
    variants: [
      { key: "control", label: "Image-led", description: "Visual emphasis with short caption." },
      { key: "treatment", label: "Text-led", description: "Copy emphasis with light visuals." },
    ],
  },
  {
    id: "tmpl_campaign_sequencing_v1",
    experimentType: ExperimentTypes.CAMPAIGN_SEQUENCING,
    title: "Campaign sequencing",
    defaultHypothesis: "Leading with awareness then offer improves consistency.",
    primaryMetric: "publishingConsistency",
    supported: false,
    deferralReason:
      "Compares two whole differently-ordered campaigns run at different times, a between-campaigns comparison this engine does not model as a single experiment.",
    variants: [
      { key: "control", label: "Awareness → offer", description: "Educate first, promote second." },
      { key: "treatment", label: "Offer → awareness", description: "Promote first, educate second." },
    ],
  },
  {
    id: "tmpl_review_request_timing_v1",
    experimentType: ExperimentTypes.REVIEW_REQUEST_TIMING,
    title: "Review request timing",
    defaultHypothesis: "Asking for reviews soon after service yields more reviews.",
    primaryMetric: "reviews",
    supported: true,
    variants: [
      { key: "control", label: "Same day", description: "Request shortly after the visit." },
      { key: "treatment", label: "Follow-up week", description: "Request several days later." },
    ],
  },
] as const;

export function getExperimentTemplate(experimentType: ExperimentType): ExperimentTemplate | null {
  return EXPERIMENT_TEMPLATES.find((template) => template.experimentType === experimentType) ?? null;
}

export function listExperimentTemplates(): ExperimentTemplate[] {
  return [...EXPERIMENT_TEMPLATES];
}

export function listSupportedExperimentTemplates(): ExperimentTemplate[] {
  return EXPERIMENT_TEMPLATES.filter((template) => template.supported);
}

export function isSupportedExperimentType(experimentType: string): experimentType is ExperimentType {
  return SUPPORTED_EXPERIMENT_TYPES.includes(experimentType as ExperimentType);
}
