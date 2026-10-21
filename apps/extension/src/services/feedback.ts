import { sendMessage } from "@/messaging"
import type { FeedbackSubmission } from "@/types/feedback"

export const submitFeedback = (input: FeedbackSubmission) =>
    sendMessage("submit-feedback", input)
