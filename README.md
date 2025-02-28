# iWF Web - Web UI for Indeed Workflow Framework

## Overview

iWF Web is a web-based user interface for [iWF (Indeed Workflow Framework)](https://github.com/indeedeng/iwf), an open-source framework that simplifies building highly reliable applications with Temporal. This UI allows users to search, view, and monitor workflow executions from the iWF API.

## About iWF

[iWF (Indeed Workflow Framework)](https://github.com/indeedeng/iwf) is an innovative framework built on top of Temporal that simplifies building highly reliable applications. Key features of iWF include:

- **Simplified API**: iWF provides an intuitive API that abstracts away many of the complexities of working directly with Temporal.
- **State Management**: Built-in state management for your workflow applications.
- **Flexibility**: Support for various programming models and custom extensions.
- **Reliability**: Leverages Temporal's durability and fault-tolerance capabilities.

The iWF Web UI connects to the iWF API to provide a user-friendly interface for searching, viewing, and monitoring workflow executions.

## Features

- Search workflow executions by various criteria
- Display workflow executions in a customizable table
- View detailed workflow information, including status, type, IDs, and timestamps
- Support for custom search attributes
- Timezone selection for timestamp display
- Customizable column visibility and ordering
- Responsive UI for desktop and mobile

## Prerequisites

- Node.js (v16 or later)
- npm or yarn
- [iWF API](https://github.com/indeedeng/iwf) server (for production use)

## Project Structure

- `/app` - Frontend React application (Next.js)
  - `/app/page.tsx` - Main application component
  - `/app/api/v1/workflow/search` - Mock API endpoint for workflow search
- `/api-schema` - API schema definitions
- `/ts-api` - TypeScript API client generated from OpenAPI specs

## Getting Started

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/iwf-web.git
   cd iwf-web
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Generate TypeScript API client (optional, requires Java):
   ```
   make gen
   ```
   This uses OpenAPI Generator to create TypeScript clients from the API schema.

### Development

Start the development server:

```
npm run dev
```

The application will be available at http://localhost:3000.

### Production Build

Build the application for production:

```
npm run build
```

Start the production server:

```
npm start
```

## Configuration

By default, the application uses a mock API endpoint for demonstration purposes. To connect to a real iWF API instance, you'll need to modify the API endpoint configuration in `/app/page.tsx`. Look for the `fetchWorkflows` function and update the API URL.

```typescript
// Find this section in page.tsx
const fetchWorkflows = async (searchQuery: string = '') => {
  try {
    setLoading(true);
    setError('');
    
    // Replace this URL with your iWF API endpoint
    const response = await fetch('/api/v1/workflow/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: searchQuery }),
    });
    
    // ...rest of the function
  }
};
```

## Connecting to iWF

This UI is designed to work with [iWF (Indeed Workflow Framework)](https://github.com/indeedeng/iwf).

To connect this UI to your iWF instance:

1. Ensure your iWF API server is running
2. Update the API endpoint in the application configuration as described above
3. Make sure your iWF server has CORS configured correctly to accept requests from the UI's domain

### Setting up iWF

If you don't have an iWF server running yet, follow these steps:

1. Set up a Temporal server (follow instructions at [Temporal documentation](https://docs.temporal.io/))
2. Clone the iWF repository:
   ```
   git clone https://github.com/indeedeng/iwf.git
   ```
3. Follow the setup instructions in the iWF repository's README to get the server running
4. Connect this web UI to your iWF instance using the configuration instructions above

## Development Tasks

### Customizing the UI

The UI is built with React and uses Tailwind CSS for styling. You can customize the appearance by modifying the CSS classes in `/app/page.tsx` or by updating the Tailwind configuration in `tailwind.config.js`.

### Updating API Definitions

If the iWF API changes, you'll need to update the API schema and regenerate the TypeScript client:

1. Update the API schema in `/api-schema/api.yaml`
2. Run `make gen` to regenerate the TypeScript client

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the Apache License 2.0 - see the LICENSE file for details.