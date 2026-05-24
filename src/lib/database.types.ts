export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          active_workspace_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          active_workspace_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          active_workspace_id?: string | null;
          updated_at?: string | null;
        };
      };
      workspaces: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          level: string | null;
          hours_per_day: number | null;
          created_at: number;
        };
        Insert: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          level?: string | null;
          hours_per_day?: number | null;
          created_at: number;
        };
        Update: {
          name?: string;
          color?: string;
          level?: string | null;
          hours_per_day?: number | null;
        };
      };
      workspace_schedules: {
        Row: {
          user_id: string;
          workspace_id: string;
          days: Record<string, unknown>;
          updated_at: string | null;
        };
        Insert: {
          user_id: string;
          workspace_id: string;
          days: Record<string, unknown>;
          updated_at?: string | null;
        };
        Update: {
          days?: Record<string, unknown>;
          updated_at?: string | null;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          user_id: string;
          role: 'ai' | 'user';
          text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: 'ai' | 'user';
          text: string;
          created_at?: string;
        };
        Update: never;
      };
      study_packs: {
        Row: {
          id: string;
          user_id: string;
          data: Record<string, unknown>;
        };
        Insert: {
          id: string;
          user_id: string;
          data: Record<string, unknown>;
        };
        Update: {
          data?: Record<string, unknown>;
        };
      };
      saved_docs: {
        Row: {
          id: string;
          user_id: string;
          data: Record<string, unknown>;
          saved_at: number;
        };
        Insert: {
          id: string;
          user_id: string;
          data: Record<string, unknown>;
          saved_at: number;
        };
        Update: {
          data?: Record<string, unknown>;
        };
      };
      video_plans: {
        Row: {
          video_id: string;
          user_id: string;
          data: Record<string, unknown>;
        };
        Insert: {
          video_id: string;
          user_id: string;
          data: Record<string, unknown>;
        };
        Update: {
          data?: Record<string, unknown>;
        };
      };
      weekly_assignments: {
        Row: {
          week_key: string;
          user_id: string;
          data: Record<string, unknown>;
        };
        Insert: {
          week_key: string;
          user_id: string;
          data: Record<string, unknown>;
        };
        Update: {
          data?: Record<string, unknown>;
        };
      };
    };
  };
}
