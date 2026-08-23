import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard");
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo("Account created. Check your email to confirm, then sign in.");
        setMode("signin");
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="header">
        <div className="logo">
          <span className="dot" />
          TRADELENS
        </div>
        <div className="tag">AI CHART JOURNAL</div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>{mode === "signin" ? "Sign in" : "Create account"}</h2>

        {error && <div className="error-box">{error}</div>}
        {info && <div className="error-box" style={{ color: "var(--green)", borderColor: "rgba(74,222,128,0.3)", background: "rgba(74,222,128,0.08)" }}>{info}</div>}

        <form onSubmit={submit}>
          <input
            className="field"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="field"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <button className="btn" type="submit" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 14, textAlign: "center" }}>
          {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setInfo(null);
            }}
            style={{ color: "var(--amber)" }}
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </a>
        </p>
      </div>
    </div>
  );
}
