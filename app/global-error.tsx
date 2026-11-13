"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Georgia, serif", margin: "2rem" }}>
        <main>
          <h1>This page could not be displayed</h1>
          <p>No recall text was filled in.</p>
          <button type="button" onClick={() => reset()}>Try again</button>
        </main>
        <footer>
          <p>Powered by <a href="https://codyza.com">Codyza</a></p>
        </footer>
      </body>
    </html>
  );
}
