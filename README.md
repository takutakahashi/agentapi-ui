# Agent API UI

A modern web interface built with NuxtJS, TypeScript, and Bun for interacting with agent APIs.

## Features

- 🚀 **NuxtJS 3** - Modern Vue.js framework
- 🔷 **TypeScript** - Type-safe development
- ⚡ **Bun** - Fast JavaScript runtime and package manager
- 🧪 **Vitest** - Unit testing framework
- 🐳 **Docker** - Containerized deployment
- 🔄 **CI/CD** - Automated testing and deployment with GitHub Actions
- 📦 **GHCR** - Container registry integration

## Prerequisites

- [Bun](https://bun.sh/) 1.2.11 or later
- [Node.js](https://nodejs.org/) 18+ (for production Docker image)
- [Docker](https://docker.com/) (for containerization)

## Getting Started

### 1. Clone and Install

```bash
git clone <repository-url>
cd agentapi-ui
bun install
```

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Development

```bash
# Start development server
bun run dev

# Available at http://localhost:3000
```

## Scripts

### Development
- `bun run dev` - Start development server
- `bun run build` - Build for production
- `bun run generate` - Generate static site
- `bun run preview` - Preview production build

### Testing
- `bun run test` - Run unit tests
- `bun run test:ui` - Run tests with UI
- `bun run test:coverage` - Run tests with coverage report

### Code Quality
- `bun run lint` - Run ESLint
- `bun run lint:fix` - Fix linting issues
- `bun run typecheck` - Run TypeScript type checking

## Docker

### Build and Run

```bash
# Build image
docker build -t agentapi-ui .

# Run container
docker run -p 3000:3000 agentapi-ui
```

### Using Docker Compose

```bash
# Development
docker-compose up -d

# Production
docker-compose -f docker-compose.prod.yml up -d
```

## CI/CD

This project includes GitHub Actions workflows for:

- **CI Pipeline** (`ci.yml`): Runs tests, linting, and type checking
- **Docker Pipeline** (`docker.yml`): Builds and pushes images to GHCR

### Container Registry

Images are automatically published to GitHub Container Registry (GHCR):
- `ghcr.io/takutakahashi/agentapi-ui:main` - Latest from main branch
- `ghcr.io/takutakahashi/agentapi-ui:v*` - Tagged releases

## Project Structure

```
├── components/          # Vue components
├── pages/              # Route pages
├── tests/              # Test files
├── .github/workflows/  # GitHub Actions
├── Dockerfile          # Container configuration
├── nuxt.config.ts      # Nuxt configuration
├── vitest.config.ts    # Test configuration
└── package.json        # Dependencies and scripts
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

[MIT License](LICENSE)
