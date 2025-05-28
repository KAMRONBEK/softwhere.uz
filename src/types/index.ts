// Locale Types
export type Locale = 'en' | 'ru' | 'uz';

// Blog Post Types
export interface BlogPost {
  _id: string;
  title: string;
  slug: string;
  content: string;
  status: 'draft' | 'published';
  locale: Locale;
  generationGroupId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PostGroup {
  generationGroupId: string;
  posts: BlogPost[];
  createdAt: string;
  status: 'draft' | 'published' | 'mixed';
}

// API Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface GenerationRequest {
  category: string;
  customTopic?: string;
  locales: Locale[];
}

export interface GenerationResponse {
  success: boolean;
  message: string;
  posts: Array<{
    id: string;
    title: string;
    slug: string;
    locale: Locale;
    status: string;
  }>;
  generationGroupId: string;
}

// Component Props Types
export interface AdminComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface AdminBadgeProps extends AdminComponentProps {
  variant?: 'default' | 'status' | 'locale';
  status?: 'draft' | 'published' | 'mixed';
  locale?: Locale;
}

export interface AdminButtonProps extends AdminComponentProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

export interface AdminInputProps extends AdminComponentProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'textarea';
  placeholder?: string;
  value?: string;
  onChange?: (_value: string) => void;
  disabled?: boolean;
  required?: boolean;
  rows?: number;
}

export interface AdminSelectProps extends AdminComponentProps {
  options: Array<{ value: string; label: string }>;
  value?: string;
  onChange?: (_value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

// Project Data Types
export interface Project {
  id: number;
  name: string;
  description: {
    uz: string;
    ru: string;
  };
  technology: string;
  location: string;
  type: string;
  playMarket?: string;
  appStore?: string;
  website?: string;
}

// Form Types
export interface ContactForm {
  name: string;
  email: string;
  phone: string;
  message: string;
}

// Context Types
export interface BlogContextType {
  currentPost: BlogPost | null;
  setCurrentPost: (_post: BlogPost | null) => void;
}

// Error Types
export interface AppError {
  message: string;
  code?: string;
  status?: number;
}

// Utility Types
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface PaginationParams {
  page: number;
  limit: number;
  locale?: Locale;
  status?: 'draft' | 'published';
}

// Form validation types
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select';
  required?: boolean;
  options?: string[];
  validation?: (_value: string) => string | null;
}

export interface FormData {
  [key: string]: string;
}

export interface FormErrors {
  [key: string]: string;
}

export interface FormState {
  data: FormData;
  errors: FormErrors;
  isSubmitting: boolean;
  isValid: boolean;
  validate: (_value: string) => boolean;
  setField: (_name: string, _value: string) => void;
  setError: (_name: string, _error: string) => void;
  clearErrors: () => void;
  reset: () => void;
}
