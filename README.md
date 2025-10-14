This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Docker

This project includes a multi-stage Dockerfile optimized for Next.js 15 with standalone output.

### Build and run with Docker (PowerShell)

```powershell
# Build the image
docker build -t workstation-interface:latest .

# Run the container
docker run --rm -p 3000:3000 --name workstation-interface workstation-interface:latest
```

Open http://localhost:3000 in your browser.

### Using Docker Compose

```powershell
docker compose up --build
```

To stop:

```powershell
docker compose down
```

### Environment variables

If you use environment variables in your app, create a `.env` file locally and either:

- Uncomment `env_file: - .env` in `compose.yaml`, or
- Pass `--env-file .env` to `docker run`.

The runtime listens on `PORT=3000` by default and binds to `0.0.0.0` inside the container.
