# CLAUDE.md - Coding Assistant Reference

## Build Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `make gen` - Generate TypeScript API code
- `make api-code-gen-ts` - Generate TypeScript APIs from OpenAPI schema

## Tech Stack
- Next.js v15.2.0 + React v19.0.0
- TypeScript v5.8.2
- Tailwind CSS
- Temporal client for workflow management

## Code Style Guidelines
- Use TypeScript with explicit types
- 2-space indentation, single quotes, semicolons
- React functional components with hooks
- Props and state interfaces named with component name + 'Props'/'State'
- JSX for templating, Tailwind for styling
- Strong typing for all variables and function parameters/returns
- Handle errors explicitly, prefer early returns