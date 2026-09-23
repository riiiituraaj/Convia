"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Lock, Mail, User } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

const registerSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const registerMutation = useMutation({
    mutationFn: (data: RegisterForm) =>
      api.register(data.email, data.password, data.full_name),
    onSuccess: () => {
      toast({ title: "Account created", description: "Welcome to CONVIA." });
      router.push("/life");
    },
    onError: (error) => {
      toast({
        title: "Registration failed",
        description: error instanceof Error ? error.message : "Could not create account.",
        tone: "danger",
      });
    },
  });

  const onSubmit = (data: RegisterForm) => registerMutation.mutate(data);

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <Logo height={32} />
          </Link>
          <p className="mt-2 text-sm text-ink-secondary">
            Create your account to start tracking commitments.
          </p>
        </div>

        <div className="bg-surface rounded-xl border border-line shadow-card p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-ink">Create your account</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Free forever. No credit card required.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-ink mb-1.5">
                Full name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
                <Input
                  id="full_name"
                  type="text"
                  placeholder="Alex Mercer"
                  className="pl-10"
                  invalid={!!errors.full_name}
                  {...register("full_name")}
                />
              </div>
              {errors.full_name && (
                <p className="mt-1 text-xs text-danger">{errors.full_name.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  className="pl-10"
                  invalid={!!errors.email}
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-danger">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  className="pl-10 pr-10"
                  invalid={!!errors.password}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-danger">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              loading={registerMutation.isPending}
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-ink-secondary">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand hover:text-brand-deep">
              Sign in
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-ink-muted">
          Or{" "}
          <Link href="/life" className="text-brand hover:text-brand-deep">
            continue as guest
          </Link>{" "}
          — no account required.
        </p>
      </div>
    </div>
  );
}
