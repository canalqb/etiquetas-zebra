import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Info, AlertTriangle, Loader2, Copy, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * LLM UI TEMPLATE PRO - Design System & Component Reference
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * This page serves as a comprehensive reference for LLMs to understand:
 * 1. Design tokens (colors, spacing, typography, shadows)
 * 2. Component patterns and their usage
 * 3. State variations (hover, active, disabled, loading)
 * 4. Accessibility best practices
 * 5. Responsive behavior
 * 
 * DESIGN PHILOSOPHY:
 * - Semantic color system with foreground/background pairs
 * - Consistent spacing scale (4px base unit)
 * - Smooth transitions (200-300ms) for all interactive elements
 * - Clear visual hierarchy through typography and color contrast
 * - Accessible by default (WCAG 2.1 AA)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export default function Home() {
  const [showPassword, setShowPassword] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <span className="text-sm font-bold text-primary-foreground">UI</span>
            </div>
            <h1 className="text-lg font-semibold">LLM UI Template Pro</h1>
          </div>
          <Badge variant="outline" className="text-xs">v1.0.0</Badge>
        </div>
      </header>

      <main className="container py-12 space-y-16">
        {/* Introduction Section */}
        <section className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Design System Reference</h2>
            <p className="text-lg text-muted-foreground">
              A comprehensive guide for LLMs to generate consistent, accessible, and beautiful UI components.
            </p>
          </div>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>How to use this template</AlertTitle>
            <AlertDescription>
              This page demonstrates all available components, states, and design patterns. 
              Use it as a reference when generating new UI elements to ensure consistency.
            </AlertDescription>
          </Alert>
        </section>

        {/* Color System */}
        <section className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">Color System</h3>
            <p className="text-muted-foreground">
              Semantic color tokens that maintain contrast and accessibility across light and dark themes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Primary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Primary</CardTitle>
                <CardDescription>Main action color</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-12 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-medium">
                  Primary
                </div>
                <code className="text-xs bg-muted p-2 rounded block text-center">
                  bg-primary text-primary-foreground
                </code>
              </CardContent>
            </Card>

            {/* Secondary Option (Exemplo) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Secondary</CardTitle>
                <CardDescription>Alternative action color</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-12 rounded-lg bg-secondary flex items-center justify-center text-secondary-foreground font-medium">
                  Secondary
                </div>
                <code className="text-xs bg-muted p-2 rounded block text-center">
                  bg-secondary text-secondary-foreground
                </code>
              </CardContent>
            </Card>

            {/* Accent */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Accent</CardTitle>
                <CardDescription>Highlight and emphasis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-12 rounded-lg bg-accent flex items-center justify-center text-accent-foreground font-medium">
                  Accent
                </div>
                <code className="text-xs bg-muted p-2 rounded block text-center">
                  bg-accent text-accent-foreground
                </code>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Buttons */}
        <section className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">Buttons</h3>
            <p className="text-muted-foreground">
              Button variants with consistent sizing, spacing, and interaction states.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Button Variants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-3">
                <Button>Default Button</Button>
                <Button variant="secondary">Secondary Button</Button>
                <Button variant="outline">Outline Button</Button>
                <Button variant="ghost">Ghost Button</Button>
                <Button variant="destructive">Delete</Button>
                <Button disabled>Disabled</Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-muted-foreground">
        <p className="text-sm">LLM UI Template Pro - v1.0.0 - Project Reference Only</p>
      </footer>
    </div>
  );
}
