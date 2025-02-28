import './globals.css';

export const metadata = {
  title: 'iWF Workflow Search',
  description: 'Search and view workflow executions',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-gray-50">
          <header className="bg-blue-600 text-white py-4">
            <div className="container mx-auto px-4">
              <h1 className="text-xl font-bold">iWF Web</h1>
            </div>
          </header>
          <main>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}