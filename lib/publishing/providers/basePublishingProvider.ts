import type {
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
}
