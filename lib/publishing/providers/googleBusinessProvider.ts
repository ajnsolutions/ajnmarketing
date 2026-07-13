import "server-only";

import { createGoogleBusinessLocalPost } from "@/lib/google-business/publish";
import { BasePublishingProvider } from "@/lib/publishing/providers/basePublishingProvider";
import {
  PublishingProviders,
  type PublishProviderContext,
  type PublishProviderResult,
} from "@/lib/publishing/publishingTypes";

export class GoogleBusinessProvider extends BasePublishingProvider {
  readonly provider = PublishingProviders.GOOGLE_BUSINESS_PROFILE;

  async publish(context: PublishProviderContext): Promise<PublishProviderResult> {
    // Use the caller-supplied client only (request-scoped or service-role).
    // Supports Trigger.dev publishing with no request cookies.
    const result = await createGoogleBusinessLocalPost(context.supabase, {
      userId: context.userId,
      businessProfileId: context.businessProfileId,
      summary: context.input.body,
      title: context.input.title,
      publishingQueueId: context.input.publishingQueueId,
      contentApprovalId: context.input.contentApprovalId,
    });

    return {
      providerPostId: result.googlePostId,
      publishedAt: result.publishedAt,
      rawResponse: result.rawResponse,
      verificationHint: {
        state: result.state,
        googlePostName: result.googlePostName,
      },
    };
  }
}
