export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type LearningStyle = "theory" | "practice" | "mixed";
export type MaterialType = "text" | "quiz" | "exercise" | "code_example";

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  created_at: string;
}

export interface Preference {
  id: number;
  preferred_material_types: MaterialType[];
  available_hours_per_week: number;
  learning_style: LearningStyle;
  updated_at: string;
}

export interface Module {
  id: number;
  order_index: number;
  title: string;
  summary: string;
  completed: boolean;
}

export interface LearningPath {
  id: number;
  technology: string;
  experience_level: ExperienceLevel;
  learning_goal: string | null;
  title: string;
  description: string;
  status: string;
  created_at: string;
  modules: Module[];
}

export interface LearningPathSummary {
  id: number;
  technology: string;
  experience_level: ExperienceLevel;
  title: string;
  description: string;
  status: string;
  created_at: string;
  module_count: number;
  completed_module_count: number;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface MaterialContent {
  explanation?: string;
  language?: string;
  code?: string;
  instructions?: string;
  hints?: string[];
  solution?: string;
  questions?: QuizQuestion[];
}

export interface Material {
  id: number;
  material_type: MaterialType;
  content: MaterialContent;
  version: number;
  created_at: string;
}

export type PaceAssessment = "slower" | "on_track" | "faster";

export interface Recommendation {
  id: number;
  pace_assessment: PaceAssessment;
  recommended_experience_level: ExperienceLevel;
  recommended_module_id: number | null;
  recommended_module_title: string | null;
  rationale: string;
  created_at: string;
}

export interface Submission {
  id: number;
  material_id: number;
  submitted_code: string;
  passed: boolean;
  feedback: string;
  strengths: string[];
  improvements: string[];
  created_at: string;
}
