export type ActionFeedbackStatus = "pending" | "success" | "error";

export type ActionFeedbackState = {
  id: string;
  message: string;
  status: ActionFeedbackStatus;
  updatedAt: number;
};

export type ActionFeedbackMap = Record<string, ActionFeedbackState>;
