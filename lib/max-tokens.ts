/**
 * Calculate optimal max_tokens based on provider capabilities and input size
 * 
 * @param selectedProvider - The selected provider object from getBestProvider
 * @param inputTokens - Estimated input tokens (prompt + system message + context)
 * @param isStreaming - Whether this is a streaming request (affects buffer)
 * @returns Optimal max_tokens value
 */
export function calculateMaxTokens(
  selectedProvider: any,
  inputTokens: number = 0,
  isStreaming: boolean = false
): number {
  if (!selectedProvider?.context_length) {
    // Fallback for unknown providers - use conservative default
    return 4096;
  }

  const contextLength = selectedProvider.context_length;
  
  // Reserve buffer for safety and potential tokenization differences
  const safetyBuffer = isStreaming ? 1000 : 500;
  
  // Calculate available tokens for output
  const availableTokens = contextLength - inputTokens - safetyBuffer;
  
  // Define reasonable max output limits based on use case
  const useCase = {
    // For HTML generation, we typically need substantial output
    htmlGeneration: Math.min(32_000, availableTokens),
    // For code editing, moderate output is usually sufficient  
    codeEditing: Math.min(16_000, availableTokens),
    // Conservative fallback
    default: Math.min(8_000, availableTokens)
  };
  
  // Choose based on available tokens and provider capabilities
  let targetTokens: number;
  
  if (availableTokens >= 32_000) {
    targetTokens = useCase.htmlGeneration;
  } else if (availableTokens >= 16_000) {
    targetTokens = useCase.codeEditing;
  } else {
    targetTokens = useCase.default;
  }
  
  // Ensure we don't go below minimum viable output
  const minimumViableOutput = 2048;
  if (targetTokens < minimumViableOutput) {
    // If we can't provide minimum viable output, try with minimal buffer
    const minimalBuffer = 200;
    targetTokens = Math.max(
      minimumViableOutput,
      contextLength - inputTokens - minimalBuffer
    );
  }
  
  // Final safety check - never exceed context length
  return Math.min(targetTokens, contextLength - inputTokens - 100);
}

/**
 * Estimate input tokens for a request (rough estimation)
 * 
 * @param systemPrompt - System prompt content
 * @param userPrompt - User prompt content  
 * @param additionalContext - Additional context (templates, pages, etc.)
 * @returns Estimated token count
 */
export function estimateInputTokens(
  systemPrompt: string = "",
  userPrompt: string = "",
  additionalContext: string = ""
): number {
  // Rough estimation: ~4 characters per token for English text
  // This is conservative - actual tokenization may vary
  const totalChars = systemPrompt.length + userPrompt.length + additionalContext.length;
  return Math.ceil(totalChars / 3.5); // Slightly more conservative than 4 chars/token
}

/**
 * Get max_tokens configuration for specific providers with special handling
 */
export function getProviderSpecificConfig(selectedProvider: any, baseMaxTokens: number) {
  const providerName = selectedProvider?.provider;
  
  switch (providerName) {
    case "sambanova":
      // SambaNova has specific limitations - don't set max_tokens
      return {};
    default:
      return { max_tokens: baseMaxTokens };
  }
}
