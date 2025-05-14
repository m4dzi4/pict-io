import TopBar from './components/topbar'; // Import the TopBar
import './globals.css'; // Assuming you have global styles

// If using NextAuth, you'd wrap children with SessionProvider here
// import { SessionProvider } from "next-auth/react";

export default function RootLayout({ children /*, session */ }) { // NextAuth passes session to server component layouts
  return (
    // <SessionProvider session={session}> {/* For NextAuth */}
      <html lang="en">
        <head>
            {/* Recommended to add title and meta tags here or in specific page.js files */}
            <title>Pict-IO Game</title>
            <meta name="description" content="Real-time drawing and guessing game." />
        </head>
        <body>
          <TopBar /> {/* Add the TopBar here */}
          <main className="container mx-auto px-4 py-6 mt-4">
            {children}
          </main>
          <footer className="text-center py-4 mt-8 border-t">
            <p>&copy; {new Date().getFullYear()} Pict-io. All rights reserved.</p>
          </footer>
        </body>
      </html>
    // </SessionProvider>
  );
}