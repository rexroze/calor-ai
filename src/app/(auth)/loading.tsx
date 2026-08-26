import { AuthSkeleton } from "@/components/auth/auth-skeleton";

export default function AuthLoading() {
  return (
    <main className="flex w-full flex-col items-center justify-center">
      <AuthSkeleton />
    </main>
  );
}
