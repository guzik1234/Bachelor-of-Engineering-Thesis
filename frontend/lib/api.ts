import type {
  LearningPath,
  LearningPathSummary,
  Material,
  Preference,
  Recommendation,
  Submission,
  User,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail || detail;
    } catch {
      // response body wasn't JSON — keep statusText
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export const api = {
  register: (email: string, password: string, full_name?: string) =>
    request<{ id: number; email: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, full_name }),
    }),

  login: (email: string, password: string) =>
    request<{ access_token: string; token_type: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: (token: string) => request<User>("/api/users/me", {}, token),

  getPreferences: (token: string) => request<Preference | null>("/api/preferences", {}, token),

  updatePreferences: (
    token: string,
    payload: Pick<Preference, "preferred_material_types" | "available_hours_per_week" | "learning_style">
  ) => request<Preference>("/api/preferences", { method: "PUT", body: JSON.stringify(payload) }, token),

  listPaths: (token: string) => request<LearningPathSummary[]>("/api/learning-paths", {}, token),

  generatePath: (
    token: string,
    payload: { technology: string; experience_level: string; learning_goal?: string }
  ) => request<LearningPath>("/api/learning-paths/generate", { method: "POST", body: JSON.stringify(payload) }, token),

  getPath: (token: string, pathId: number) => request<LearningPath>(`/api/learning-paths/${pathId}`, {}, token),

  deletePath: (token: string, pathId: number) =>
    request<void>(`/api/learning-paths/${pathId}`, { method: "DELETE" }, token),

  getModuleMaterials: (token: string, moduleId: number) =>
    request<Material[]>(`/api/materials/module/${moduleId}`, {}, token),

  regenerateMaterial: (token: string, moduleId: number, materialType: string) =>
    request<Material>(`/api/materials/module/${moduleId}/regenerate/${materialType}`, { method: "POST" }, token),

  setProgress: (token: string, moduleId: number, completed: boolean) =>
    request<{ module_id: number; completed: boolean }>(
      `/api/progress/module/${moduleId}`,
      { method: "PUT", body: JSON.stringify({ completed }) },
      token
    ),

  submitFeedback: (token: string, materialId: number, rating: number, comment?: string) =>
    request<{ id: number }>(
      "/api/feedback",
      { method: "POST", body: JSON.stringify({ material_id: materialId, rating, comment }) },
      token
    ),

  submitSolution: (token: string, materialId: number, code: string) =>
    request<Submission>(
      `/api/materials/${materialId}/submissions`,
      { method: "POST", body: JSON.stringify({ code }) },
      token
    ),

  listSubmissions: (token: string, materialId: number) =>
    request<Submission[]>(`/api/materials/${materialId}/submissions`, {}, token),

  getRecommendation: async (token: string, pathId: number): Promise<Recommendation | null> => {
    try {
      return await request<Recommendation>(`/api/learning-paths/${pathId}/recommendation`, {}, token);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },

  generateRecommendation: (token: string, pathId: number) =>
    request<Recommendation>(`/api/learning-paths/${pathId}/recommendation`, { method: "POST" }, token),
};
