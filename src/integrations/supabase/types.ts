export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_action_plans: {
        Row: {
          created_at: string
          id: string
          inputs_hash: string
          model: string | null
          plan: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inputs_hash: string
          model?: string | null
          plan?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inputs_hash?: string
          model?: string | null
          plan?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deep_diagnoses: {
        Row: {
          created_at: string
          id: string
          inputs_hash: string
          model: string | null
          notes: string | null
          plan: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inputs_hash: string
          model?: string | null
          notes?: string | null
          plan?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inputs_hash?: string
          model?: string | null
          notes?: string | null
          plan?: Json
          user_id?: string
        }
        Relationships: []
      }
      energy_readings: {
        Row: {
          cost_eur: number | null
          created_at: string
          id: string
          kwh: number
          note: string | null
          reading_date: string
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cost_eur?: number | null
          created_at?: string
          id?: string
          kwh: number
          note?: string | null
          reading_date: string
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cost_eur?: number | null
          created_at?: string
          id?: string
          kwh?: number
          note?: string | null
          reading_date?: string
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      entitlements: {
        Row: {
          credits_remaining: number
          granted_at: string
          id: string
          product: string
          source: string
          user_id: string
        }
        Insert: {
          credits_remaining?: number
          granted_at?: string
          id?: string
          product: string
          source?: string
          user_id: string
        }
        Update: {
          credits_remaining?: number
          granted_at?: string
          id?: string
          product?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      knowledge_chunks: {
        Row: {
          content: string
          created_at: string
          embedding: string
          id: string
          metadata: Json
          source: string
          title: string | null
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding: string
          id?: string
          metadata?: Json
          source: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string
          id?: string
          metadata?: Json
          source?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      long_form_responses: {
        Row: {
          answers: Json
          created_at: string
          id: string
          progress: number
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: string
          progress?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          progress?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      long_form_uploads: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string | null
          notes: string | null
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          label?: string | null
          notes?: string | null
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          notes?: string | null
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      pricing_intents: {
        Row: {
          created_at: string
          id: string
          tier: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tier: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tier?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      room_scans: {
        Row: {
          analysis: Json
          created_at: string
          id: string
          image_path: string
          model: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis?: Json
          created_at?: string
          id?: string
          image_path: string
          model?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis?: Json
          created_at?: string
          id?: string
          image_path?: string
          model?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      share_cards: {
        Row: {
          co2_saved_kg: number
          created_at: string
          display_name: string | null
          headline: string | null
          id: string
          kwh_saved: number
          savings_eur: number
          slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          co2_saved_kg?: number
          created_at?: string
          display_name?: string | null
          headline?: string | null
          id?: string
          kwh_saved?: number
          savings_eur?: number
          slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          co2_saved_kg?: number
          created_at?: string
          display_name?: string | null
          headline?: string | null
          id?: string
          kwh_saved?: number
          savings_eur?: number
          slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      smart_kits: {
        Row: {
          created_at: string
          headline: string | null
          id: string
          items: Json
          slug: string
          subtotal_eur: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          headline?: string | null
          id?: string
          items?: Json
          slug: string
          subtotal_eur?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          headline?: string | null
          id?: string
          items?: Json
          slug?: string
          subtotal_eur?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      survey_responses: {
        Row: {
          answers: Json
          created_at: string
          id: string
          seconds_taken: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: string
          seconds_taken?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          seconds_taken?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_entitlement: {
        Args: { _product: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_knowledge_chunks: {
        Args: {
          match_count?: number
          min_similarity?: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          metadata: Json
          similarity: number
          source: string
          title: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "paid" | "free"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "paid", "free"],
    },
  },
} as const
