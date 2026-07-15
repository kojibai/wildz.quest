import { Icons } from "@/components/icons";
import { cx } from "@/lib/utils";
import type { ActionFeedbackState } from "@/types/action-feedback";

export function InlineActionFeedback({
  className,
  feedback
}: {
  className?: string;
  feedback?: ActionFeedbackState;
}) {
  if (!feedback) return null;

  const Icon = feedback.status === "success" ? Icons.check : feedback.status === "error" ? Icons.close : Icons.clock;

  return (
    <span
      className={cx("action-feedback", `action-feedback-${feedback.status}`, className)}
      role={feedback.status === "error" ? "alert" : "status"}
    >
      <Icon size={13} />
      <span>{feedback.message}</span>
    </span>
  );
}
