# iWF Web - Web UI for Indeed Workflow Framework

## Overview

iWF Web is a powerful web-based user interface for [iWF (Indeed Workflow Framework)](https://github.com/indeedeng/iwf), an open-source framework that simplifies building highly reliable applications with Temporal. This UI allows users to search, view, and monitor workflow executions by connecting directly to a Temporal server.

### Demo Video

Watch a walkthrough of iWF WebUI features:

[![iWF WebUI Demo](https://img.youtube.com/vi/nMg_L2UskBY/0.jpg)](https://www.youtube.com/watch?v=nMg_L2UskBY)

## About iWF

### What Makes iWF Unique
* Workflow-As-Code uses native code to define everything: branching, looping, parallel threads, variables, schema etc.
* Simplified Architecture: iWF applications are all REST based micro-services which are easy to deploy, monitor, scale, maintain(version) and operate with industry standards.
* Simplicity and explicitness of APIs: uses as few concepts as possible to model complex logic. It uses clear abstractions to defines workflows in terms of discrete states, with waitUntil conditions and execute actions, declarative schema for data and search attributes for persistence, and RPC for external interaction for both read and write.
* Dynamic Interactions: allows external applications to interact with running workflows through RPC, signals, and internal channels.
* Extensive tooling: provides tooling to look up running state definitions, skipping timers, enhanced resetting etc.

## WebUI Features

### Workflow Search Page

- **Advanced Search**: Search workflow executions by various criteria with a powerful query syntax
- **Customizable Filters**: Apply filters by column with various operators (=, !=, >, <, etc.)
- **Shareable URLs**: Search parameters are preserved in the URL for easy sharing with teammates
- **Search History**: Recent searches are automatically saved and can be accessed quickly
- **Named Queries**: Save important searches with custom names for future reference
- **Customizable Display**: Personalize your table columns, order, and visibility
- **Timezone Selection**: View timestamps in your preferred timezone
- **Pagination Controls**: Navigate through search results with adjustable page sizes

### Workflow Details Page

- **Workflow Timeline**: Chronological view of all workflow events
- **Interactive Graph View**: Visualize workflow execution in a tree-based graph representation
- **Event Details**: Expand individual events to see complete details
- **Workflow Summary**: View key workflow information including status, IDs, and timestamps
- **Custom Search Attributes**: Display of workflow-specific metadata and custom attributes

### User Experience

- **Responsive Design**: Works on both desktop and mobile devices
- **Persistent Preferences**: User settings for columns and timezone are saved between sessions
- **Real-time Updates**: Workflow information is fetched directly from the Temporal server

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

## Quick Start Guide

### 1. Configuration

Before launching iWF WebUI, check the `.env.local` file to make sure you're connecting to the right Temporal service and namespace:

For production, you can set environment variables directly.

```
# Temporal Configuration
TEMPORAL_HOST_PORT=localhost:7233  # Change to your Temporal server address
TEMPORAL_NAMESPACE=default         # Change to your namespace
TEMPORAL_API_KEY=""                # Change to your API key to connect to Temporal Cloud
```

By default, the application will connect to a local Temporal server on port 7233 with the "default" namespace.

### 2. Launch the Application

```
npm run dev
```

## Development & Contribution

Any contribution is welcome!

### Updating API Definitions

If you need to update the API schema:

1. Update the API schema in `/api-schema/iwf-web.yaml`
2. Run `make gen` to regenerate the TypeScript client

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the Apache License 2.0 - see the LICENSE file for details.