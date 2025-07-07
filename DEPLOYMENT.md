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
   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. Transfer the files to your EC2 instance:
   ```bash
   # Create directories on EC2
   ssh ubuntu@13.49.235.70 "sudo mkdir -p /var/www/eufmd-nexus/frontend /var/www/eufmd-nexus/backend"
   
   # Transfer frontend build files
   scp -r frontend/build/* ubuntu@13.49.235.70:/var/www/eufmd-nexus/frontend/
   
   # Transfer backend files
   scp -r backend/* ubuntu@13.49.235.70:/var/www/eufmd-nexus/backend/
   ```

3. SSH into your EC2 instance and set up the backend:
   ```bash
   ssh ubuntu@13.49.235.70
   cd /var/www/eufmd-nexus/backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

4. Install and start the systemd service:
   ```bash
   sudo cp /path/to/deployment/eufmd-nexus-api.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable eufmd-nexus-api
   sudo systemctl start eufmd-nexus-api
   ```

5. Configure Nginx:
   ```bash
   sudo cp /path/to/deployment/nginx-eufmd-nexus.conf /etc/nginx/sites-available/eufmd-nexus
   sudo ln -sf /etc/nginx/sites-available/eufmd-nexus /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

## Troubleshooting

- Check the service status: `sudo systemctl status eufmd-nexus-api`
- View backend logs: `sudo journalctl -u eufmd-nexus-api`
- View Nginx logs: `sudo tail -f /var/log/nginx/eufmd-nexus-error.log`