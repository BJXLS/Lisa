export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api/v1";

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("lisa_access_token");
}

export function setTokenPair(tokens: TokenPair) {
  if (typeof window === "undefined") return;
  localStorage.setItem("lisa_access_token", tokens.access_token);
  localStorage.setItem("lisa_refresh_token", tokens.refresh_token);
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("lisa_access_token");
  localStorage.removeItem("lisa_refresh_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---- Auth ----

export const authApi = {
  register: (payload: { email: string; password: string; name?: string }) =>
    request<TokenPair>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  login: (payload: { email: string; password: string }) =>
    request<TokenPair>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  me: () =>
    request<{ id: string; email: string; name: string | null; role: string }>(
      "/auth/me",
    ),
};

// ---- Resumes ----

export type ResumeListItem = {
  id: string;
  title: string;
  target_job: string | null;
  status: string;
  score: number | null;
  template_id: string;
  updated_at: string;
};

export const resumeApi = {
  list: () => request<ResumeListItem[]>("/resumes"),
  create: (payload: { title: string; target_job?: string }) =>
    request<{ id: string }>("/resumes", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  optimize: (
    resumeId: string,
    payload: { job_description?: string },
  ) =>
    request<{
      overall_score: number;
      dimensions: Record<string, unknown>;
      suggestions: Array<Record<string, unknown>>;
      keywords: Record<string, unknown>;
    }>(`/resumes/${resumeId}/optimize`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

// ---- Interviews ----

export type InterviewListItem = {
  id: string;
  target_job: string;
  type: string;
  status: string;
  started_at: string;
};

export type InterviewMessage = {
  id: string;
  role: string;
  content: string;
  sequence: number;
};

export type InterviewDetail = InterviewListItem & {
  messages: InterviewMessage[];
};

export type InterviewFeedback = {
  overall_score: number;
  content_score: number;
  structure_score: number;
  expression_score: number;
  professional_score: number;
  communication_score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  question_feedbacks: Array<Record<string, unknown>>;
  suggestions: string[];
};

export const interviewApi = {
  list: () => request<InterviewListItem[]>("/interviews"),
  create: (payload: {
    target_job: string;
    type?: string;
    difficulty?: string;
    job_description?: string;
  }) =>
    request<InterviewDetail>("/interviews", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  get: (id: string) => request<InterviewDetail>(`/interviews/${id}`),
  answer: (id: string, content: string) =>
    request<InterviewDetail>(`/interviews/${id}/answer`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
  end: (id: string) =>
    request<InterviewFeedback>(`/interviews/${id}/end`, { method: "POST" }),
};

// ---- Chat (SSE stream) ----

export async function* chatStream(
  message: string,
  conversationType: string = "general",
  conversationId?: string,
): AsyncGenerator<string, void, unknown> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      message,
      conversation_type: conversationType,
      conversation_id: conversationId,
    }),
  });

  if (!res.ok || !res.body) throw new Error(`Chat failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") return;
        yield data;
      }
    }
  }
}
