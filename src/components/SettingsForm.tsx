"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Camera, Link2, Shuffle, Trash2 } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Button, ErrorText, Hint, Input, Label, TextArea } from "@/components/ui";
import { useSignOut } from "@/components/Sidebar";
import { BIO_MAX_LENGTH, DISPLAY_NAME_MAX_LENGTH } from "@/lib/validation";

interface SettingsFormProps {
  initial: { username: string; displayName: string; bio: string; profileImage: string | null };
}

/** Downscale an image in the browser so uploads stay tiny (max 256px JPEG). */
async function resizeImage(file: File, size = 256): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not process image"))), "image/jpeg", 0.86);
  });
}

export function SettingsForm({ initial }: SettingsFormProps) {
  const router = useRouter();
  const { signOut } = useSignOut();
  const [username, setUsername] = useState(initial.username);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [bio, setBio] = useState(initial.bio);
  const [profileImage, setProfileImage] = useState(initial.profileImage);
  const [urlMode, setUrlMode] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const body: Record<string, unknown> = { username, displayName, bio };
      if (urlMode && urlValue.trim()) body.profileImage = urlValue.trim();
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string; user?: { username: string; profileImage: string | null } };
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      setMessage("Saved.");
      if (data.user?.profileImage !== undefined) setProfileImage(data.user.profileImage);
      setUrlMode(false);
      setUrlValue("");
      router.refresh();
      if (data.user && data.user.username !== initial.username) {
        router.push(`/u/${data.user.username}`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function upload(file: File) {
    setAvatarBusy(true);
    setError(null);
    try {
      const blob = await resizeImage(file);
      const form = new FormData();
      form.append("file", blob, "avatar.jpg");
      const res = await fetch("/api/profile/avatar", { method: "POST", body: form });
      const data = (await res.json()) as { error?: string; profileImage?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setProfileImage(data.profileImage ?? null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAvatarBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function shuffle() {
    setAvatarBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/avatar/shuffle", { method: "POST" });
      const data = (await res.json()) as { error?: string; profileImage?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not shuffle");
      setProfileImage(data.profileImage ?? null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeUpload() {
    setAvatarBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      const data = (await res.json()) as { error?: string; profileImage?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not remove");
      setProfileImage(data.profileImage ?? null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function changePin(e: React.FormEvent) {
    e.preventDefault();
    setPinBusy(true);
    setPinError(null);
    setPinMessage(null);
    try {
      const res = await fetch("/api/profile/pin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not change PIN");
      setPinMessage("PIN updated. Other devices have been signed out.");
      setCurrentPin("");
      setNewPin("");
    } catch (err) {
      setPinError((err as Error).message);
    } finally {
      setPinBusy(false);
    }
  }

  return (
    <div className="space-y-10 px-4 py-6 md:px-5">
      <form onSubmit={save} className="space-y-5">
        <div>
          <Label>Profile picture</Label>
          <div className="flex items-center gap-4">
            <Avatar src={profileImage} name={displayName || username} size={80} />
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                }}
              />
              <Button type="button" size="sm" variant="secondary" loading={avatarBusy} onClick={() => fileRef.current?.click()}>
                <Camera size={15} /> Upload
              </Button>
              <Button type="button" size="sm" variant="secondary" disabled={avatarBusy} onClick={shuffle}>
                <Shuffle size={15} /> Shuffle
              </Button>
              <Button type="button" size="sm" variant="secondary" disabled={avatarBusy} onClick={() => setUrlMode((v) => !v)}>
                <Link2 size={15} /> Use URL
              </Button>
              {profileImage?.startsWith("/api/avatars/u/") && (
                <Button type="button" size="sm" variant="ghost" disabled={avatarBusy} onClick={removeUpload}>
                  <Trash2 size={15} /> Remove upload
                </Button>
              )}
            </div>
          </div>
          {urlMode && (
            <div className="mt-3">
              <Input value={urlValue} onChange={(e) => setUrlValue(e.target.value)} placeholder="https://example.com/me.jpg" />
              <Hint>Must be an https:// image. Saved when you press Save changes.</Hint>
            </div>
          )}
          <Hint>Uploads are resized to 256px in your browser. Shuffle picks a fresh generated avatar.</Hint>
        </div>

        <div>
          <Label htmlFor="displayName">Display name</Label>
          <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value.slice(0, DISPLAY_NAME_MAX_LENGTH))} required />
        </div>

        <div>
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={username}
            autoCapitalize="none"
            spellCheck={false}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))}
            required
          />
          <Hint>Changing this changes your profile link and what you sign in with.</Hint>
        </div>

        <div>
          <Label htmlFor="bio">Bio</Label>
          <TextArea id="bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX_LENGTH))} placeholder="A little about you (optional)" />
          <Hint className="text-right tabular-nums">
            {bio.length}/{BIO_MAX_LENGTH}
          </Hint>
        </div>

        <ErrorText>{error}</ErrorText>
        {message && <p className="text-sm text-success">{message}</p>}

        <div className="flex items-center gap-3">
          <Button type="submit" loading={saving}>
            Save changes
          </Button>
        </div>
      </form>

      <form onSubmit={changePin} className="space-y-4 border-t border-border pt-8">
        <h2 className="font-semibold">Change PIN</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="currentPin">Current PIN</Label>
            <Input
              id="currentPin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="tracking-[0.4em]"
            />
          </div>
          <div>
            <Label htmlFor="newPin">New PIN</Label>
            <Input
              id="newPin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="tracking-[0.4em]"
            />
          </div>
        </div>
        <ErrorText>{pinError}</ErrorText>
        {pinMessage && <p className="text-sm text-success">{pinMessage}</p>}
        <Button type="submit" variant="secondary" loading={pinBusy} disabled={currentPin.length !== 4 || newPin.length !== 4}>
          Update PIN
        </Button>
      </form>

      <div className="border-t border-border pt-8">
        <h2 className="font-semibold">Session</h2>
        <p className="mt-1 text-sm text-fg-muted">Sign out of this device. Your posts, likes and score stay put.</p>
        <Button type="button" variant="secondary" className="mt-3" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
