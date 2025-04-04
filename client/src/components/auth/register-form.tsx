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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GlowCard } from "@/components/ui/glow-card";

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  fullName: z.string().min(2, "Full name is required"),
  // Role is always client for self-registration
  role: z.literal("client"),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  onSuccess: () => void;
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const { registerMutation } = useAuth();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      fullName: "",
      role: "client",
    },
  });

  async function onSubmit(data: RegisterFormValues) {
    await registerMutation.mutateAsync(data);
    onSuccess();
  }

  return (
    <GlowCard className="p-6">
      <h2 className="text-3xl font-alex text-secondary text-center mb-6">Join SoulSeer</h2>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-light font-playfair">Full Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter your full name"
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
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-light font-playfair">Username</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Choose a unique username"
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
                    placeholder="Create a secure password"
                    {...field}
                    className="bg-primary-light/30 border-accent-gold/30 font-playfair text-gray-800"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Hidden field for role which is always client */}
          <input type="hidden" {...form.register("role")} value="client" />
          
          {/* Information about reader registration */}
          <div className="rounded-md bg-purple-50 p-3 border border-purple-100">
            <p className="text-sm text-purple-800 font-playfair">
              <strong>Note:</strong> This registration is for clients only. 
              If you are a psychic reader interested in offering services on SoulSeer, 
              please contact our team for the application process.
            </p>
          </div>

          <div className="pt-4">
            <CelestialButton
              type="submit"
              variant="default"
              className="w-full"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </CelestialButton>
          </div>
        </form>
      </Form>
    </GlowCard>
  );
}