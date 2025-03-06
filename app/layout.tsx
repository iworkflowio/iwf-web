import './globals.css';
import './styles.css';
import { ConfigProvider } from './components/ConfigContext';

export const metadata = {
  title: 'iWF Workflows',
  description: 'Search and view iWF workflow executions',
  icons: {
    icon: '/iwf-logo.svg',
  },
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
        <link rel="icon" href="/iwf-logo.svg" type="image/svg+xml" />
      </head>
      <body>
        <ConfigProvider>
          <div className="min-h-screen bg-gray-50">
            <main>
              {children}
            </main>
          </div>
        </ConfigProvider>
      </body>
    </html>
  );
}