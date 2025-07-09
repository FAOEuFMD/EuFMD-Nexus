from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from config import settings

# Import routers
from routers import (
    auth,
    rmt,
    pcp,
    fast_report,
    diagnostic_support,
    emergency_response,
    feedback,
    visits,
    stock,
    loa
)

# Create FastAPI application
app = FastAPI(
    title="EuFMD Nexus API",
    description="FastAPI backend for EuFMD Nexus application",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(rmt.router)
app.include_router(pcp.router)
app.include_router(fast_report.router)
app.include_router(diagnostic_support.router)
app.include_router(emergency_response.router)
app.include_router(feedback.router)
app.include_router(visits.router)
app.include_router(stock.router)
app.include_router(loa.router)

# Root endpoint
@app.get("/")
async def root():
    return {"message": "EuFMD Nexus API is running", "version": "1.0.0"}

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "API is operational"}

# Handle production static files (similar to Vue backend)
if settings.node_env in ["production", "staging"]:
    # Mount static files if they exist
    static_path = os.path.join(os.path.dirname(__file__), "static")
    if os.path.exists(static_path):
        app.mount("/static", StaticFiles(directory=static_path), name="static")
    
    # Serve React app for any non-API routes
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve React SPA for all non-API routes"""
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        
        index_path = os.path.join(static_path, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        else:
            raise HTTPException(status_code=404, detail="Frontend not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=5800,
        reload=settings.node_env == "development"
    )
