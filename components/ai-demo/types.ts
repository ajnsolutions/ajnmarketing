export type AiDemoFormInputs = {
  websiteUrl: string;
  businessName: string;
  industry: string;
  city: string;
  state: string;
};

export const initialAiDemoFormInputs: AiDemoFormInputs = {
  websiteUrl: "",
  businessName: "",
  industry: "",
  city: "",
  state: "",
};

export type AiDemoUiPhase =
  | "form"
  | "loading"
  | "results";

export const DEMO_PROGRESS_MESSAGES = [
  "Analyzing website...",
  "Understanding your business...",
  "Learning your market...",
  "Generating recommendations...",
  "Preparing content...",
] as const;
