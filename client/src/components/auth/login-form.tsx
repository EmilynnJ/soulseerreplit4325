import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { CelestialButton } from "@/components/ui/celestial-button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { GlowCard } from "@/components/ui/glow-card";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onSuccess: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { loginMutation } = useAuth();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: LoginFormValues) {
    await loginMutation.mutateAsync(data);
    onSuccess();
  }

  return (
    <GlowCard className="p-6">
      <h2 className="text-3xl font-alex text-secondary text-center mb-6">Welcome Back</h2>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-light font-playfair">Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="Enter your email address"
                    {...field}
                    className="bg-primary-light/30 border-accent-gold/30 font-playfair text-gray-800"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-light font-playfair">Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Enter your password"
                    {...field}
                    className="bg-primary-light/30 border-accent-gold/30 font-playfair text-gray-800"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="pt-4">
            <CelestialButton
              type="submit"
              variant="primary"
              className="w-full"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                "Login"
              )}
            </CelestialButton>
          </div>
        </form>
      </Form>
    </GlowCard>
  );
}
