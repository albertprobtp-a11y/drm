import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth, ApiError } from "../../hooks/useAuth";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import { Alert } from "../../components/ui/Alert";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Connexion impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-6">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-8 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
          <span className="text-[15px] font-semibold tracking-tight">SecureView</span>
        </div>
        <h1 className="mb-1 text-lg font-semibold text-[var(--color-text)]">Connexion</h1>
        <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
          Accédez à votre espace de partage sécurisé.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <Input
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            name="password"
            label="Mot de passe"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" loading={loading} className="mt-2 w-full">
            Se connecter
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-[var(--color-text-secondary)]">
          Pas encore de compte ?{" "}
          <Link to="/register" className="text-[var(--color-accent)] hover:text-[var(--color-accent-strong)]">
            Créer un compte
          </Link>
        </p>
      </Card>
    </div>
  );
}
