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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      academic_catalog_events: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          district_id: string
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          district_id: string
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          district_id?: string
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_catalog_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_catalog_events_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_programs: {
        Row: {
          archived_at: string | null
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          district_id: string
          id: string
          published_at: string | null
          sort_order: number
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          district_id: string
          id?: string
          published_at?: string | null
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          district_id?: string
          id?: string
          published_at?: string | null
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academic_programs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_programs_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_programs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      area_memberships: {
        Row: {
          area_id: string
          created_at: string
          district_id: string
          id: string
          membership_id: string
          position: string | null
          status: string
        }
        Insert: {
          area_id: string
          created_at?: string
          district_id: string
          id?: string
          membership_id: string
          position?: string | null
          status?: string
        }
        Update: {
          area_id?: string
          created_at?: string
          district_id?: string
          id?: string
          membership_id?: string
          position?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "area_memberships_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_memberships_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_memberships_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
        }
        Relationships: []
      }
      congregations: {
        Row: {
          address: string | null
          city: string | null
          code: string | null
          created_at: string
          district_id: string
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code?: string | null
          created_at?: string
          district_id: string
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string | null
          created_at?: string
          district_id?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "congregations_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          archived_at: string | null
          course_id: string
          created_at: string
          created_by: string | null
          description: string | null
          district_id: string
          id: string
          published_at: string | null
          sort_order: number
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          course_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          district_id: string
          id?: string
          published_at?: string | null
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          course_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          district_id?: string
          id?: string
          published_at?: string | null
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_same_district_fkey"
            columns: ["course_id", "district_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id", "district_id"]
          },
          {
            foreignKeyName: "course_modules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_modules_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_modules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          archived_at: string | null
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          district_id: string
          estimated_minutes: number | null
          id: string
          level: string | null
          program_id: string
          published_at: string | null
          sort_order: number
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          district_id: string
          estimated_minutes?: number | null
          id?: string
          level?: string | null
          program_id: string
          published_at?: string | null
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          district_id?: string
          estimated_minutes?: number | null
          id?: string
          level?: string | null
          program_id?: string
          published_at?: string | null
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_program_same_district_fkey"
            columns: ["program_id", "district_id"]
            isOneToOne: false
            referencedRelation: "academic_programs"
            referencedColumns: ["id", "district_id"]
          },
          {
            foreignKeyName: "courses_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_versions: {
        Row: {
          change_summary: string | null
          course_id: string
          created_at: string
          created_by: string | null
          district_id: string
          id: string
          published_at: string | null
          snapshot: Json
          status: string
          version_number: number
        }
        Insert: {
          change_summary?: string | null
          course_id: string
          created_at?: string
          created_by?: string | null
          district_id: string
          id?: string
          published_at?: string | null
          snapshot: Json
          status?: string
          version_number: number
        }
        Update: {
          change_summary?: string | null
          course_id?: string
          created_at?: string
          created_by?: string | null
          district_id?: string
          id?: string
          published_at?: string | null
          snapshot?: Json
          status?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_versions_course_same_district_fkey"
            columns: ["course_id", "district_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id", "district_id"]
          },
          {
            foreignKeyName: "curriculum_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_versions_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      districts: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      invitation_notifications: {
        Row: {
          attempts: number
          created_at: string
          error_message: string | null
          id: string
          invitation_request_id: string
          last_attempt_at: string | null
          next_attempt_at: string
          notification_type: string
          processing_started_at: string | null
          provider_message_id: string | null
          recipient_email: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: string
          invitation_request_id: string
          last_attempt_at?: string | null
          next_attempt_at?: string
          notification_type: string
          processing_started_at?: string | null
          provider_message_id?: string | null
          recipient_email: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: string
          invitation_request_id?: string
          last_attempt_at?: string | null
          next_attempt_at?: string
          notification_type?: string
          processing_started_at?: string | null
          provider_message_id?: string | null
          recipient_email?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitation_notifications_invitation_request_id_fkey"
            columns: ["invitation_request_id"]
            isOneToOne: false
            referencedRelation: "invitation_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_requests: {
        Row: {
          date_of_birth: string | null
          decision_note: string | null
          email: string
          full_name: string
          id: string
          invitation_id: string
          phone: string | null
          requested_at: string
          requested_congregation_id: string | null
          requested_role_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          date_of_birth?: string | null
          decision_note?: string | null
          email: string
          full_name: string
          id?: string
          invitation_id: string
          phone?: string | null
          requested_at?: string
          requested_congregation_id?: string | null
          requested_role_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          date_of_birth?: string | null
          decision_note?: string | null
          email?: string
          full_name?: string
          id?: string
          invitation_id?: string
          phone?: string | null
          requested_at?: string
          requested_congregation_id?: string | null
          requested_role_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitation_requests_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_requests_requested_congregation_fkey"
            columns: ["requested_congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_requests_requested_role_fkey"
            columns: ["requested_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          area_id: string | null
          congregation_id: string | null
          created_at: string
          district_id: string | null
          email: string | null
          expires_at: string
          id: string
          invitation_type: string
          invited_by: string | null
          revoked_at: string | null
          role_id: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          area_id?: string | null
          congregation_id?: string | null
          created_at?: string
          district_id?: string | null
          email?: string | null
          expires_at: string
          id?: string
          invitation_type?: string
          invited_by?: string | null
          revoked_at?: string | null
          role_id: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          area_id?: string | null
          congregation_id?: string | null
          created_at?: string
          district_id?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          invitation_type?: string
          invited_by?: string | null
          revoked_at?: string | null
          role_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_congregation_id_fkey"
            columns: ["congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          archived_at: string | null
          content: Json
          created_at: string
          created_by: string | null
          district_id: string
          estimated_minutes: number | null
          id: string
          module_id: string
          objectives: string[]
          published_at: string | null
          sort_order: number
          status: string
          summary: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          content?: Json
          created_at?: string
          created_by?: string | null
          district_id: string
          estimated_minutes?: number | null
          id?: string
          module_id: string
          objectives?: string[]
          published_at?: string | null
          sort_order?: number
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          content?: Json
          created_at?: string
          created_by?: string | null
          district_id?: string
          estimated_minutes?: number | null
          id?: string
          module_id?: string
          objectives?: string[]
          published_at?: string | null
          sort_order?: number
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_module_same_district_fkey"
            columns: ["module_id", "district_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id", "district_id"]
          },
          {
            foreignKeyName: "lessons_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_transfer_area_reviews: {
        Row: {
          area_id: string
          area_membership_id: string
          created_at: string
          id: string
          observations: string | null
          position_snapshot: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          transfer_id: string
        }
        Insert: {
          area_id: string
          area_membership_id: string
          created_at?: string
          id?: string
          observations?: string | null
          position_snapshot?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          transfer_id: string
        }
        Update: {
          area_id?: string
          area_membership_id?: string
          created_at?: string
          id?: string
          observations?: string | null
          position_snapshot?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_transfer_area_reviews_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_transfer_area_reviews_area_membership_id_fkey"
            columns: ["area_membership_id"]
            isOneToOne: false
            referencedRelation: "area_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_transfer_area_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_transfer_area_reviews_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "membership_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_transfers: {
        Row: {
          created_at: string
          from_congregation_id: string
          from_district_id: string
          id: string
          membership_id: string
          observations: string | null
          performed_by: string | null
          to_congregation_id: string
          to_district_id: string
        }
        Insert: {
          created_at?: string
          from_congregation_id: string
          from_district_id: string
          id?: string
          membership_id: string
          observations?: string | null
          performed_by?: string | null
          to_congregation_id: string
          to_district_id: string
        }
        Update: {
          created_at?: string
          from_congregation_id?: string
          from_district_id?: string
          id?: string
          membership_id?: string
          observations?: string | null
          performed_by?: string | null
          to_congregation_id?: string
          to_district_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_transfers_from_congregation_id_fkey"
            columns: ["from_congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_transfers_from_district_id_fkey"
            columns: ["from_district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_transfers_membership_fk"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_transfers_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_transfers_to_congregation_id_fkey"
            columns: ["to_congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_transfers_to_district_id_fkey"
            columns: ["to_district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          congregation_id: string
          created_at: string
          id: string
          joined_at: string
          member_status: string
          user_id: string
        }
        Insert: {
          congregation_id: string
          created_at?: string
          id?: string
          joined_at?: string
          member_status?: string
          user_id: string
        }
        Update: {
          congregation_id?: string
          created_at?: string
          id?: string
          joined_at?: string
          member_status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_congregation_id_fkey"
            columns: ["congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          role_key: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          role_key: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          role_key?: string
        }
        Relationships: []
      }
      user_role_assignments: {
        Row: {
          assigned_by: string | null
          congregation_id: string | null
          created_at: string
          district_id: string | null
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          congregation_id?: string | null
          created_at?: string
          district_id?: string | null
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          congregation_id?: string | null
          created_at?: string
          district_id?: string | null
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_role_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_assignments_congregation_id_fkey"
            columns: ["congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_assignments_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_assignments_user_id_fkey"
            columns: ["user_id"]
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
      accept_invitation: { Args: { p_token_hash: string }; Returns: Json }
      activate_approved_invitation: {
        Args: { p_request_id: string }
        Returns: Json
      }
      can_manage_area: {
        Args: { p_area_id: string; p_district_id: string }
        Returns: boolean
      }
      can_manage_congregation: {
        Args: { p_congregation_id: string }
        Returns: boolean
      }
      can_manage_district: { Args: { p_district_id: string }; Returns: boolean }
      can_manage_profile: { Args: { target_user_id: string }; Returns: boolean }
      can_view_district: { Args: { p_district_id: string }; Returns: boolean }
      can_view_profile: { Args: { target_user_id: string }; Returns: boolean }
      claim_invitation_notifications: {
        Args: { p_batch_size?: number }
        Returns: {
          attempt_number: number
          invitation_request_id: string
          notification_id: string
          notification_type: string
          recipient_email: string
        }[]
      }
      create_district:
        | {
            Args: { p_description?: string; p_name: string }
            Returns: {
              code: string
              created_at: string
              description: string | null
              id: string
              name: string
              status: string
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "districts"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { p_code: string; p_description: string; p_name: string }
            Returns: {
              code: string
              created_at: string
              description: string | null
              id: string
              name: string
              status: string
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "districts"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      get_invitation_requests: {
        Args: { p_status?: string }
        Returns: {
          congregation_name: string
          date_of_birth: string
          decision_note: string
          district_id: string
          district_name: string
          email: string
          full_name: string
          invitation_type: string
          phone: string
          request_id: string
          request_status: string
          requested_at: string
          requested_congregation_id: string
          requested_role_id: string
          requested_role_name: string
          reviewed_at: string
        }[]
      }
      get_membership_transfer_area_reviews: {
        Args: { p_status?: string }
        Returns: {
          area_id: string
          area_membership_id: string
          area_name: string
          area_position: string
          from_congregation_name: string
          from_district_name: string
          member_name: string
          member_phone: string
          observations: string
          review_created_at: string
          review_id: string
          review_status: string
          reviewed_at: string
          reviewed_by: string
          reviewer_name: string
          to_congregation_name: string
          to_district_name: string
          transfer_date: string
          transfer_id: string
        }[]
      }
      get_membership_transfer_history: {
        Args: never
        Returns: {
          created_at: string
          from_congregation_id: string
          from_congregation_name: string
          from_district_id: string
          from_district_name: string
          member_name: string
          member_phone: string
          membership_id: string
          observations: string
          pending_area_reviews: number
          performed_by: string
          performed_by_name: string
          to_congregation_id: string
          to_congregation_name: string
          to_district_id: string
          to_district_name: string
          total_area_reviews: number
          transfer_id: string
        }[]
      }
      has_role: {
        Args: { requested_role: string; target_district?: string }
        Returns: boolean
      }
      is_area_coordinator: { Args: { p_area_id: string }; Returns: boolean }
      is_congregation_coordinator: {
        Args: { target_congregation: string }
        Returns: boolean
      }
      is_district_committee_member: {
        Args: { p_district_id: string }
        Returns: boolean
      }
      is_district_coordinator: {
        Args: { target_district: string }
        Returns: boolean
      }
      resolve_membership_transfer_area_review: {
        Args: {
          p_decision: string
          p_observations?: string
          p_review_id: string
        }
        Returns: string
      }
      review_invitation_request: {
        Args: {
          p_decision: string
          p_decision_note?: string
          p_request_id: string
        }
        Returns: Json
      }
      search_memberships_for_transfer: {
        Args: { p_search: string }
        Returns: {
          active_area_assignments: number
          congregation_id: string
          congregation_name: string
          district_id: string
          district_name: string
          full_name: string
          membership_id: string
          phone: string
        }[]
      }
      submit_invitation_request: {
        Args: {
          p_email: string
          p_full_name: string
          p_phone?: string
          p_token_hash: string
        }
        Returns: Json
      }
      submit_invitation_request_v2: {
        Args: {
          p_date_of_birth: string
          p_email: string
          p_full_name: string
          p_phone: string
          p_requested_congregation_id: string
          p_requested_role_id?: string
          p_token_hash: string
        }
        Returns: Json
      }
      transfer_membership: {
        Args: {
          p_membership_id: string
          p_observations?: string
          p_to_congregation_id: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
