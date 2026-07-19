/**
 * Pure ask entrypoint: classify → answer. Deterministic for identical inputs.
 */

import { answerInteractiveHomQuestion } from "@/lib/interactive-hom/answerEngine";
import { classifyInteractiveHomQuestion } from "@/lib/interactive-hom/classifyQuestion";
import type {
  InteractiveHomAnswer,
  InteractiveHomGroundedContext,
} from "@/lib/interactive-hom/types";

export function askInteractiveHom(
  question: string,
  context: InteractiveHomGroundedContext,
): InteractiveHomAnswer {
  const category = classifyInteractiveHomQuestion(question);
  return answerInteractiveHomQuestion(category, context);
}
