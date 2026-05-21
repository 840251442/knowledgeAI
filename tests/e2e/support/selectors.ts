export const adminLoginSelectors = {
  form: "admin-login-form",
  email: "admin-login-email",
  password: "admin-login-password",
  submit: "admin-login-submit",
} as const;

export const personalAuthSelectors = {
  registerForm: "personal-register-form",
  loginForm: "personal-login-form",
  email: "personal-auth-email",
  password: "personal-auth-password",
  phone: "personal-auth-phone",
  otp: "personal-auth-otp",
  submit: "personal-auth-submit",
} as const;

export const articleEditorSelectors = {
  root: "article-editor",
  title: "article-editor-title",
  slug: "article-editor-slug",
  summary: "article-editor-summary",
  category: "article-editor-category",
  markdown: "article-editor-markdown",
  save: "article-editor-save",
  publish: "article-editor-publish",
  unpublish: "article-editor-unpublish",
  aiEntry: "article-editor-ai-entry",
  aiPanel: "article-editor-ai-panel",
  aiKeyword: "article-editor-ai-keyword",
  aiGenerate: "article-editor-ai-generate",
  aiPreview: "article-editor-ai-preview",
  aiInsert: "article-editor-ai-insert",
  aiDiscard: "article-editor-ai-discard",
} as const;

export const searchSelectors = {
  form: "search-page-form",
  input: "search-page-input",
  resultCard: "search-result-card",
  resultTitle: "search-result-title",
  resultExcerpt: "search-result-excerpt",
  highlight: "search-highlight",
  logsPanel: "search-logs-panel",
  logRow: "search-log-row",
  logQuery: "search-log-query",
} as const;

export const personalArticleSelectors = {
  list: "personal-article-list",
  row: "personal-article-row",
  submitReview: "personal-article-submit-review",
  status: "personal-article-status",
} as const;

export const reviewQueueSelectors = {
  list: "admin-review-list",
  row: "admin-review-row",
  approve: "admin-review-approve",
  reject: "admin-review-reject",
  decision: "admin-review-decision",
} as const;
