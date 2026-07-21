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
      announcements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message: string
          published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          auto_punch_out_after: number
          half_day_max_hours: number
          id: boolean
          late_grace_minutes: number
          signup_allowed_domains: string[]
          standard_hours: number
          timezone: string
          updated_at: string
          updated_by: string | null
          work_day_end: string
          work_day_start: string
        }
        Insert: {
          auto_punch_out_after?: number
          half_day_max_hours?: number
          id?: boolean
          late_grace_minutes?: number
          signup_allowed_domains?: string[]
          standard_hours?: number
          timezone?: string
          updated_at?: string
          updated_by?: string | null
          work_day_end?: string
          work_day_start?: string
        }
        Update: {
          auto_punch_out_after?: number
          half_day_max_hours?: number
          id?: boolean
          late_grace_minutes?: number
          signup_allowed_domains?: string[]
          standard_hours?: number
          timezone?: string
          updated_at?: string
          updated_by?: string | null
          work_day_end?: string
          work_day_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          auto_punched_out: boolean
          break_minutes: number
          break_started_at: string | null
          browser: string | null
          created_at: string
          date: string
          device: string | null
          employee_id: string
          id: string
          late_minutes: number | null
          overtime_hours: number | null
          punch_in: string | null
          punch_in_lat: number | null
          punch_in_lng: number | null
          punch_out: string | null
          punch_out_lat: number | null
          punch_out_lng: number | null
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
          working_hours: number | null
        }
        Insert: {
          auto_punched_out?: boolean
          break_minutes?: number
          break_started_at?: string | null
          browser?: string | null
          created_at?: string
          date?: string
          device?: string | null
          employee_id: string
          id?: string
          late_minutes?: number | null
          overtime_hours?: number | null
          punch_in?: string | null
          punch_in_lat?: number | null
          punch_in_lng?: number | null
          punch_out?: string | null
          punch_out_lat?: number | null
          punch_out_lng?: number | null
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          working_hours?: number | null
        }
        Update: {
          auto_punched_out?: boolean
          break_minutes?: number
          break_started_at?: string | null
          browser?: string | null
          created_at?: string
          date?: string
          device?: string | null
          employee_id?: string
          id?: string
          late_minutes?: number | null
          overtime_hours?: number | null
          punch_in?: string | null
          punch_in_lat?: number | null
          punch_in_lng?: number | null
          punch_out?: string | null
          punch_out_lat?: number | null
          punch_out_lng?: number | null
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          working_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          attendance_id: string
          browser: string | null
          created_at: string
          device: string | null
          employee_id: string
          id: string
          punch_in: string
          punch_in_lat: number | null
          punch_in_lng: number | null
          punch_out: string | null
          punch_out_lat: number | null
          punch_out_lng: number | null
        }
        Insert: {
          attendance_id: string
          browser?: string | null
          created_at?: string
          device?: string | null
          employee_id: string
          id?: string
          punch_in: string
          punch_in_lat?: number | null
          punch_in_lng?: number | null
          punch_out?: string | null
          punch_out_lat?: number | null
          punch_out_lng?: number | null
        }
        Update: {
          attendance_id?: string
          browser?: string | null
          created_at?: string
          device?: string | null
          employee_id?: string
          id?: string
          punch_in?: string
          punch_in_lat?: number | null
          punch_in_lng?: number | null
          punch_out?: string | null
          punch_out_lat?: number | null
          punch_out_lng?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          browser: string | null
          created_at: string
          id: string
          ip_address: unknown
          module: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          browser?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          module: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          browser?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          module?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          created_by: string | null
          has_crm_access: boolean
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          has_crm_access?: boolean
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          has_crm_access?: boolean
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invited_emails: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          invited_by: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          invited_by?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          invited_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invited_emails_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          activity: Database["public"]["Enums"]["lead_activity_kind"]
          created_at: string
          employee_id: string | null
          from_status: Database["public"]["Enums"]["lead_status"] | null
          id: string
          lead_id: string
          remarks: string | null
          to_status: Database["public"]["Enums"]["lead_status"] | null
        }
        Insert: {
          activity?: Database["public"]["Enums"]["lead_activity_kind"]
          created_at?: string
          employee_id?: string | null
          from_status?: Database["public"]["Enums"]["lead_status"] | null
          id?: string
          lead_id: string
          remarks?: string | null
          to_status?: Database["public"]["Enums"]["lead_status"] | null
        }
        Update: {
          activity?: Database["public"]["Enums"]["lead_activity_kind"]
          created_at?: string
          employee_id?: string | null
          from_status?: Database["public"]["Enums"]["lead_status"] | null
          id?: string
          lead_id?: string
          remarks?: string | null
          to_status?: Database["public"]["Enums"]["lead_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          closed_at: string | null
          company: string
          contact_name: string | null
          country: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          next_followup: string | null
          phone: string | null
          priority: Database["public"]["Enums"]["lead_priority"]
          product_sector: string | null
          remarks: string | null
          scope: string | null
          source: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
          value_estimate: number | null
          website: string | null
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          company: string
          contact_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          next_followup?: string | null
          phone?: string | null
          priority?: Database["public"]["Enums"]["lead_priority"]
          product_sector?: string | null
          remarks?: string | null
          scope?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          value_estimate?: number | null
          website?: string | null
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          company?: string
          contact_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          next_followup?: string | null
          phone?: string | null
          priority?: Database["public"]["Enums"]["lead_priority"]
          product_sector?: string | null
          remarks?: string | null
          scope?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          value_estimate?: number | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leaves: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          attachment: string | null
          created_at: string
          decision_note: string | null
          employee_id: string
          end_date: string
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          attachment?: string | null
          created_at?: string
          decision_note?: string | null
          employee_id: string
          end_date: string
          id?: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          attachment?: string | null
          created_at?: string
          decision_note?: string | null
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          reason?: string
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaves_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaves_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string | null
          read: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          email: string
          id: string
          manager_id: string | null
          name: string
          phone: string | null
          profile_photo: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["employee_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email: string
          id: string
          manager_id?: string | null
          name: string
          phone?: string | null
          profile_photo?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string
          id?: string
          manager_id?: string | null
          name?: string
          phone?: string | null
          profile_photo?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_by: string | null
          assigned_to: string
          completed_at: string | null
          created_at: string
          deadline: string | null
          description: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_to: string
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      work_logs: {
        Row: {
          achievement: string | null
          attachment: string | null
          created_at: string
          description: string | null
          employee_id: string
          hours: number
          id: string
          log_date: string
          project: string
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["work_log_status"]
          task: string
          tomorrow_plan: string | null
          updated_at: string
        }
        Insert: {
          achievement?: string | null
          attachment?: string | null
          created_at?: string
          description?: string | null
          employee_id: string
          hours: number
          id?: string
          log_date?: string
          project: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["work_log_status"]
          task: string
          tomorrow_plan?: string | null
          updated_at?: string
        }
        Update: {
          achievement?: string | null
          attachment?: string | null
          created_at?: string
          description?: string | null
          employee_id?: string
          hours?: number
          id?: string
          log_date?: string
          project?: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["work_log_status"]
          task?: string
          tomorrow_plan?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_logs_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acting_as_service_role: { Args: never; Returns: boolean }
      acting_elevated: { Args: never; Returns: boolean }
      acting_outside_postgrest: { Args: never; Returns: boolean }
      allow_signup_domain: { Args: { p_domain: string }; Returns: string[] }
      analytics_attendance_summary: {
        Args: { p_from: string; p_to: string }
        Returns: {
          avg_hours: number
          day: string
          late_count: number
          overtime_hours: number
          present_count: number
          total_hours: number
        }[]
      }
      analytics_daily_leads: {
        Args: { p_from: string; p_to: string }
        Returns: {
          created: number
          day: string
          lost: number
          won: number
        }[]
      }
      analytics_dashboard_stats: {
        Args: { p_date: string }
        Returns: {
          active_employees: number
          followups_due: number
          late_today: number
          on_leave_today: number
          open_leads: number
          open_tasks: number
          overdue_tasks: number
          pending_leaves: number
          present_today: number
          working_now: number
        }[]
      }
      analytics_employee_performance: {
        Args: { p_from: string; p_to: string }
        Returns: {
          avg_hours: number
          days_late: number
          days_present: number
          department: string
          employee_id: string
          employee_name: string
          logged_hours: number
          overtime_hours: number
          tasks_completed: number
          total_hours: number
          work_log_count: number
        }[]
      }
      analytics_lead_funnel: {
        Args: { p_from?: string; p_to?: string }
        Returns: {
          lead_count: number
          status: Database["public"]["Enums"]["lead_status"]
          total_value: number
        }[]
      }
      analytics_leave_stats: {
        Args: { p_from: string; p_to: string }
        Returns: {
          approved: number
          leave_type: Database["public"]["Enums"]["leave_type"]
          pending: number
          rejected: number
          request_count: number
          total_days: number
        }[]
      }
      auto_punch_out_stale_days: { Args: never; Returns: number }
      bootstrap_first_super_admin: {
        Args: { p_email: string }
        Returns: {
          created_at: string
          department: string | null
          email: string
          id: string
          manager_id: string | null
          name: string
          phone: string | null
          profile_photo: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["employee_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_access_employee: { Args: { target: string }; Returns: boolean }
      can_access_leads: { Args: never; Returns: boolean }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      dispatch_followup_reminders: { Args: never; Returns: number }
      dispatch_punch_out_reminders: { Args: never; Returns: number }
      is_manager: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      leave_working_days: {
        Args: { p_end: string; p_start: string }
        Returns: number
      }
      manages: { Args: { target: string }; Returns: boolean }
      notify: {
        Args: {
          p_link?: string
          p_message: string
          p_title: string
          p_type: Database["public"]["Enums"]["notification_type"]
          p_user_id: string
        }
        Returns: undefined
      }
      provision_account: {
        Args: { p_email: string; p_name: string; p_password: string }
        Returns: string
      }
      punch_in: {
        Args: {
          p_browser?: string
          p_device?: string
          p_lat?: number
          p_lng?: number
        }
        Returns: {
          auto_punched_out: boolean
          break_minutes: number
          break_started_at: string | null
          browser: string | null
          created_at: string
          date: string
          device: string | null
          employee_id: string
          id: string
          late_minutes: number | null
          overtime_hours: number | null
          punch_in: string | null
          punch_in_lat: number | null
          punch_in_lng: number | null
          punch_out: string | null
          punch_out_lat: number | null
          punch_out_lng: number | null
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
          working_hours: number | null
        }
        SetofOptions: {
          from: "*"
          to: "attendance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      punch_out: {
        Args: { p_lat?: number; p_lng?: number }
        Returns: {
          auto_punched_out: boolean
          break_minutes: number
          break_started_at: string | null
          browser: string | null
          created_at: string
          date: string
          device: string | null
          employee_id: string
          id: string
          late_minutes: number | null
          overtime_hours: number | null
          punch_in: string | null
          punch_in_lat: number | null
          punch_in_lng: number | null
          punch_out: string | null
          punch_out_lat: number | null
          punch_out_lng: number | null
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
          working_hours: number | null
        }
        SetofOptions: {
          from: "*"
          to: "attendance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      purge_expired_invites: { Args: never; Returns: number }
      reschedule_auto_punch_out: { Args: never; Returns: string }
      revoke_signup_domain: { Args: { p_domain: string }; Returns: string[] }
      tasks_needing_attention: {
        Args: { p_limit?: number }
        Returns: {
          assignee_id: string
          assignee_name: string
          completed_at: string
          deadline: string
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }[]
      }
      toggle_break: {
        Args: never
        Returns: {
          auto_punched_out: boolean
          break_minutes: number
          break_started_at: string | null
          browser: string | null
          created_at: string
          date: string
          device: string | null
          employee_id: string
          id: string
          late_minutes: number | null
          overtime_hours: number | null
          punch_in: string | null
          punch_in_lat: number | null
          punch_in_lng: number | null
          punch_out: string | null
          punch_out_lat: number | null
          punch_out_lng: number | null
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
          working_hours: number | null
        }
        SetofOptions: {
          from: "*"
          to: "attendance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      attendance_status:
        | "not_started"
        | "working"
        | "on_break"
        | "completed"
        | "absent"
        | "on_leave"
      audit_action: "insert" | "update" | "delete"
      employee_status: "active" | "inactive" | "suspended"
      lead_activity_kind:
        | "note"
        | "call"
        | "email"
        | "meeting"
        | "status_change"
        | "assignment"
        | "followup_scheduled"
      lead_priority: "low" | "medium" | "high"
      lead_source:
        | "website"
        | "referral"
        | "cold_call"
        | "email_campaign"
        | "social"
        | "event"
        | "partner"
        | "other"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "proposal"
        | "negotiation"
        | "won"
        | "lost"
      leave_status: "pending" | "approved" | "rejected" | "cancelled"
      leave_type:
        | "casual"
        | "sick"
        | "earned"
        | "unpaid"
        | "comp_off"
        | "maternity"
        | "paternity"
      notification_type:
        | "task_assigned"
        | "leave_approved"
        | "leave_rejected"
        | "leave_requested"
        | "followup_due"
        | "punch_out_reminder"
        | "announcement"
        | "work_log_reviewed"
        | "lead_assigned"
        | "task_status_changed"
        | "auto_punched_out"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "blocked" | "done" | "cancelled"
      user_role: "super_admin" | "manager" | "employee"
      work_log_status: "draft" | "submitted" | "reviewed" | "needs_changes"
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
      attendance_status: [
        "not_started",
        "working",
        "on_break",
        "completed",
        "absent",
        "on_leave",
      ],
      audit_action: ["insert", "update", "delete"],
      employee_status: ["active", "inactive", "suspended"],
      lead_activity_kind: [
        "note",
        "call",
        "email",
        "meeting",
        "status_change",
        "assignment",
        "followup_scheduled",
      ],
      lead_priority: ["low", "medium", "high"],
      lead_source: [
        "website",
        "referral",
        "cold_call",
        "email_campaign",
        "social",
        "event",
        "partner",
        "other",
      ],
      lead_status: [
        "new",
        "contacted",
        "qualified",
        "proposal",
        "negotiation",
        "won",
        "lost",
      ],
      leave_status: ["pending", "approved", "rejected", "cancelled"],
      leave_type: [
        "casual",
        "sick",
        "earned",
        "unpaid",
        "comp_off",
        "maternity",
        "paternity",
      ],
      notification_type: [
        "task_assigned",
        "leave_approved",
        "leave_rejected",
        "leave_requested",
        "followup_due",
        "punch_out_reminder",
        "announcement",
        "work_log_reviewed",
        "lead_assigned",
        "task_status_changed",
        "auto_punched_out",
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "blocked", "done", "cancelled"],
      user_role: ["super_admin", "manager", "employee"],
      work_log_status: ["draft", "submitted", "reviewed", "needs_changes"],
    },
  },
} as const
