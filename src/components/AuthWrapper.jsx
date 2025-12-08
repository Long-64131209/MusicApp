"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AuthScreen from "./AuthScreen";

const AuthWrapper = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Show loading state
  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-neutral-100 dark:bg-black">
        <div className="text-emerald-500 text-xs font-mono tracking-wider uppercase">
          INITIALIZING_AUTH_SYSTEM...
        </div>
      </div>
    );
  }

  // If user is authenticated, render children
  if (session) {
    return <>{children}</>;
  }

  // If not authenticated, show auth screen
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-neutral-100 dark:bg-black relative overflow-hidden">
      {/* Background effect */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
      </div>

      {/* Lock screen message */}
      <div className="z-10 text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold font-mono text-neutral-900 dark:text-white mb-2">
            ACCESS_DENIED
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-xs font-mono tracking-wider">
            :: AUTHENTICATION_REQUIRED ::
          </p>
        </div>
      </div>

      {/* Auth Screen */}
      <AuthScreen />
    </div>
  );
};

export default AuthWrapper;
