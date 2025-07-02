#!/usr/bin/env python3
"""
Simple test script to check if FastAPI server can start without database connections
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Create a minimal FastAPI app for testing
app = FastAPI(
    title="EuFMD Nexus API - Test",
    description="Test server to check basic functionality",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "EuFMD Nexus Test API is running", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "Test API is operational"}

@app.get("/api/test")
async def test_endpoint():
    return {"message": "Test endpoint working", "status": "ok"}

if __name__ == "__main__":
    import uvicorn
    print("Starting test server...")
    print("Server will be available at: http://localhost:5800")
    print("Health check: http://localhost:5800/health")
    print("Test API: http://localhost:5800/api/test")
    uvicorn.run(
        "test_server:app",
        host="0.0.0.0",
        port=5800,
        reload=True
    )
