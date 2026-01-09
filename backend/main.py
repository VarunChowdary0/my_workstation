import asyncio
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import execute

# Windows requires ProactorEventLoop for subprocess support
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

app = FastAPI(title="Workstation Code Executor")

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include routers
app.include_router(execute.router, prefix="/api/projects", tags=["execution"])


@app.get("/")
async def root():
    return {"message": "Workstation Code Executor API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
