import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");
  return (
    <Suspense>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
