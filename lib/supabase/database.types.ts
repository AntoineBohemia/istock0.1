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
    PostgrestVersion: "13.0.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          organization_id: string | null
          parent_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          organization_id?: string | null
          parent_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_assignments: {
        Row: {
          assigned_at: string
          created_at: string | null
          id: string
          organization_id: string | null
          product_id: string
          quantity: number
          technician_id: string
        }
        Insert: {
          assigned_at?: string
          created_at?: string | null
          id?: string
          organization_id?: string | null
          product_id: string
          quantity?: number
          technician_id: string
        }
        Update: {
          assigned_at?: string
          created_at?: string | null
          id?: string
          organization_id?: string | null
          product_id?: string
          quantity?: number
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_assignments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_assignments_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_progress: {
        Row: {
          completed_at: string | null
          completed_steps: Json
          created_at: string
          current_step: string
          id: string
          onboarding_data: Json
          organization_id: string | null
          skipped_steps: Json
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_steps?: Json
          created_at?: string
          current_step?: string
          id?: string
          onboarding_data?: Json
          organization_id?: string | null
          skipped_steps?: Json
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_steps?: Json
          created_at?: string
          current_step?: string
          id?: string
          onboarding_data?: Json
          organization_id?: string | null
          skipped_steps?: Json
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_progress_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invited_by: string | null
          organization_id: string
          role: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: string | null
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      product_price_history: {
        Row: {
          created_at: string
          effective_from: string
          id: string
          price: number
          product_id: string
        }
        Insert: {
          created_at?: string
          effective_from?: string
          id?: string
          price: number
          product_id: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          id?: string
          price?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          archived_at: string | null
          category_id: string | null
          created_at: string | null
          description: string | null
          icon_color: string | null
          icon_name: string | null
          id: string
          image_url: string | null
          name: string
          organization_id: string | null
          price: number | null
          product_type: Database["public"]["Enums"]["product_type"]
          sku: string
          stock_current: number | null
          stock_min: number | null
          supplier_id: string | null
          updated_at: string | null
        }
        Insert: {
          archived_at?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          icon_color?: string | null
          icon_name?: string | null
          id?: string
          image_url?: string | null
          name: string
          organization_id?: string | null
          price?: number | null
          product_type?: Database["public"]["Enums"]["product_type"]
          sku: string
          stock_current?: number | null
          stock_min?: number | null
          supplier_id?: string | null
          updated_at?: string | null
        }
        Update: {
          archived_at?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          icon_color?: string | null
          icon_name?: string | null
          id?: string
          image_url?: string | null
          name?: string
          organization_id?: string | null
          price?: number | null
          product_type?: Database["public"]["Enums"]["product_type"]
          sku?: string
          stock_current?: number | null
          stock_min?: number | null
          supplier_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string | null
          id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          notes: string | null
          organization_id: string | null
          product_id: string
          quantity: number
          supplier_id: string | null
          technician_id: string | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          notes?: string | null
          organization_id?: string | null
          product_id: string
          quantity: number
          supplier_id?: string | null
          technician_id?: string | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          movement_type?: Database["public"]["Enums"]["stock_movement_type"]
          notes?: string | null
          organization_id?: string | null
          product_id?: string
          quantity?: number
          supplier_id?: string | null
          technician_id?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string | null
          id: string
          name: string
          organization_id: string | null
          website_url: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          organization_id?: string | null
          website_url?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_inventory: {
        Row: {
          assigned_at: string | null
          id: string
          organization_id: string | null
          product_id: string
          quantity: number
          technician_id: string
        }
        Insert: {
          assigned_at?: string | null
          id?: string
          organization_id?: string | null
          product_id: string
          quantity?: number
          technician_id: string
        }
        Update: {
          assigned_at?: string | null
          id?: string
          organization_id?: string | null
          product_id?: string
          quantity?: number
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_inventory_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_inventory_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_inventory_history: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string | null
          snapshot: Json
          technician_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id?: string | null
          snapshot: Json
          technician_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string | null
          snapshot?: Json
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_inventory_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_inventory_history_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      technicians: {
        Row: {
          archived_at: string | null
          city: string | null
          clothing_size: string | null
          created_at: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          organization_id: string | null
          phone: string | null
          photo_url: string | null
          supplier_id: string | null
          tablet_ref: string | null
          vehicle_brand: string | null
          vehicle_plate: string | null
        }
        Insert: {
          archived_at?: string | null
          city?: string | null
          clothing_size?: string | null
          created_at?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          organization_id?: string | null
          phone?: string | null
          photo_url?: string | null
          supplier_id?: string | null
          tablet_ref?: string | null
          vehicle_brand?: string | null
          vehicle_plate?: string | null
        }
        Update: {
          archived_at?: string | null
          city?: string | null
          clothing_size?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          organization_id?: string | null
          phone?: string | null
          photo_url?: string | null
          supplier_id?: string | null
          tablet_ref?: string | null
          vehicle_brand?: string | null
          vehicle_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technicians_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technicians_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_organizations: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean | null
          organization_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          organization_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          organization_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      organization_members_view: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          email: string | null
          id: string | null
          is_default: boolean | null
          joined_at: string | null
          organization_id: string | null
          role: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation_secure: { Args: { p_token: string }; Returns: Json }
      add_to_technician_inventory: {
        Args: { p_items: Json; p_technician_id: string }
        Returns: Json
      }
      assign_equipment: {
        Args: {
          p_organization_id: string
          p_product_id: string
          p_quantity?: number
          p_technician_id: string
        }
        Returns: Json
      }
      create_organization_with_owner: {
        Args: { org_logo_url?: string; org_name: string; org_slug: string }
        Returns: Json
      }
      create_stock_entry: {
        Args: {
          p_notes?: string
          p_organization_id: string
          p_product_id: string
          p_quantity: number
          p_supplier_id?: string
          p_unit_price?: number
        }
        Returns: Json
      }
      create_stock_exit: {
        Args: {
          p_notes?: string
          p_organization_id: string
          p_product_id: string
          p_quantity: number
          p_technician_id?: string
          p_type: string
        }
        Returns: Json
      }
      current_user_role_in_org: { Args: { p_org_id: string }; Returns: string }
      get_dashboard_stats: {
        Args: { p_organization_id?: string }
        Returns: Json
      }
      get_dashboard_tasks: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      get_health_score: { Args: { p_organization_id: string }; Returns: Json }
      get_health_score_history: {
        Args: { p_months?: number; p_organization_id: string }
        Returns: Json
      }
      get_invitation_details: { Args: { p_token: string }; Returns: Json }
      get_technicians_with_stats: {
        Args: { p_organization_id?: string }
        Returns: Json
      }
      get_user_organization_ids:
        | { Args: never; Returns: string[] }
        | { Args: { p_user_id: string }; Returns: string[] }
      is_org_admin_or_owner: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      is_org_member_non_guest: { Args: { p_org_id: string }; Returns: boolean }
      is_organization_owner: { Args: { org_id: string }; Returns: boolean }
      leave_organization: { Args: { p_organization_id: string }; Returns: Json }
      restock_technician:
        | { Args: { p_items: Json; p_technician_id: string }; Returns: Json }
        | {
            Args: {
              p_organization_id: string
              p_product_id: string
              p_quantity: number
              p_technician_id: string
            }
            Returns: undefined
          }
      transfer_ownership: {
        Args: { p_new_owner_id: string; p_organization_id: string }
        Returns: Json
      }
      unassign_equipment: {
        Args: {
          p_organization_id: string
          p_product_id: string
          p_quantity?: number
          p_technician_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      product_type: "consumable" | "equipment"
      stock_movement_type:
        | "entry"
        | "exit_technician"
        | "exit_anonymous"
        | "exit_loss"
        | "assign_equipment"
        | "unassign_equipment"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      product_type: ["consumable", "equipment"],
      stock_movement_type: [
        "entry",
        "exit_technician",
        "exit_anonymous",
        "exit_loss",
        "assign_equipment",
        "unassign_equipment",
      ],
    },
  },
} as const
