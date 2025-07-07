# Deployment Guide for EuFMD Nexus

This document outlines the deployment process for the EuFMD Nexus application.

## Automated Deployment with CircleCI

The application is automatically deployed to AWS EC2 when changes are pushed to the `main` branch. The deployment is handled by CircleCI.

### Prerequisites

1. A CircleCI account connected to your GitHub repository
2. An AWS EC2 instance with:
   - Node.js and npm
   - Python 3 and pip
   - Nginx
   - Sufficient permissions for the EC2 user

### Environment Variables

The following environment variables must be set in the CircleCI project settings:

- `AWS_HOST`: The hostname or IP address of your EC2 instance
- `EC2_USER`: The username to use when connecting to your EC2 instance (e.g., "ubuntu")
- `SSH_KEY_FINGERPRINT`: The fingerprint of the SSH key registered with CircleCI

### Deployment Process

When code is pushed to the `main` branch, CircleCI will:

1. Build the React frontend
2. Transfer the built frontend and backend files to the EC2 instance
3. Set up a systemd service for the FastAPI backend
4. Configure Nginx to serve the frontend and proxy API requests to the backend
5. Restart the necessary services

## Manual Deployment

If you need to deploy the application manually, follow these steps:

1. Build the React frontend: