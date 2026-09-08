/*
 * Manual Supabase typing for the Milestone 1 frontend.
 * Replace with `npm run supabase:types` when a linked schema is available.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type PropertyStatus = 'draft' | 'published' | 'archived'
export type PropertyType =
  | 'house'
  | 'apartment'
  | 'townhouse'
  | 'land'
  | 'commercial'
export type ListingType = 'sale' | 'rent'
export type ProfileRole = 'admin' | 'agent'
export type EnquiryStatus = 'new' | 'contacted' | 'qualified' | 'closed'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          phone: string | null
          avatar_url: string | null
          role: ProfileRole
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          email: string
          phone?: string | null
          avatar_url?: string | null
          role?: ProfileRole
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          full_name?: string
          email?: string
          phone?: string | null
          avatar_url?: string | null
          role?: ProfileRole
          active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          id: string
          slug: string
          title: string
          description: string
          excerpt: string | null
          property_type: PropertyType
          listing_type: ListingType
          status: PropertyStatus
          price: number
          currency: string
          address_line_1: string
          address_line_2: string | null
          city: string
          region: string
          postal_code: string | null
          country: string
          latitude: number | null
          longitude: number | null
          bedrooms: number
          bathrooms: number
          parking_spaces: number
          floor_area: number | null
          lot_size: number | null
          year_built: number | null
          featured: boolean
          amenities: string[]
          agent_id: string | null
          created_by: string | null
          published_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          title: string
          description: string
          excerpt?: string | null
          property_type: PropertyType
          listing_type: ListingType
          status?: PropertyStatus
          price: number
          currency?: string
          address_line_1: string
          address_line_2?: string | null
          city: string
          region: string
          postal_code?: string | null
          country?: string
          latitude?: number | null
          longitude?: number | null
          bedrooms?: number
          bathrooms?: number
          parking_spaces?: number
          floor_area?: number | null
          lot_size?: number | null
          year_built?: number | null
          featured?: boolean
          amenities?: string[]
          agent_id?: string | null
          created_by?: string | null
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['properties']['Insert']>
        Relationships: []
      }
      property_images: {
        Row: {
          id: string
          property_id: string
          storage_path: string
          alt_text: string | null
          sort_order: number
          is_primary: boolean
          width: number | null
          height: number | null
          created_at: string
        }
        Insert: {
          id?: string
          property_id: string
          storage_path: string
          alt_text?: string | null
          sort_order?: number
          is_primary?: boolean
          width?: number | null
          height?: number | null
          created_at?: string
        }
        Update: {
          alt_text?: string | null
          sort_order?: number
          is_primary?: boolean
        }
        Relationships: []
      }
      enquiries: {
        Row: {
          id: string
          property_id: string | null
          name: string
          email: string
          phone: string | null
          message: string
          status: EnquiryStatus
          assigned_to: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          property_id?: string | null
          name: string
          email: string
          phone?: string | null
          message: string
          status?: EnquiryStatus
          assigned_to?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: EnquiryStatus
          assigned_to?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: {
      search_properties: {
        Args: {
          p_query?: string | null
          p_listing_type?: ListingType | null
          p_property_type?: PropertyType | null
          p_city?: string | null
          p_min_price?: number | null
          p_max_price?: number | null
          p_min_bedrooms?: number | null
          p_min_bathrooms?: number | null
          p_featured?: boolean | null
          p_page?: number
          p_page_size?: number
        }
        Returns: PropertySearchRow[]
      }
      publish_property: {
        Args: { p_property_id: string }
        Returns: Database['public']['Tables']['properties']['Row']
      }
      archive_property: {
        Args: { p_property_id: string }
        Returns: Database['public']['Tables']['properties']['Row']
      }
      restore_property: {
        Args: { p_property_id: string }
        Returns: Database['public']['Tables']['properties']['Row']
      }
      reserve_property_image: {
        Args: {
          p_property_id: string
          p_filename: string
          p_content_type: string
        }
        Returns: Json
      }
      set_primary_property_image: {
        Args: { p_property_id: string; p_image_id: string }
        Returns: undefined
      }
      reorder_property_images: {
        Args: { p_property_id: string; p_image_ids: string[] }
        Returns: undefined
      }
    }
    Enums: {
      property_status: PropertyStatus
      property_type: PropertyType
      listing_type: ListingType
      profile_role: ProfileRole
      enquiry_status: EnquiryStatus
    }
    CompositeTypes: Record<never, never>
  }
}

export interface PropertySearchRow {
  id: string
  slug: string
  title: string
  excerpt: string | null
  property_type: PropertyType
  listing_type: ListingType
  price: number
  currency: string
  city: string
  region: string
  bedrooms: number
  bathrooms: number
  parking_spaces: number
  floor_area: number | null
  featured: boolean
  published_at: string | null
  primary_image_path: string | null
  primary_image_alt: string | null
  total_count: number
}
