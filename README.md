# iWF Web - Web UI for Indeed Workflow Framework

## Overview

iWF Web is a web-based user interface for [iWF (Indeed Workflow Framework)](https://github.com/indeedeng/iwf), an open-source framework that simplifies building highly reliable applications with Temporal. This UI allows users to search, view, and monitor workflow executions by connecting directly to a Temporal server.

## About iWF

[iWF (Indeed Workflow Framework)](https://github.com/indeedeng/iwf) is an innovative framework built on top of Temporal that simplifies building highly reliable applications. Key features of iWF include:

- **Simplified API**: iWF provides an intuitive API that abstracts away many of the complexities of working directly with Temporal.
- **State Management**: Built-in state management for your workflow applications.
- **Flexibility**: Support for various programming models and custom extensions.
- **Reliability**: Leverages Temporal's durability and fault-tolerance capabilities.

While iWF Web serves as a companion UI to the iWF framework, it connects directly to a Temporal server to search and display workflow executions.

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
- Access to a Temporal server

## Project Structure

- `/app` - Frontend React application (Next.js)
  - `/app/page.tsx` - Main application component
  - `/app/api/v1/workflow/search` - API endpoint for workflow search
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

The application is designed to connect directly to a Temporal server. By default, it will attempt to connect to a Temporal server at `localhost:7233` with the `default` namespace. If the connection fails, it falls back to using mock data.

You can configure the Temporal connection by:

1. Creating or editing `.env.local` in the project root:
   ```
   # Temporal Configuration
   TEMPORAL_HOST_PORT=localhost:7233
   TEMPORAL_NAMESPACE=default
   ```

2. Or by modifying the configuration directly in `/app/api/v1/workflow/search/route.ts`:
   ```typescript
   // Configuration for Temporal connection
   const temporalConfig = {
     // Default connection parameters, can be overridden with environment variables
     hostPort: process.env.TEMPORAL_HOST_PORT || 'localhost:7233',
     namespace: process.env.TEMPORAL_NAMESPACE || 'default',
   };
   ```

## Connecting to Temporal

This UI is designed to connect directly to a Temporal server to search and display workflow executions.

To connect to your Temporal instance:

1. Ensure your Temporal server is running
2. Update the Temporal connection parameters in `.env.local` or directly in the code
3. Restart the application to apply the changes

### Setting up Temporal Server

If you don't have a Temporal server running yet, follow these steps:

1. Set up a Temporal server using the official Docker Compose setup:
   ```
   git clone https://github.com/temporalio/docker-compose.git
   cd docker-compose
   docker-compose up
   ```

2. Or install the Temporal CLI and run a local server:
   ```
   # Install Temporal CLI
   curl -sSf https://temporal.download/cli.sh | sh
   
   # Start a local server
   temporal server start-dev
   ```

3. Once your Temporal server is running, update the connection parameters in this application if needed
4. Start the application to begin querying workflow executions from your Temporal server

### Using with iWF

This UI is optimized for workflows created using [iWF (Indeed Workflow Framework)](https://github.com/indeedeng/iwf). It specifically looks for the `IwfWorkflowType` search attribute that iWF automatically adds to workflows.

When displaying workflow executions:
1. For iWF workflows, it uses the `IwfWorkflowType` search attribute value to display the workflow type
2. For non-iWF workflows, it falls back to using Temporal's native workflow type

The search functionality also includes the `IwfWorkflowType` attribute in queries, making it easier to find workflows by their iWF workflow type name.

## Development Tasks

### Customizing the UI

The UI is built with React and uses Tailwind CSS for styling. You can customize the appearance by modifying the CSS classes in `/app/page.tsx` or by updating the Tailwind configuration in `tailwind.config.js`.

### Updating API Definitions

If you need to update the API schema:

1. Update the API schema in `/api-schema/api.yaml`
2. Run `make gen` to regenerate the TypeScript client

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the Apache License 2.0 - see the LICENSE file for details.