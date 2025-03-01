import './globals.css';
import './styles.css';

export const metadata = {
  title: 'iWF Workflows',
  description: 'Search and view iWF workflow executions',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <div className="min-h-screen bg-gray-50">
          <main>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}