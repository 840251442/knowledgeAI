"use client";

import { type FormEvent, useMemo, useState } from "react";
import { Button } from "antd";

import type { ApiResponse } from "@/types/api";
import type { ArticleCommentStatus, CommentView } from "@/types/article";

type CurrentUser = {
  id: string;
  role: "ADMIN" | "PERSONAL";
  displayName: string;
};

type CommentViewWithPermission = CommentView & { canDelete?: boolean };

type SubmitState = "idle" | "submitting";

type DeleteState = {
  type: "idle" | "deleting";
  id?: string;
};

function getAuthorLabel(comment: CommentView) {
  return comment.author.type === "GUEST" ? "游客" : comment.author.displayName;
}

function canDeleteComment(comment: CommentViewWithPermission, currentUser: CurrentUser | null) {
  if (typeof comment.canDelete === "boolean") return comment.canDelete;
  if (!currentUser) return false;
  if (currentUser.role === "ADMIN") return true;
  if (currentUser.role === "PERSONAL" && comment.author.userId) {
    return comment.author.userId === currentUser.id;
  }
  return false;
}

async function parseApiResponse<T>(res: Response): Promise<ApiResponse<T> | null> {
  try {
    return (await res.json()) as ApiResponse<T>;
  } catch {
    return null;
  }
}

export default function ArticleCommentSection(props: {
  slug: string;
  commentStatus: ArticleCommentStatus;
  initialComments: CommentView[];
  currentUser: CurrentUser | null;
}) {
  const [comments, setComments] = useState<CommentViewWithPermission[]>(props.initialComments);
  const [body, setBody] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [deleteState, setDeleteState] = useState<DeleteState>({ type: "idle" });
  const [error, setError] = useState("");

  const isClosed = props.commentStatus === "CLOSED";
  const hasComments = comments.length > 0;

  const commentCountLabel = useMemo(() => {
    return `${comments.length} 条`;
  }, [comments.length]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = body.trim();
    if (!trimmed) {
      setError("请输入评论内容");
      return;
    }

    setSubmitState("submitting");
    setError("");

    try {
      const res = await fetch(`/api/articles/${props.slug}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: trimmed }),
      });

      const json = await parseApiResponse<CommentViewWithPermission>(res);
      if (!res.ok || !json || !json.success) {
        const message = json && !json.success ? json.error.message : "提交失败";
        throw new Error(message);
      }

      setComments((prev) => [...prev, json.data]);
      setBody("");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "提交失败";
      setError(message);
    } finally {
      setSubmitState("idle");
    }
  }

  async function handleDelete(comment: CommentViewWithPermission) {
    if (deleteState.type === "deleting") return;
    setDeleteState({ type: "deleting", id: comment.id });
    setError("");

    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await parseApiResponse<{ id: string }>(res);

      if (!res.ok || !json || !json.success) {
        const message = json && !json.success ? json.error.message : "删除失败";
        throw new Error(message);
      }

      setComments((prev) => prev.filter((item) => item.id !== comment.id));
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "删除失败";
      setError(message);
    } finally {
      setDeleteState({ type: "idle" });
    }
  }

  return (
    <section className="card commentSection" data-testid="article-comment-section">
      <div className="commentHeader">
        <h3>评论</h3>
        <span className="commentCount">{commentCountLabel}</span>
      </div>

      {!hasComments ? <div className="commentEmpty">暂无评论</div> : null}

      {error ? <div className="commentError">{error}</div> : null}

      {hasComments ? (
        <div className="commentList">
          {comments.map((comment) => {
            const canDelete = canDeleteComment(comment, props.currentUser);
            const deleting = deleteState.type === "deleting" && deleteState.id === comment.id;
            return (
              <div key={comment.id} className="commentItem">
                <div className="commentMeta">
                  <span className="commentAuthor">{getAuthorLabel(comment)}</span>
                  <span className="commentTime">{comment.createdAt.slice(0, 10)}</span>
                </div>
                <div className="commentBody">{comment.body}</div>
                {canDelete ? (
                  <div className="commentActions">
                    <Button
                      className="btn commentDelete"
                      htmlType="button"
                      disabled={deleting}
                      onClick={() => handleDelete(comment)}
                    >
                      {deleting ? "删除中..." : "删除"}
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {!isClosed ? (
        <form className="commentForm" onSubmit={handleSubmit}>
          <textarea
            className="input commentInput"
            data-testid="comment-input"
            placeholder="写下你的评论..."
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
          />
          <div className="commentActions">
            <Button className="btn btnPrimary" htmlType="submit" loading={submitState === "submitting"}>
              提交评论
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
