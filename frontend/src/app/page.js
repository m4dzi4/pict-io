"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import { getApiUrl } from "@/services/api";
import CreateRoom from "./components/CreateRoom";
import Statistics from "./components/Statistics";
import Leaderboard from "./components/Leaderboard";
import ActiveRooms from "./components/ActiveRooms"; // Add this import

export default function HomePage() {
    const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
    const [loggedInUser, setLoggedInUser] = useState(null);
    const [authMessage, setAuthMessage] = useState("");
    const router = useRouter();
    const apiUrl = getApiUrl();

    // Remove all room-related state and functions since they're now in ActiveRooms component
    // Remove: activeRooms, isLoadingRooms, joinRoomCode, fetchActiveRooms, etc.

    useEffect(() => {
        const storedToken = localStorage.getItem("jwtToken");
        if (storedToken) {
            try {
                const decodedToken = jwtDecode(storedToken);
                setLoggedInUser({
                    username: decodedToken.username,
                    userId: decodedToken.userId,
                });
            } catch (error) {
                console.error("Failed to decode token on homepage", error);
                localStorage.removeItem("jwtToken");
            }
        }

        // Listener for auth changes from other pages
        const handleAuthChange = () => {
            const currentToken = localStorage.getItem("jwtToken");
            if (currentToken) {
                try {
                    setLoggedInUser(jwtDecode(currentToken));
                } catch {
                    setLoggedInUser(null);
                }
            } else {
                setLoggedInUser(null);
            }
        };

        // Listener for opening create room modal from ActiveRooms component
        const handleOpenCreateRoomModal = () => {
            setShowCreateRoomModal(true);
        };

        window.addEventListener("authChange", handleAuthChange);
        window.addEventListener("openCreateRoomModal", handleOpenCreateRoomModal);
        
        return () => {
            window.removeEventListener("authChange", handleAuthChange);
            window.removeEventListener("openCreateRoomModal", handleOpenCreateRoomModal);
        };
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("jwtToken");
        setLoggedInUser(null);
        setAuthMessage("Logged out.");
        window.dispatchEvent(new CustomEvent("authChange"));
        router.push("/login");
    };

    return (
        <div>
            {authMessage && <div>{authMessage}</div>}
            
            <Statistics loggedInUser={loggedInUser} />
            
            <ActiveRooms loggedInUser={loggedInUser} />

            <Leaderboard loggedInUser={loggedInUser} />

            {showCreateRoomModal && (
                <CreateRoom 
                    loggedInUser={loggedInUser}
                    onClose={() => setShowCreateRoomModal(false)}
                />
            )}
        </div>
    );
}
