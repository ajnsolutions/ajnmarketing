import "server-only";

import { GoogleBusinessProvider } from "@/lib/publishing/providers/googleBusinessProvider";
import { BasePublishingProvider } from "@/lib/publishing/providers/basePublishingProvider";
import {
  PublishingProviders,
  type PublishingProvider,
} from "@/lib/publishing/publishingTypes";

const googleBusinessProvider = new GoogleBusinessProvider();

export function getPublishingProvider(provider: PublishingProvider): BasePublishingProvider {
  switch (provider) {
    case PublishingProviders.GOOGLE_BUSINESS_PROFILE:
      return googleBusinessProvider;
    case PublishingProviders.FACEBOOK:
    case PublishingProviders.INSTAGRAM:
    case PublishingProviders.LINKEDIN:
    case PublishingProviders.EMAIL:
      throw new Error(`${provider} publishing is not available yet.`);
    default:
      throw new Error(`Unsupported publishing provider: ${provider}`);
  }
}

export function isPublishingProviderSupported(provider: PublishingProvider): boolean {
  return provider === PublishingProviders.GOOGLE_BUSINESS_PROFILE;
}

export function listSupportedPublishingProviders(): PublishingProvider[] {
  return [PublishingProviders.GOOGLE_BUSINESS_PROFILE];
}
