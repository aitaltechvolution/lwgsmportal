export type Role = "student" | "lecturer" | "admin";

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  title: string | null;
  email: string;
  phone: string | null;
  country: string | null;
  nationality: string | null;
  language_pref: string;
  avatar_url: string | null;
  created_at: string;
}
