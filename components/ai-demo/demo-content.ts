import type { AiDemoInputs } from "./types";

export function buildDemoContent(inputs: AiDemoInputs) {
  const { business_name, city, state, industry } = inputs;
  const location = `${city}, ${state}`;
  const industryLower = industry.toLowerCase();

  return {
    brandVoice:
      "Friendly, professional, service-focused, and built around trust.",
    services: [
      "Emergency repairs",
      "Maintenance",
      "Installation",
      "Local service calls",
      "Customer support",
    ],
    gbpOpportunity: {
      visibility: "Needs improvement",
      recommendations: [
        "Weekly Google posts",
        "Review requests",
        "Service-area content",
        "Local keyword consistency",
      ],
    },
    gbpPost: `Looking for reliable ${industryLower} in ${location}? ${business_name} is here to help local homeowners and businesses with fast, professional service. Call today for a free estimate and see why neighbors trust us for quality work done right.`,
    socialPosts: [
      {
        type: "Educational",
        label: "Educational post",
        copy: `Not sure when to schedule ${industryLower} maintenance? ${business_name} shares simple tips to help ${city} homeowners avoid costly surprises and keep systems running smoothly all year.`,
      },
      {
        type: "Seasonal",
        label: "Seasonal / local post",
        copy: `Spring is a great time for a check-up in ${city}. ${business_name} is serving ${state} with fast response times and friendly local service you can count on.`,
      },
      {
        type: "Review",
        label: "Review / testimonial style",
        copy: `"Professional, on time, and easy to work with." That is the kind of experience ${business_name} delivers every day for customers across ${location}.`,
      },
    ],
    blogTopics: [
      `How to choose the right ${industryLower} provider in ${city}`,
      `5 signs your home or business needs ${industryLower} service in ${state}`,
      `What ${city} customers should know before calling a local ${industryLower} company`,
    ],
  };
}
