export default function Layout({ children }) {
    return (
        <html lang="en">
            <body>
                <header>
                    <h1>Welcome to Pict-io</h1>
                </header>
                    <main>{children}</main>
                <footer>
                    <p>&copy; 2025 Pict-io. All rights reserved.</p>
                </footer>
            </body>
        </html>
    );
}