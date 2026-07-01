import type {
  PublishContentInput,
  PublishProviderContext,
  PublishProviderResult,
  PublishingProvider,
} from "@/lib/publishing/publishingTypes";

export abstract class BasePublishingProvider {
  abstract readonly provider: PublishingProvider;

  abstract publish(context: PublishProviderContext): Promise<PublishProviderResult>;

  async verify(
    _context: PublishProviderContext,
    result: PublishProviderResult
  ): Promise<{ verified: boolean; message: string }> {
    return {
      verified: Boolean(result.providerPostId),
      message: result.providerPostId
        ? "Provider post id present."
        : "Missing provider post id.",
    };
  }

  buildInputFromQueueItem(input: {
    title: string;
    content: string;
    contentApprovalId: string;
    publishingQueueId: string;
    scheduledFor?: string | null;
    metadata?: Record<string, unknown>;
  }): PublishContentInput {
    return {
      title: input.title,
      body: input.content,
      contentApprovalId: input.contentApprovalId,
      publishingQueueId: input.publishingQueueId,
      scheduledFor: input.scheduledFor ?? null,
      metadata: input.metadata,
    };
  }
}
