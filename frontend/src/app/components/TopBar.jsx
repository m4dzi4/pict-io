// filepath: c:\Users\bluee\Documents\PWR\Sem6\pict-io-miki\pict-io\frontend\src\app\components\topbar.jsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { jwtDecode } from "jwt-decode";
import styles from "./TopBar.module.css";

export default function TopBar() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [jwtUser, setJwtUser] = useState(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem("jwtToken");
            if (token && !session) {
                try {
                    const decoded = jwtDecode(token);
                    setJwtUser(decoded);
                } catch {
                    localStorage.removeItem("jwtToken");
                    setJwtUser(null);
                }
            } else if (session) {
                setJwtUser(null);
            }

            const handler = () => {
                const token = localStorage.getItem("jwtToken");
                if (token && !session) {
                    try {
                        setJwtUser(jwtDecode(token));
                    } catch {
                        setJwtUser(null);
                    }
                } else {
                    setJwtUser(null);
                }
            };

            window.addEventListener("authChange", handler);
            return () => window.removeEventListener("authChange", handler);
        }
    }, [session]);

    const currentUser = session?.user || jwtUser;
    const isLoggedIn = !!(session || jwtUser);

    const handleSignOut = async () => {
        try {
            localStorage.removeItem("jwtToken");
            setJwtUser(null);

            if (session) {
                await signOut({
                    callbackUrl: "/login",
                    redirect: false,
                });
            }

            window.dispatchEvent(new CustomEvent("authChange"));
            router.push("/login");
            router.refresh();
        } catch (error) {
            console.error("Logout error:", error);
            localStorage.clear();
            router.push("/login");
        }
    };

    if (status === "loading") {
        return (
            <nav className={styles.nav}>
                <div className={styles.loadingContainer}>
                    Loading...
                </div>
            </nav>
        );
    }

    return (
        <nav className={styles.nav}>
            <div className={styles.container}>
                <div className={styles.leftSide}></div>
                
                <div className={styles.logoContainer}>
                    <Link href="/" className={styles.logo}>
                        Pict-io
                    </Link>
                </div>

                <div className={styles.authSection}>
                    {isLoggedIn ? (
                        <>
                            <span className={styles.welcomeText}>
                                Welcome, <strong>{currentUser?.username}</strong>
                            </span>
                            <button onClick={handleSignOut} className={styles.signOutButton}>
                                Sign Out
                            </button>
                        </>
                    ) : (
                        <>
                            <Link href="/login" className={styles.loginButton}>
                                Log in
                            </Link>
                            <Link href="/register" className={styles.signUpButton}>
                                Sign up
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
}
