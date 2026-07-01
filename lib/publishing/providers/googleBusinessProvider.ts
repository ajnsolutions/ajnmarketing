import "server-only";

import { createGoogleBusinessLocalPost } from "@/lib/google-business/publish";
import { BasePublishingProvider } from "@/lib/publishing/providers/basePublishingProvider";
import {
  PublishingProviders,
  type PublishProviderContext,
  type PublishProviderResult,
} from "@/lib/publishing/publishingTypes";
import { createClient } from "@/lib/supabase/server";

export class GoogleBusinessProvider extends BasePublishingProvider {
  readonly provider = PublishingProviders.GOOGLE_BUSINESS_PROFILE;

  async publish(context: PublishProviderContext): Promise<PublishProviderResult> {
    const supabase = await createClient();

    const result = await createGoogleBusinessLocalPost(supabase, {
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
