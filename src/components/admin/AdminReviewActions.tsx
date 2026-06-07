"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "antd";

import { apiRequest } from "@/components/admin/adminApi";

export default function AdminReviewActions(props: { articleId: string }) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function submit(action: "approve" | "reject") {
    setPendingAction(action);
    setFeedback(null);
    try {
      await apiRequest<{ id: string; status: string }>(`/api/admin/reviews/${props.articleId}/${action}`, {
        method: "POST",
      });
      setFeedback({ type: "success", message: action === "approve" ? "已通过，正在刷新" : "已驳回，正在刷新" });
      window.setTimeout(() => {
        router.refresh();
      }, 300);
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "操作失败",
      });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="cellActions">
      <Button
        className="btn"
        onClick={() => void submit("approve")}
        loading={pendingAction === "approve"}
        disabled={pendingAction !== null}
        data-testid="admin-review-approve"
      >
        通过
      </Button>
      <Button
        className="btn"
        onClick={() => void submit("reject")}
        loading={pendingAction === "reject"}
        disabled={pendingAction !== null}
        data-testid="admin-review-reject"
      >
        驳回
      </Button>
      {feedback ? (
        <span
          className={feedback.type === "error" ? "subMuted adminReviewReason" : "subMuted"}
          data-testid="admin-review-decision"
        >
          {feedback.message}
        </span>
      ) : null}
    </div>
  );
}