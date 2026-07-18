import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/contexts/ToastContext";

interface Props {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  lang: "en" | "fr";
  onUploaded: (url: string) => void;
  size?: "md" | "lg";
}

const MAX_SIZE_MB = 3;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

/**
 * Click-to-upload avatar: clicking the avatar circle opens a file picker,
 * the chosen image is uploaded to the public "avatars" bucket (one file
 * per user, overwritten on re-upload), and profiles.avatar_url is updated.
 * Falls back to an initials circle whenever there's no avatar_url yet —
 * the initials circle itself doubles as the upload trigger.
 */
export default function AvatarUpload({ userId, fullName, avatarUrl, lang, onUploaded, size = "lg" }: Props) {
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localUrl, setLocalUrl] = useState<string | null>(avatarUrl);

  const dims = size === "lg" ? "w-16 h-16 text-2xl" : "w-11 h-11 text-base";

  const onPick = () => inputRef.current?.click();

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ACCEPTED.includes(file.type)) {
      showToast("error", lang === "en" ? "Please choose a JPG, PNG, or WEBP image." : "Choisissez une image JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      showToast("error", lang === "en" ? `Image must be under ${MAX_SIZE_MB}MB.` : `L'image doit faire moins de ${MAX_SIZE_MB} Mo.`);
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { cacheControl: "3600", upsert: true });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      // Cache-bust so the new image shows immediately even though the path
      // (and therefore the previously-cached URL) is identical on re-upload.
      const bustedUrl = `${urlData.publicUrl}?v=${Date.now()}`;

      const { error: dbErr } = await supabase.from("profiles").update({ avatar_url: bustedUrl }).eq("id", userId);
      if (dbErr) throw dbErr;

      setLocalUrl(bustedUrl);
      onUploaded(bustedUrl);
      showToast("success", lang === "en" ? "Profile photo updated!" : "Photo de profil mise à jour !");
    } catch {
      showToast("error", lang === "en" ? "Could not upload your photo. Please try again." : "Échec du téléversement. Réessayez.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onPick}
      disabled={uploading}
      className={`relative ${dims} rounded-2xl flex-shrink-0 group focus:outline-none focus:ring-2 focus:ring-amber-400/50 rounded-2xl`}
      title={lang === "en" ? "Change photo" : "Changer la photo"}
    >
      {localUrl ? (
        <img src={localUrl} alt={fullName} className={`${dims} rounded-2xl object-cover`} />
      ) : (
        <div className={`${dims} rounded-2xl bg-gradient-to-br from-brand to-amber-600 flex items-center justify-center text-white font-black select-none`}>
          {fullName.charAt(0)?.toUpperCase() ?? "?"}
        </div>
      )}
      <div className={`absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/40 transition-colors duration-150 flex items-center justify-center`}>
        {uploading ? (
          <Loader2 className="w-5 h-5 text-white animate-spin" strokeWidth={2.5} />
        ) : (
          <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150" strokeWidth={2} />
        )}
      </div>
      <input ref={inputRef} type="file" accept={ACCEPTED.join(",")} onChange={onFileSelected} className="hidden" />
    </button>
  );
}
