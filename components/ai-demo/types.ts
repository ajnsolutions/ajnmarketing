export type AiDemoInputs = {
  website_url: string;
  business_name: string;
  city: string;
  state: string;
  industry: string;
  email: string;
};

export const initialAiDemoInputs: AiDemoInputs = {
  website_url: "",
  business_name: "",
  city: "",
  state: "",
  industry: "",
  email: "",
};

export type AiDemoStep = 1 | 2 | 3;
